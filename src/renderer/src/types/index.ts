import { Node, Edge } from '@xyflow/react'

export type EntityType = string

export type CanvasTheme = 'modern' | 'arcane' | 'parchment' | 'corkboard'

export type CampaignEdition = 'dm' | 'player'

export type DossierFormat = 'markdown' | 'obsidian' | 'pdf'

export type DossierScope = 'player' | 'dm'

export type PortraitMode = 'token' | 'card' | 'icon'

export type EdgeDirection = 'none' | 'forward' | 'reverse' | 'bidirectional'

export type PartyDisposition =
  | 'Allied'
  | 'Friendly'
  | 'Neutral'
  | 'Suspicious'
  | 'Hostile'
  | 'Unknown'
  | 'Deceased'

export type ItemRarity =
  | 'Common'
  | 'Uncommon'
  | 'Rare'
  | 'Very Rare'
  | 'Legendary'
  | 'Artifact'

export type QuestStatus = 'Rumor' | 'Active' | 'Completed' | 'Failed'

export type DiffStatus = 'added' | 'modified' | 'removed' | null

export type CustomArchetype = 'character' | 'location' | 'item' | 'organization' | 'event'

export type GroupTintKey = 'gold' | 'emerald' | 'blue' | 'rose' | 'purple' | 'amber' | 'slate'

export type GroupBorderStyle = 'dashed' | 'solid' | 'double'

export type GroupShape = 'rounded' | 'sharp' | 'beveled' | 'arch'

export type GroupHeaderAlign = 'left' | 'center'

export type GroupPortraitMode = 'badge' | 'banner' | 'hidden'

export interface CustomEntityType {
  label: string
  color: string
  icon: string
  borderStyle?: 'solid' | 'dashed' | 'dotted'
  archetype?: CustomArchetype
}

export interface CameraBookmark {
  id: string
  label: string
  centerX: number
  centerY: number
  zoom: number
  playerVisible?: boolean
}

export interface FieldDiffEntry {
  field: string
  before: string
  after: string
  isDmOnly?: boolean
}

export interface ConnectionPreset {
  label: string
  color: string
  lineStyle: 'solid' | 'dashed' | 'dotted'
  thickness?: number
  direction?: EdgeDirection
}

export interface DndFields {
  // PC / NPC
  ancestry?: string
  classOrRole?: string
  alignment?: string
  faction?: string
  disposition?: PartyDisposition | ''
  ac?: string
  hp?: string
  voiceCue?: string
  // Location
  region?: string
  locationType?: string
  dangerTier?: string
  // Item
  rarity?: ItemRarity | ''
  attunement?: boolean
  holder?: string
  // Organization
  influence?: string
  headquarters?: string
  goal?: string
  // Event / Quest
  questStatus?: QuestStatus | ''
  sessionDate?: string
}

export type EntityNodeData = {
  label: string
  entityType: EntityType | string
  /** Legacy v1 field — migrated automatically into publicNotes */
  description?: string
  publicNotes?: string
  dmNotes?: string
  partyNotes?: string
  isPlayerCreated?: boolean
  aliases?: string[]
  tags?: string[]
  stats?: string
  portrait?: string
  portraitMode?: PortraitMode
  dndFields?: DndFields
  isHidden?: boolean
  shape?: 'default' | 'box' | 'sticky' | 'pill' | 'leaf' | 'arch' | 'oval' | string
  bgColor?: string
  statusIcons?: string[]
  autoScale?: boolean
  baseScale?: number
  entityWidth?: number
  entityHeight?: number
  // Group Region & Lock properties
  isGroup?: boolean
  groupId?: string
  isLocked?: boolean
  groupWidth?: number
  groupHeight?: number
  hasBackground?: boolean
  groupColor?: GroupTintKey
  groupCustomColor?: string
  groupOpacity?: number
  groupBorderStyle?: GroupBorderStyle
  groupSubtitle?: string
  groupIcon?: string
  groupShape?: GroupShape
  groupHeaderAlign?: GroupHeaderAlign
  groupPortraitMode?: GroupPortraitMode
  // Transient runtime flags (never saved to disk)
  isSearchFaded?: boolean
  isDegreeFaded?: boolean
  isSpotlighted?: boolean
  diffStatus?: DiffStatus
}

export type DndNode = Node<EntityNodeData, 'entity' | 'groupRegion'>

export type DndEdgeData = {
  label?: string
  preset?: string
  color?: string
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  pathStyle?: 'smooth' | 'straight'
  direction?: EdgeDirection
  publicNotes?: string
  dmNotes?: string
  partyNotes?: string
  isPlayerCreated?: boolean
  isHidden?: boolean
  waypoints?: { id: string; x: number; y: number }[]
  thickness?: number
  labelPos?: { x: number; y: number }
  // Transient runtime flags (never saved to disk)
  isSearchFaded?: boolean
  isDegreeFaded?: boolean
  isSpotlighted?: boolean
  diffStatus?: DiffStatus
}

export type DndEdge = Edge<DndEdgeData, 'dndEdge'>

export interface CampaignSnapshot {
  id: string
  title: string
  sessionNumber?: number
  createdAt: string
  summary?: string
  playerVisible?: boolean
  nodes: DndNode[]
  edges: DndEdge[]
}

export interface CampaignFileV2 {
  version: 2
  edition?: CampaignEdition
  campaignTitle?: string
  canvasTheme?: CanvasTheme
  nodes: DndNode[]
  edges: DndEdge[]
  connectionPresets: ConnectionPreset[]
  customEntityTypes: CustomEntityType[]
  snapshots: CampaignSnapshot[]
  cameraBookmarks?: CameraBookmark[]
}

export interface PlayerWindowStatePayload {
  campaignTitle: string
  canvasTheme: CanvasTheme
  nodes: DndNode[]
  edges: DndEdge[]
  connectionPresets: ConnectionPreset[]
  customEntityTypes: CustomEntityType[]
  snapshots: CampaignSnapshot[]
  cameraBookmarks?: CameraBookmark[]
}

export type PlayerWindowCommand =
  | { type: 'syncCenter'; centerX: number; centerY: number; zoom: number }
  | { type: 'spotlight'; targetType: 'node' | 'edge'; id: string }
  | {
      type: 'mysteryPortrait'
      portrait: string
      subtitle?: string
      centerX?: number
      centerY?: number
    }
  | { type: 'clearSpotlight' }

export interface ObsidianVaultEntry {
  relativePath: string
  content: string
  encoding?: 'utf8' | 'base64'
}
