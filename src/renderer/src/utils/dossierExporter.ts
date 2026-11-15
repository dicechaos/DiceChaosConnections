import {
  CampaignSnapshot,
  CanvasTheme,
  ConnectionPreset,
  CustomEntityType,
  DndEdge,
  DndNode,
  DossierScope,
  ObsidianVaultEntry
} from '../types'
import { cleanEdgeForPersistence, cleanNodeForPersistence } from './campaignSerializer'
import { sanitizeCampaignForPlayers } from './playerSanitizer'
import {
  BacklinkItem,
  computeEntityConnectionsAndBacklinks,
  parseWikiToken,
  resolveWikiTargetNode
} from './wikiLinks'

export interface DossierSourceInput {
  campaignTitle: string
  canvasTheme: CanvasTheme
  nodes: DndNode[]
  edges: DndEdge[]
  connectionPresets: ConnectionPreset[]
  customEntityTypes: CustomEntityType[]
  snapshots: CampaignSnapshot[]
}

interface ResolvedRelation {
  edgeId: string
  label: string
  arrowSymbol: string
  otherId: string
  otherLabel: string
  isHidden: boolean
  isPlayerCreated: boolean
  publicNotes: string
  partyNotes: string
  dmNotes: string
}

interface PreparedDossier {
  title: string
  scope: DossierScope
  exportedDate: string
  allNodes: DndNode[]
  groups: Array<{
    typeKey: string
    groupTitle: string
    color: string
    nodes: DndNode[]
  }>
  relationsByNodeId: Map<string, ResolvedRelation[]>
  backlinksByNodeId: Map<string, BacklinkItem[]>
  snapshots: CampaignSnapshot[]
}

const BUILTIN_TYPE_META: Array<{ key: string; plural: string; color: string }> = [
  { key: 'PC', plural: 'Player Characters', color: '#2563eb' },
  { key: 'NPC', plural: 'NPCs', color: '#059669' },
  { key: 'Organization', plural: 'Organizations & Factions', color: '#dc2626' },
  { key: 'Location', plural: 'Locations', color: '#d97706' },
  { key: 'Item', plural: 'Items & Artifacts', color: '#7c3aed' },
  { key: 'Event', plural: 'Events & Quests', color: '#475569' }
]

function sanitizeObsidianFileStem(label: string, usedStems: Set<string>): string {
  const base =
    (label || 'Unnamed Entity')
      .trim()
      .replace(/[<>:"/\\|?*#^[\]\x00-\x1F]+/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/^\.+|\.+$/g, '')
      .trim() || 'Unnamed Entity'

  let candidate = base
  let counter = 2
  while (usedStems.has(candidate.toLowerCase())) {
    candidate = `${base} (${counter})`
    counter++
  }
  usedStems.add(candidate.toLowerCase())
  return candidate
}

function slugifyAsset(label: string, index: number): string {
  const base = (label || 'entity')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `${base || 'entity'}-${index + 1}`
}

function yamlEscape(val: string): string {
  return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatInlineHtml(text: string, visibleNodes: DndNode[], hideSecrets: boolean): string {
  // Replace [[Target|Display]] and [[Alias]] before escaping or escape safely around tokens
  const parts = text.split(/(\[\[[^\]]+\]\])/g)
  const rendered = parts
    .map((part) => {
      if (part.startsWith('[[') && part.endsWith(']]')) {
        const inner = part.slice(2, -2)
        const resolved = resolveWikiTargetNode(inner, visibleNodes, hideSecrets)
        const safeText = escapeHtml(resolved.displayText)
        if (resolved.node) {
          return `<strong class="wiki-pill">${safeText}</strong>`
        }
        return `<span>${safeText}</span>`
      }
      return escapeHtml(part)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    })
    .join('')
  return rendered
}

function renderParagraphsHtml(text: string, visibleNodes: DndNode[], hideSecrets: boolean): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return trimmed
    .split(/\n{2,}/)
    .map((block) => `<p>${formatInlineHtml(block, visibleNodes, hideSecrets).replace(/\n/g, '<br/>')}</p>`)
    .join('\n')
}

function scrubMissingWikiLinksMarkdown(
  text: string,
  visibleNodes: DndNode[],
  scope: DossierScope,
  stemByNodeId?: Map<string, string>
): string {
  const hideSecrets = scope === 'player'
  return text.replace(/\[\[([^\]]+)\]\]/g, (full, rawInner: string) => {
    const resolved = resolveWikiTargetNode(rawInner, visibleNodes, hideSecrets)
    if (!resolved.node) {
      if (scope === 'dm') return full
      // In Player scope, unwrap [[Hidden|Display]] -> Display so Obsidian never creates ghost spoiler stubs
      return parseWikiToken(rawInner).displayText
    }
    if (stemByNodeId) {
      const stem = stemByNodeId.get(resolved.node.id)
      if (stem) {
        return stem === resolved.displayText
          ? `[[${stem}]]`
          : `[[${stem}|${resolved.displayText}]]`
      }
    }
    return full
  })
}

function prepareDossierModel(rawInput: DossierSourceInput, scope: DossierScope): PreparedDossier {
  const source =
    scope === 'player'
      ? sanitizeCampaignForPlayers(rawInput)
      : {
          campaignTitle: rawInput.campaignTitle,
          canvasTheme: rawInput.canvasTheme,
          nodes: rawInput.nodes.map(cleanNodeForPersistence),
          edges: rawInput.edges.map(cleanEdgeForPersistence),
          connectionPresets: rawInput.connectionPresets,
          customEntityTypes: rawInput.customEntityTypes,
          snapshots: rawInput.snapshots
        }

  const nodeById = new Map<string, DndNode>(source.nodes.map((n) => [n.id, n]))
  const edgeById = new Map<string, DndEdge>(source.edges.map((e) => [e.id, e]))

  const resolveEndpointLabel = (id: string): string => {
    const node = nodeById.get(id)
    if (node) return node.data.label || 'Unnamed Entity'
    if (id.startsWith('proxy-')) {
      const parentEdge = edgeById.get(id.slice(6))
      if (parentEdge) {
        const sName = nodeById.get(parentEdge.source)?.data.label || 'Entity'
        const tName = nodeById.get(parentEdge.target)?.data.label || 'Entity'
        return `${parentEdge.data?.label || 'Connection'} (${sName} → ${tName})`
      }
    }
    return 'Unknown'
  }

  const relationsByNodeId = new Map<string, ResolvedRelation[]>()
  for (const n of source.nodes) {
    relationsByNodeId.set(n.id, [])
  }

  for (const edge of source.edges) {
    const d = edge.data || {}
    const dir = d.direction || 'none'
    const relLabel = d.label?.trim() || d.preset || 'Connected to'

    if (nodeById.has(edge.source)) {
      const arrowOut =
        dir === 'forward' ? '→' : dir === 'reverse' ? '←' : dir === 'bidirectional' ? '↔' : '—'
      relationsByNodeId.get(edge.source)!.push({
        edgeId: edge.id,
        label: relLabel,
        arrowSymbol: arrowOut,
        otherId: edge.target,
        otherLabel: resolveEndpointLabel(edge.target),
        isHidden: !!d.isHidden,
        isPlayerCreated: !!d.isPlayerCreated,
        publicNotes: d.publicNotes || '',
        partyNotes: d.partyNotes || '',
        dmNotes: scope === 'dm' ? d.dmNotes || '' : ''
      })
    }

    if (nodeById.has(edge.target) && edge.target !== edge.source) {
      const arrowIn =
        dir === 'forward' ? '←' : dir === 'reverse' ? '→' : dir === 'bidirectional' ? '↔' : '—'
      relationsByNodeId.get(edge.target)!.push({
        edgeId: edge.id,
        label: relLabel,
        arrowSymbol: arrowIn,
        otherId: edge.source,
        otherLabel: resolveEndpointLabel(edge.source),
        isHidden: !!d.isHidden,
        isPlayerCreated: !!d.isPlayerCreated,
        publicNotes: d.publicNotes || '',
        partyNotes: d.partyNotes || '',
        dmNotes: scope === 'dm' ? d.dmNotes || '' : ''
      })
    }
  }

  const groups: PreparedDossier['groups'] = []
  const assignedIds = new Set<string>()

  for (const builtin of BUILTIN_TYPE_META) {
    const matching = source.nodes
      .filter((n) => n.type !== 'groupRegion' && !n.data.isGroup && n.data.entityType === builtin.key)
      .sort((a, b) => (a.data.label || '').localeCompare(b.data.label || ''))
    if (matching.length > 0) {
      matching.forEach((m) => assignedIds.add(m.id))
      groups.push({
        typeKey: builtin.key,
        groupTitle: builtin.plural,
        color: builtin.color,
        nodes: matching
      })
    }
  }

  // Group Regions that carry members, status markers, metadata, lore, party notes, secrets, or direct connections
  const richGroupRegions = source.nodes
    .filter((n) => {
      if (n.type !== 'groupRegion' && !n.data.isGroup) return false
      assignedIds.add(n.id)
      const hasMembers = source.nodes.some(
        (m) => m.id !== n.id && m.type !== 'groupRegion' && !m.data.isGroup && m.data.groupId === n.id
      )
      const hasNotes = Boolean(
        n.data.publicNotes?.trim() ||
          n.data.partyNotes?.trim() ||
          (scope === 'dm' && n.data.dmNotes?.trim())
      )
      const hasRelations = (relationsByNodeId.get(n.id)?.length || 0) > 0
      const hasMeta =
        Boolean(n.data.groupSubtitle?.trim()) ||
        Boolean(n.data.statusIcons && n.data.statusIcons.length > 0) ||
        collectEntityMetaPairs(n, scope).length > 0
      return hasMembers || hasNotes || hasRelations || hasMeta
    })
    .sort((a, b) => (a.data.label || '').localeCompare(b.data.label || ''))

  if (richGroupRegions.length > 0) {
    groups.push({
      typeKey: 'GroupRegion',
      groupTitle: 'Groups & Regions',
      color: '#b45309',
      nodes: richGroupRegions
    })
  }

  // Custom & dynamic types
  const customTypeColor = new Map<string, string>(
    source.customEntityTypes.map((t) => [t.label, t.color])
  )
  const remainingByType = new Map<string, DndNode[]>()
  for (const n of source.nodes) {
    if (assignedIds.has(n.id)) continue
    const tKey = String(n.data.entityType || 'Other')
    if (!remainingByType.has(tKey)) remainingByType.set(tKey, [])
    remainingByType.get(tKey)!.push(n)
  }

  Array.from(remainingByType.keys())
    .sort((a, b) => a.localeCompare(b))
    .forEach((tKey) => {
      const list = remainingByType
        .get(tKey)!
        .sort((a, b) => (a.data.label || '').localeCompare(b.data.label || ''))
      groups.push({
        typeKey: tKey,
        groupTitle: tKey,
        color: customTypeColor.get(tKey) || '#6366f1',
        nodes: list
      })
    })

  const backlinksByNodeId = new Map<string, BacklinkItem[]>()
  for (const n of source.nodes) {
    const { backlinks } = computeEntityConnectionsAndBacklinks(
      n.id,
      source.nodes,
      source.edges,
      scope === 'player'
    )
    backlinksByNodeId.set(n.id, backlinks)
  }

  return {
    title: source.campaignTitle?.trim() || 'Untitled Campaign',
    scope,
    exportedDate: new Date().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }),
    allNodes: source.nodes,
    groups,
    relationsByNodeId,
    backlinksByNodeId,
    snapshots: source.snapshots
  }
}

function getGroupMembersForDossier(node: DndNode, allNodes: DndNode[]): DndNode[] {
  if (node.type !== 'groupRegion' && !node.data.isGroup) return []
  return allNodes
    .filter(
      (m) =>
        m.id !== node.id &&
        m.type !== 'groupRegion' &&
        !m.data.isGroup &&
        m.data.groupId === node.id
    )
    .sort((a, b) => (a.data.label || '').localeCompare(b.data.label || ''))
}

function collectEntityMetaPairs(node: DndNode, scope: DossierScope): Array<{ label: string; value: string }> {
  const f = node.data.dndFields || {}
  const pairs: Array<{ label: string; value: string }> = []
  if (node.data.groupSubtitle?.trim()) {
    pairs.push({ label: 'Subtitle', value: node.data.groupSubtitle.trim() })
  }
  if (node.data.aliases && node.data.aliases.length > 0) {
    pairs.push({ label: 'Aliases', value: node.data.aliases.join(', ') })
  }
  if (node.data.tags && node.data.tags.length > 0) {
    pairs.push({
      label: 'Tags',
      value: node.data.tags.map((t) => `#${t.replace(/^#/, '')}`).join(', ')
    })
  }
  if (node.data.statusIcons && node.data.statusIcons.length > 0) {
    pairs.push({ label: 'Status Markers', value: node.data.statusIcons.join(', ') })
  }
  if (f.ancestry) pairs.push({ label: 'Ancestry', value: f.ancestry })
  if (f.classOrRole) pairs.push({ label: 'Role / Class', value: f.classOrRole })
  if (f.faction) pairs.push({ label: 'Faction', value: f.faction })
  if (f.disposition) pairs.push({ label: 'Party Standing', value: f.disposition })
  if (scope === 'dm' && f.alignment) pairs.push({ label: 'Alignment', value: f.alignment })
  if (scope === 'dm' && node.data.stats) pairs.push({ label: 'Stats', value: node.data.stats })
  if (f.region) pairs.push({ label: 'Region', value: f.region })
  if (f.locationType) pairs.push({ label: 'Location Type', value: f.locationType })
  if (scope === 'dm' && f.dangerTier) pairs.push({ label: 'Danger Tier', value: f.dangerTier })
  if (f.rarity) pairs.push({ label: 'Rarity', value: f.rarity })
  if (f.attunement) pairs.push({ label: 'Attunement', value: 'Required' })
  if (f.holder) pairs.push({ label: 'Held By', value: f.holder })
  if (f.influence) pairs.push({ label: 'Influence', value: f.influence })
  if (f.headquarters) pairs.push({ label: 'Headquarters', value: f.headquarters })
  if (f.goal) pairs.push({ label: 'Goal', value: f.goal })
  if (f.questStatus) pairs.push({ label: 'Quest Status', value: f.questStatus })
  if (f.sessionDate) pairs.push({ label: 'Session', value: f.sessionDate })
  return pairs
}

// ============================================================================
// 1. SINGLE-FILE MARKDOWN DOSSIER (.md)
// ============================================================================
export function generateMarkdownDossier(rawInput: DossierSourceInput, scope: DossierScope): string {
  const model = prepareDossierModel(rawInput, scope)
  const allVisibleNames = new Set(
    model.groups.flatMap((g) => g.nodes.map((n) => (n.data.label || '').trim().toLowerCase()))
  )

  const lines: string[] = []
  const editionBadge =
    scope === 'player' ? 'Player Handout (Spoiler-Free)' : 'Full DM Campaign Bible (Contains Secrets)'

  lines.push(`# ${model.title}`)
  lines.push(`*${editionBadge} • Exported ${model.exportedDate}*`)
  lines.push('')

  if (model.groups.length > 0) {
    lines.push('## Contents')
    for (const grp of model.groups) {
      lines.push(`- **${grp.groupTitle}** (${grp.nodes.length})`)
    }
    if (model.snapshots.length > 0) {
      lines.push(`- **Session Timeline & Recaps** (${model.snapshots.length})`)
    }
    lines.push('')
  }

  for (const grp of model.groups) {
    lines.push('---')
    lines.push(`## ${grp.groupTitle}`)
    lines.push('')

    for (const node of grp.nodes) {
      const d = node.data
      const flags: string[] = []
      if (d.isPlayerCreated) flags.push('Party Theory')
      if (scope === 'dm' && d.isHidden) flags.push('DM Hidden')
      const flagSuffix = flags.length > 0 ? ` *(${flags.join(' • ')})*` : ''

      lines.push(`### ${d.label || 'Unnamed Entity'}${flagSuffix}`)

      const meta = collectEntityMetaPairs(node, scope)
      if (meta.length > 0) {
        lines.push(meta.map((m) => `**${m.label}:** ${m.value}`).join(' | '))
        lines.push('')
      }

      const pub = scrubMissingWikiLinksMarkdown(
        (d.publicNotes ?? d.description ?? '').trim(),
        model.allNodes,
        scope
      )
      if (pub) {
        lines.push(pub)
        lines.push('')
      }

      const party = scrubMissingWikiLinksMarkdown((d.partyNotes || '').trim(), model.allNodes, scope)
      if (party) {
        lines.push('> **Party Notes & Theories:**')
        party.split('\n').forEach((l) => lines.push(`> ${l}`))
        lines.push('')
      }

      if (scope === 'dm' && (d.dmNotes?.trim() || d.dndFields?.voiceCue?.trim())) {
        lines.push('> [!WARNING] DM Secrets')
        if (d.dndFields?.voiceCue?.trim()) {
          lines.push(`> **Voice / Mannerism:** ${d.dndFields.voiceCue.trim()}`)
        }
        if (d.dmNotes?.trim()) {
          d.dmNotes
            .trim()
            .split('\n')
            .forEach((l) => lines.push(`> ${l}`))
        }
        lines.push('')
      }

      const members = getGroupMembersForDossier(node, model.allNodes)
      if (members.length > 0) {
        const memberList = members
          .map((m) => {
            const lbl = (m.data.label || 'Unnamed Entity').trim()
            return allVisibleNames.has(lbl.toLowerCase()) ? `[[${lbl}]]` : lbl
          })
          .join(', ')
        lines.push(`**Entities in Group (${members.length}):** ${memberList}`)
        lines.push('')
      }

      const rels = model.relationsByNodeId.get(node.id) || []
      if (rels.length > 0) {
        lines.push('**Relationships:**')
        for (const r of rels) {
          const targetWiki = allVisibleNames.has(r.otherLabel.toLowerCase())
            ? `[[${r.otherLabel}]]`
            : r.otherLabel
          const relFlags: string[] = []
          if (r.isPlayerCreated) relFlags.push('Theory')
          if (scope === 'dm' && r.isHidden) relFlags.push('DM Hidden')
          const rf = relFlags.length > 0 ? ` *(${relFlags.join(', ')})*` : ''
          lines.push(`- **${r.label}** ${r.arrowSymbol} ${targetWiki}${rf}`)
          if (r.publicNotes.trim()) {
            lines.push(`  - *Lore:* ${scrubMissingWikiLinksMarkdown(r.publicNotes.trim(), model.allNodes, scope)}`)
          }
          if (r.partyNotes.trim()) {
            lines.push(`  - *Party Note:* ${scrubMissingWikiLinksMarkdown(r.partyNotes.trim(), model.allNodes, scope)}`)
          }
          if (scope === 'dm' && r.dmNotes.trim()) {
            lines.push(`  - *DM Secret:* ${r.dmNotes.trim()}`)
          }
        }
        lines.push('')
      }

      const backlinks = model.backlinksByNodeId.get(node.id) || []
      if (backlinks.length > 0) {
        lines.push('**Referenced In:**')
        for (const b of backlinks) {
          const scopeFlag = b.noteScope === 'DM Secret' ? ' *(DM Secret)*' : b.noteScope === 'Party Note' ? ' *(Party Note)*' : ''
          lines.push(`- **${b.title}**${scopeFlag} — *${b.snippet}*`)
        }
        lines.push('')
      }
    }
  }

  if (model.snapshots.length > 0) {
    lines.push('---')
    lines.push('## Session Timeline & Recaps')
    lines.push('')
    for (const snap of model.snapshots) {
      const heading = snap.sessionNumber
        ? `Session ${snap.sessionNumber}: ${snap.title}`
        : snap.title
      const visFlag = scope === 'dm' && snap.playerVisible === false ? ' *(DM Only)*' : ''
      lines.push(`### ${heading}${visFlag}`)
      if (snap.summary?.trim()) {
        lines.push(scrubMissingWikiLinksMarkdown(snap.summary.trim(), model.allNodes, scope))
      } else {
        lines.push('*No session summary recorded.*')
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

// ============================================================================
// 2. OBSIDIAN VAULT FOLDER EXPORT (*.md + YAML Frontmatter + assets/)
// ============================================================================
export function generateObsidianVaultEntries(
  rawInput: DossierSourceInput,
  scope: DossierScope
): ObsidianVaultEntry[] {
  const model = prepareDossierModel(rawInput, scope)
  const entries: ObsidianVaultEntry[] = []

  const usedStems = new Set<string>(['_campaign index'])
  const stemByNodeId = new Map<string, string>()
  const folderByTypeKey = new Map<string, string>()

  for (const grp of model.groups) {
    const safeFolder = grp.groupTitle.replace(/[<>:"/\\|?*\x00-\x1F]+/g, '-').trim() || 'Entities'
    folderByTypeKey.set(grp.typeKey, safeFolder)
    for (const node of grp.nodes) {
      const stem = sanitizeObsidianFileStem(node.data.label || 'Unnamed Entity', usedStems)
      stemByNodeId.set(node.id, stem)
    }
  }

  const formatObsidianLink = (nodeId: string, fallbackLabel: string): string => {
    const stem = stemByNodeId.get(nodeId)
    if (!stem) return fallbackLabel
    return stem === fallbackLabel ? `[[${stem}]]` : `[[${stem}|${fallbackLabel}]]`
  }

  // Extract portraits into assets/ & generate individual entity notes
  let assetCounter = 0
  for (const grp of model.groups) {
    const folder = folderByTypeKey.get(grp.typeKey) || 'Entities'

    for (const node of grp.nodes) {
      const d = node.data
      const f = d.dndFields || {}
      const stem = stemByNodeId.get(node.id)!
      const rawLabel = (d.label || 'Unnamed Entity').trim()

      let portraitEmbed = ''
      if (d.portrait && d.portrait.startsWith('data:image/')) {
        const match = d.portrait.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/)
        if (match) {
          const ext =
            match[1] === 'jpeg' ? 'jpg' : match[1] === 'svg+xml' ? 'svg' : match[1]
          const base64Body = match[2]
          const assetFile = `${slugifyAsset(rawLabel, assetCounter++)}.${ext}`
          entries.push({
            relativePath: `assets/${assetFile}`,
            content: base64Body,
            encoding: 'base64'
          })
          portraitEmbed = `![[assets/${assetFile}|260]]`
        }
      }

      // Build YAML frontmatter
      const yaml: string[] = ['---']
      yaml.push(
        `type: ${yamlEscape(
          node.type === 'groupRegion' || d.isGroup ? 'GroupRegion' : String(d.entityType || 'Entity')
        )}`
      )
      const aliasSet = new Set<string>()
      if (stem !== rawLabel) aliasSet.add(rawLabel)
      for (const a of d.aliases || []) {
        const trimmedAlias = a.trim()
        if (trimmedAlias) aliasSet.add(trimmedAlias)
      }
      if (aliasSet.size > 0) {
        yaml.push(`aliases: [${Array.from(aliasSet).map(yamlEscape).join(', ')}]`)
      }
      if (d.tags && d.tags.length > 0) {
        const cleanTags = d.tags
          .map((t) => t.replace(/^#+/, '').trim())
          .filter(Boolean)
        if (cleanTags.length > 0) {
          yaml.push(`tags: [${cleanTags.map(yamlEscape).join(', ')}]`)
        }
      }
      if (d.statusIcons && d.statusIcons.length > 0) {
        yaml.push(`status_markers: [${d.statusIcons.map(yamlEscape).join(', ')}]`)
      }
      if (f.disposition) yaml.push(`disposition: ${yamlEscape(f.disposition)}`)
      if (f.faction) yaml.push(`faction: ${yamlEscape(f.faction)}`)
      if (f.region) yaml.push(`region: ${yamlEscape(f.region)}`)
      if (f.rarity) yaml.push(`rarity: ${yamlEscape(f.rarity)}`)
      if (f.questStatus) yaml.push(`quest_status: ${yamlEscape(f.questStatus)}`)
      if (d.isPlayerCreated) yaml.push('player_theory: true')
      if (scope === 'dm' && d.isHidden) yaml.push('dm_hidden: true')
      yaml.push('---')

      const body: string[] = [...yaml, '', `# ${rawLabel}`]
      if (portraitEmbed) {
        body.push('', portraitEmbed)
      }

      const meta = collectEntityMetaPairs(node, scope)
      if (meta.length > 0) {
        body.push('')
        for (const m of meta) {
          body.push(`- **${m.label}:** ${m.value}`)
        }
      }

      const pub = scrubMissingWikiLinksMarkdown(
        (d.publicNotes ?? d.description ?? '').trim(),
        model.allNodes,
        scope,
        stemByNodeId
      )
      body.push('', '## Lore & Notes')
      body.push(pub || '*No public lore recorded yet.*')

      const party = scrubMissingWikiLinksMarkdown(
        (d.partyNotes || '').trim(),
        model.allNodes,
        scope,
        stemByNodeId
      )
      if (party) {
        body.push('', '## Party Notes & Theories', party)
      }

      if (scope === 'dm' && (d.dmNotes?.trim() || f.voiceCue?.trim())) {
        body.push('', '## DM Secrets')
        if (f.voiceCue?.trim()) {
          body.push(`> **Voice / Mannerism:** ${f.voiceCue.trim()}`, '')
        }
        if (d.dmNotes?.trim()) {
          body.push(
            scrubMissingWikiLinksMarkdown(d.dmNotes.trim(), model.allNodes, scope, stemByNodeId)
          )
        }
      }

      const members = getGroupMembersForDossier(node, model.allNodes)
      if (members.length > 0) {
        body.push('', `## Entities in Group (${members.length})`)
        for (const m of members) {
          const memLink = formatObsidianLink(m.id, (m.data.label || 'Unnamed Entity').trim())
          const memFlags: string[] = []
          if (m.data.dndFields?.disposition) memFlags.push(m.data.dndFields.disposition)
          if (m.data.isPlayerCreated) memFlags.push('Theory')
          if (scope === 'dm' && m.data.isHidden) memFlags.push('DM Hidden')
          const memFlagText = memFlags.length > 0 ? ` — *${memFlags.join(' • ')}*` : ''
          body.push(`- ${memLink}${memFlagText}`)
        }
      }

      const rels = model.relationsByNodeId.get(node.id) || []
      if (rels.length > 0) {
        body.push('', '## Relationships')
        for (const r of rels) {
          const linkStr = formatObsidianLink(r.otherId, r.otherLabel)
          const flags: string[] = []
          if (r.isPlayerCreated) flags.push('Theory')
          if (scope === 'dm' && r.isHidden) flags.push('DM Hidden')
          const flagText = flags.length > 0 ? ` *(${flags.join(', ')})*` : ''
          body.push(`- **${r.label}** ${r.arrowSymbol} ${linkStr}${flagText}`)
          if (r.publicNotes.trim()) {
            body.push(
              `  - ${scrubMissingWikiLinksMarkdown(r.publicNotes.trim(), model.allNodes, scope, stemByNodeId)}`
            )
          }
          if (r.partyNotes.trim()) {
            body.push(
              `  - *Party Note:* ${scrubMissingWikiLinksMarkdown(r.partyNotes.trim(), model.allNodes, scope, stemByNodeId)}`
            )
          }
          if (scope === 'dm' && r.dmNotes.trim()) {
            body.push(
              `  - *DM Secret:* ${scrubMissingWikiLinksMarkdown(r.dmNotes.trim(), model.allNodes, scope, stemByNodeId)}`
            )
          }
        }
      }

      const backlinks = model.backlinksByNodeId.get(node.id) || []
      if (backlinks.length > 0) {
        body.push('', '## Referenced In (Backlinks)')
        for (const b of backlinks) {
          const sourceLink =
            b.sourceType === 'node' ? formatObsidianLink(b.id, b.title) : `**${b.title}**`
          const scopeFlag =
            b.noteScope === 'DM Secret'
              ? ' *(DM Secret)*'
              : b.noteScope === 'Party Note'
                ? ' *(Party Note)*'
                : ''
          body.push(`- ${sourceLink}${scopeFlag} — *${b.snippet}*`)
        }
      }

      entries.push({
        relativePath: `${folder}/${stem}.md`,
        content: body.join('\n'),
        encoding: 'utf8'
      })
    }
  }

  // Build _Campaign Index.md
  const indexLines: string[] = [
    '---',
    `campaign: ${yamlEscape(model.title)}`,
    `edition: ${yamlEscape(scope)}`,
    `exported: ${yamlEscape(model.exportedDate)}`,
    '---',
    '',
    `# ${model.title}`,
    `*${scope === 'player' ? 'Player Handout Vault' : 'Full DM Campaign Vault'} • Exported ${model.exportedDate}*`,
    ''
  ]

  for (const grp of model.groups) {
    indexLines.push(`## ${grp.groupTitle}`)
    for (const node of grp.nodes) {
      const link = formatObsidianLink(node.id, node.data.label || 'Unnamed Entity')
      const extra: string[] = []
      if (node.data.dndFields?.disposition) extra.push(node.data.dndFields.disposition)
      if (node.data.isPlayerCreated) extra.push('Theory')
      if (scope === 'dm' && node.data.isHidden) extra.push('DM Hidden')
      const suffix = extra.length > 0 ? ` — *${extra.join(' • ')}*` : ''
      indexLines.push(`- ${link}${suffix}`)
    }
    indexLines.push('')
  }

  if (model.snapshots.length > 0) {
    indexLines.push('## Session Timeline')
    for (const snap of model.snapshots) {
      const heading = snap.sessionNumber
        ? `Session ${snap.sessionNumber}: ${snap.title}`
        : snap.title
      indexLines.push(`### ${heading}`)
      if (snap.summary?.trim()) {
        indexLines.push(
          scrubMissingWikiLinksMarkdown(snap.summary.trim(), model.allNodes, scope, stemByNodeId)
        )
      }
      indexLines.push('')
    }
  }

  entries.unshift({
    relativePath: '_Campaign Index.md',
    content: indexLines.join('\n'),
    encoding: 'utf8'
  })

  return entries
}

// ============================================================================
// 3. FORMATTED TABLETOP PDF HANDOUT HTML BUILDER (Rendered via printToPDF)
// ============================================================================
export function generatePdfDossierHtml(rawInput: DossierSourceInput, scope: DossierScope): string {
  const model = prepareDossierModel(rawInput, scope)
  const hideSecrets = scope === 'player'

  const subtitle =
    scope === 'player'
      ? 'Player Handout Dossier • Spoiler-Free Edition'
      : 'Full DM Campaign Bible • Confidential Secrets Included'

  const sectionsHtml = model.groups
    .map((grp) => {
      const cardsHtml = grp.nodes
        .map((node) => {
          const d = node.data
          const meta = collectEntityMetaPairs(node, scope)
          const pubHtml = renderParagraphsHtml(
            d.publicNotes ?? d.description ?? '',
            model.allNodes,
            hideSecrets
          )
          const partyHtml = renderParagraphsHtml(d.partyNotes || '', model.allNodes, hideSecrets)
          const dmHtml =
            scope === 'dm'
              ? renderParagraphsHtml(d.dmNotes || '', model.allNodes, false)
              : ''
          const voiceCue = scope === 'dm' ? d.dndFields?.voiceCue?.trim() || '' : ''
          const members = getGroupMembersForDossier(node, model.allNodes)
          const rels = model.relationsByNodeId.get(node.id) || []
          const backlinks = model.backlinksByNodeId.get(node.id) || []

          const portraitTag = d.portrait
            ? `<img class="portrait" src="${escapeHtml(d.portrait)}" alt="${escapeHtml(d.label || 'Entity')}" />`
            : ''

          const badges: string[] = []
          if (d.isPlayerCreated) {
            badges.push(`<span class="flag-badge theory-badge">Party Theory</span>`)
          }
          if (scope === 'dm' && d.isHidden) {
            badges.push(`<span class="flag-badge hidden-badge">DM Hidden</span>`)
          }

          const metaGridHtml =
            meta.length > 0
              ? `<div class="meta-grid">${meta
                  .map(
                    (m) =>
                      `<div class="meta-chip"><span class="meta-label">${escapeHtml(m.label)}</span><span class="meta-val">${escapeHtml(m.value)}</span></div>`
                  )
                  .join('')}</div>`
              : ''

          const membersHtml =
            members.length > 0
              ? `<div class="rels-section">
                  <h4>Entities in Group (${members.length})</h4>
                  <p style="margin: 4px 0 0 0; font-size: 9pt; color: #334155;">
                    ${members
                      .map((m) => {
                        const hiddenBadge =
                          scope === 'dm' && m.data.isHidden
                            ? ' <span class="mini-hidden">[Hidden]</span>'
                            : ''
                        return `<strong>${escapeHtml(m.data.label || 'Unnamed Entity')}</strong>${hiddenBadge}`
                      })
                      .join(' &bull; ')}
                  </p>
                </div>`
              : ''

          const relsHtml =
            rels.length > 0
              ? `<div class="rels-section">
                  <h4>Known Connections</h4>
                  <table>
                    <caption class="visually-hidden">Relationships for ${escapeHtml(d.label || 'Entity')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">Relationship</th>
                        <th scope="col">Connected Entity</th>
                        <th scope="col">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rels
                        .map((r) => {
                          const notesParts: string[] = []
                          if (r.publicNotes.trim()) {
                            notesParts.push(
                              formatInlineHtml(r.publicNotes.trim(), model.allNodes, hideSecrets)
                            )
                          }
                          if (r.partyNotes.trim()) {
                            notesParts.push(
                              `<em>Party:</em> ${formatInlineHtml(r.partyNotes.trim(), model.allNodes, hideSecrets)}`
                            )
                          }
                          if (scope === 'dm' && r.dmNotes.trim()) {
                            notesParts.push(
                              `<strong class="dm-inline">DM:</strong> ${formatInlineHtml(r.dmNotes.trim(), model.allNodes, false)}`
                            )
                          }
                          const relFlag =
                            scope === 'dm' && r.isHidden
                              ? ' <span class="mini-hidden">[Hidden]</span>'
                              : r.isPlayerCreated
                                ? ' <span class="mini-theory">[Theory]</span>'
                                : ''
                          return `<tr>
                            <td class="rel-type">${escapeHtml(r.label)} ${escapeHtml(r.arrowSymbol)}${relFlag}</td>
                            <td class="rel-target">${escapeHtml(r.otherLabel)}</td>
                            <td class="rel-notes">${notesParts.join('<br/>') || '—'}</td>
                          </tr>`
                        })
                        .join('')}
                    </tbody>
                  </table>
                </div>`
              : ''

          const backlinksHtml =
            backlinks.length > 0
              ? `<div class="rels-section">
                  <h4>Referenced In (Backlinks)</h4>
                  <ul style="margin: 4px 0 0 18px; padding: 0; font-size: 8.8pt; color: #334155;">
                    ${backlinks
                      .map((b) => {
                        const scopeTag =
                          b.noteScope === 'DM Secret'
                            ? ' <strong class="dm-inline">[DM Secret]</strong>'
                            : b.noteScope === 'Party Note'
                              ? ' <span class="mini-theory">[Party Note]</span>'
                              : ''
                        return `<li><strong>${escapeHtml(b.title)}</strong>${scopeTag} — <em>${escapeHtml(b.snippet)}</em></li>`
                      })
                      .join('')}
                  </ul>
                </div>`
              : ''

          const subLabel =
            node.type === 'groupRegion' || d.isGroup
              ? `Group / Region${d.groupSubtitle?.trim() ? ` • ${d.groupSubtitle.trim()}` : ''}`
              : String(d.entityType || 'Entity')

          return `<article class="entity-card" style="--accent: ${escapeHtml(grp.color)}">
            <div class="card-header">
              ${portraitTag}
              <div class="card-title-wrap">
                <div class="title-row">
                  <h3>${escapeHtml(d.label || 'Unnamed Entity')}</h3>
                  ${badges.join('')}
                </div>
                <div class="entity-sub">${escapeHtml(subLabel)}</div>
                ${metaGridHtml}
              </div>
            </div>
            ${pubHtml ? `<div class="lore-block">${pubHtml}</div>` : ''}
            ${
              partyHtml
                ? `<div class="callout party-callout">
                    <div class="callout-title">Party Notes &amp; Theories</div>
                    ${partyHtml}
                  </div>`
                : ''
            }
            ${
              scope === 'dm' && (dmHtml || voiceCue)
                ? `<div class="callout dm-callout">
                    <div class="callout-title">DM Secrets</div>
                    ${voiceCue ? `<p class="voice-cue"><strong>Voice / Mannerism:</strong> ${escapeHtml(voiceCue)}</p>` : ''}
                    ${dmHtml}
                  </div>`
                : ''
            }
            ${membersHtml}
            ${relsHtml}
            ${backlinksHtml}
          </article>`
        })
        .join('\n')

      return `<section class="type-section">
        <h2 class="section-heading" style="--accent: ${escapeHtml(grp.color)}">
          <span class="section-dot" aria-hidden="true"></span>
          ${escapeHtml(grp.groupTitle)}
          <span class="section-count">${grp.nodes.length}</span>
        </h2>
        <div class="cards-stack">
          ${cardsHtml}
        </div>
      </section>`
    })
    .join('\n')

  const timelineHtml =
    model.snapshots.length > 0
      ? `<section class="type-section">
          <h2 class="section-heading" style="--accent: #2563eb">
            <span class="section-dot" aria-hidden="true"></span>
            Session Timeline &amp; Recaps
            <span class="section-count">${model.snapshots.length}</span>
          </h2>
          <div class="cards-stack">
            ${model.snapshots
              .map((s) => {
                const heading = s.sessionNumber
                  ? `Session ${s.sessionNumber}: ${s.title}`
                  : s.title
                const sumHtml = s.summary?.trim()
                  ? renderParagraphsHtml(s.summary, model.allNodes, hideSecrets)
                  : '<p class="muted">No session summary recorded.</p>'
                return `<article class="entity-card" style="--accent: #2563eb">
                  <div class="title-row">
                    <h3>${escapeHtml(heading)}</h3>
                    ${scope === 'dm' && s.playerVisible === false ? '<span class="flag-badge hidden-badge">DM Only</span>' : ''}
                  </div>
                  <div class="lore-block">${sumHtml}</div>
                </article>`
              })
              .join('\n')}
          </div>
        </section>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(model.title)} — Campaign Dossier</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 10.5pt;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .visually-hidden {
      position: absolute !important;
      clip-path: inset(50%) !important;
      overflow: hidden !important;
      width: 1px !important;
      height: 1px !important;
      margin: -1px !important;
      padding: 0 !important;
      border: 0 !important;
      white-space: nowrap !important;
    }
    header.dossier-banner {
      border-bottom: 3px solid #1e293b;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
    }
    header.dossier-banner h1 {
      margin: 0;
      font-size: 22pt;
      letter-spacing: -0.02em;
      color: #0f172a;
      line-height: 1.15;
    }
    .banner-sub {
      margin-top: 4px;
      font-size: 9.5pt;
      font-weight: 600;
      color: ${scope === 'player' ? '#047857' : '#b45309'};
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .banner-date {
      font-size: 9pt;
      color: #475569;
      white-space: nowrap;
      font-weight: 500;
    }
    .type-section {
      margin-bottom: 24px;
    }
    .section-heading {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14pt;
      margin: 0 0 12px 0;
      padding-bottom: 5px;
      border-bottom: 2px solid var(--accent, #334155);
      color: #0f172a;
      break-after: avoid;
    }
    .section-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: var(--accent, #334155);
      flex: none;
    }
    .section-count {
      margin-left: auto;
      font-size: 9pt;
      font-weight: 700;
      background: #f1f5f9;
      color: #334155;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid #cbd5e1;
    }
    .cards-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .entity-card {
      border: 1px solid #cbd5e1;
      border-left: 4px solid var(--accent, #334155);
      border-radius: 8px;
      padding: 12px 14px;
      background: #ffffff;
      break-inside: avoid;
    }
    .card-header {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .portrait {
      width: 68px;
      height: 68px;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      flex: none;
    }
    .card-title-wrap {
      flex: 1;
      min-width: 0;
    }
    .title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .title-row h3 {
      margin: 0;
      font-size: 12.5pt;
      color: #0f172a;
    }
    .entity-sub {
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
      margin-top: 1px;
    }
    .flag-badge {
      font-size: 8pt;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .theory-badge {
      background: #eef2ff;
      color: #3730a3;
      border: 1px solid #a5b4fc;
    }
    .hidden-badge {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fcd34d;
    }
    .meta-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .meta-chip {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      padding: 2px 7px;
      font-size: 8.5pt;
    }
    .meta-label {
      font-weight: 700;
      color: #475569;
      margin-right: 4px;
    }
    .meta-val {
      color: #0f172a;
      font-weight: 600;
    }
    .lore-block {
      margin-top: 8px;
      color: #1e293b;
    }
    .lore-block p {
      margin: 0 0 6px 0;
    }
    .lore-block p:last-child {
      margin-bottom: 0;
    }
    .wiki-pill {
      color: #1d4ed8;
      font-weight: 600;
    }
    .callout {
      margin-top: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 9.5pt;
    }
    .callout p {
      margin: 0 0 4px 0;
    }
    .callout p:last-child {
      margin-bottom: 0;
    }
    .callout-title {
      font-size: 8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 3px;
    }
    .party-callout {
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      color: #1e1b4b;
    }
    .party-callout .callout-title {
      color: #3730a3;
    }
    .dm-callout {
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #451a03;
    }
    .dm-callout .callout-title {
      color: #92400e;
    }
    .rels-section {
      margin-top: 10px;
    }
    .rels-section h4 {
      margin: 0 0 4px 0;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }
    th, td {
      text-align: left;
      padding: 4px 6px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    th {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #475569;
      background: #f8fafc;
    }
    .rel-type {
      font-weight: 700;
      white-space: nowrap;
      width: 28%;
      color: #0f172a;
    }
    .rel-target {
      font-weight: 600;
      width: 27%;
      color: #1e293b;
    }
    .rel-notes {
      color: #334155;
    }
    .dm-inline, .mini-hidden {
      color: #92400e;
      font-weight: 700;
    }
    .mini-theory {
      color: #3730a3;
      font-weight: 700;
    }
    .muted {
      color: #64748b;
      font-style: italic;
    }
  </style>
</head>
<body>
  <header class="dossier-banner">
    <div>
      <h1>${escapeHtml(model.title)}</h1>
      <div class="banner-sub">${escapeHtml(subtitle)}</div>
    </div>
    <div class="banner-date">Generated ${escapeHtml(model.exportedDate)}</div>
  </header>
  <main>
    ${sectionsHtml || '<p class="muted">No entities recorded on this map yet.</p>'}
    ${timelineHtml}
  </main>
</body>
</html>`
}
