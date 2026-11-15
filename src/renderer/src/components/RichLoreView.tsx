import { useState, useRef, Fragment, ReactNode } from 'react'
import { DndNode } from '../types'
import { resolveWikiTargetNode } from '../utils/wikiLinks'
import { Link2 } from 'lucide-react'

interface RichLoreViewProps {
  text?: string
  nodes: DndNode[]
  isPlayerView: boolean
  onNavigateToNode?: (nodeId: string) => void
  emptyText?: string
}

function renderInlineFormatting(
  line: string,
  nodes: DndNode[],
  isPlayerView: boolean,
  onNavigateToNode?: (nodeId: string) => void
): ReactNode[] {
  // Tokenize [[Wiki Links]], **bold**, *italic*, and `code`
  const tokenRegex = /(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  const parts = line.split(tokenRegex)

  return parts.map((part, idx) => {
    if (!part) return null

    if (part.startsWith('[[') && part.endsWith(']]')) {
      const rawInner = part.slice(2, -2)
      const { node: matchedNode, displayText } = resolveWikiTargetNode(
        rawInner,
        nodes,
        isPlayerView
      )

      if (matchedNode) {
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onNavigateToNode?.(matchedNode.id)}
            title={`Jump to ${matchedNode.data.label}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/60 hover:bg-blue-100 dark:hover:bg-blue-800/60 text-xs font-semibold transition-colors align-baseline cursor-pointer"
          >
            <Link2 size={11} aria-hidden="true" />
            <span>{displayText}</span>
          </button>
        )
      }
      return (
        <span
          key={idx}
          className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 text-xs font-medium"
        >
          {displayText}
        </span>
      )
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold text-slate-900 dark:text-slate-100">
          {part.slice(2, -2)}
        </strong>
      )
    }

    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={idx} className="italic">
          {part.slice(1, -1)}
        </em>
      )
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-900 font-mono text-xs text-amber-700 dark:text-amber-300"
        >
          {part.slice(1, -1)}
        </code>
      )
    }

    return <Fragment key={idx}>{part}</Fragment>
  })
}

export function RichLoreView({
  text,
  nodes,
  isPlayerView,
  onNavigateToNode,
  emptyText = 'No notes recorded.'
}: RichLoreViewProps) {
  if (!text || !text.trim()) {
    return <p className="text-xs text-slate-400 dark:text-slate-500 italic">{emptyText}</p>
  }

  const lines = text.split('\n')

  return (
    <div className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
      {lines.map((rawLine, i) => {
        const trimmed = rawLine.trim()
        if (!trimmed) {
          return <div key={i} className="h-1" />
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={i} className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
              {renderInlineFormatting(trimmed.slice(4), nodes, isPlayerView, onNavigateToNode)}
            </h4>
          )
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={i} className="flex items-start gap-2 pl-1">
              <span className="text-slate-400 select-none mt-0.5">•</span>
              <span className="flex-1">
                {renderInlineFormatting(trimmed.slice(2), nodes, isPlayerView, onNavigateToNode)}
              </span>
            </div>
          )
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {renderInlineFormatting(rawLine, nodes, isPlayerView, onNavigateToNode)}
          </p>
        )
      })}
    </div>
  )
}

interface WikiLinkTextareaProps {
  value: string
  onChange: (next: string) => void
  onCommitStart?: () => void
  nodes: DndNode[]
  hideSecrets?: boolean
  placeholder?: string
  rows?: number
  className?: string
}

export function WikiLinkTextarea({
  value,
  onChange,
  onCommitStart,
  nodes,
  hideSecrets = false,
  placeholder,
  rows = 4,
  className = ''
}: WikiLinkTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasRecordedInSession = useRef(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(0)
  const [activeIndex, setActiveIndex] = useState(0)

  const candidates =
    mentionQuery !== null
      ? nodes
          .filter((n) => {
            if (hideSecrets && n.data?.isHidden) return false
            const q = mentionQuery.toLowerCase()
            if (n.data?.label?.toLowerCase().includes(q)) return true
            return (n.data?.aliases || []).some((a) => a.toLowerCase().includes(q))
          })
          .slice(0, 8)
      : []

  const detectWikiTrigger = (text: string, caret: number) => {
    const uptoCaret = text.slice(0, caret)
    const openIdx = uptoCaret.lastIndexOf('[[')
    if (openIdx === -1) {
      setMentionQuery(null)
      return
    }
    const between = uptoCaret.slice(openIdx + 2)
    if (between.includes(']]') || between.includes('\n')) {
      setMentionQuery(null)
      return
    }
    setMentionStartIndex(openIdx)
    setMentionQuery(between)
    setActiveIndex(0)
  }

  const insertCandidate = (label: string) => {
    const el = textareaRef.current
    if (!el) return
    const caret = el.selectionStart ?? value.length
    const before = value.slice(0, mentionStartIndex)
    const after = value.slice(caret)
    const inserted = `${before}[[${label}]]${after}`
    if (!hasRecordedInSession.current) {
      hasRecordedInSession.current = true
      onCommitStart?.()
    }
    onChange(inserted)
    setMentionQuery(null)
    requestAnimationFrame(() => {
      const nextCaret = before.length + label.length + 4
      el.focus()
      el.setSelectionRange(nextCaret, nextCaret)
    })
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onFocus={() => {
          hasRecordedInSession.current = false
        }}
        onBlur={() => {
          hasRecordedInSession.current = false
          setTimeout(() => setMentionQuery(null), 150)
        }}
        onChange={(e) => {
          if (!hasRecordedInSession.current) {
            hasRecordedInSession.current = true
            onCommitStart?.()
          }
          onChange(e.target.value)
          detectWikiTrigger(e.target.value, e.target.selectionStart ?? e.target.value.length)
        }}
        onKeyDown={(e) => {
          if (mentionQuery !== null && candidates.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiveIndex((prev) => (prev + 1) % candidates.length)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIndex((prev) => (prev - 1 + candidates.length) % candidates.length)
            } else if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault()
              insertCandidate(candidates[activeIndex].data.label)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              setMentionQuery(null)
            }
          }
        }}
        className={
          className ||
          'border border-slate-300 dark:border-slate-700 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 w-full resize-y'
        }
      />

      {mentionQuery !== null && candidates.length > 0 && (
        <div className="absolute left-0 right-0 bottom-full mb-1 z-30 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl py-1 max-h-48 overflow-y-auto">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Link Entity ([[Name]] or [[Name|Display]])
          </div>
          {candidates.map((cand, idx) => {
            const matchedAlias =
              mentionQuery &&
              !cand.data.label.toLowerCase().includes(mentionQuery.toLowerCase())
                ? (cand.data.aliases || []).find((a) =>
                    a.toLowerCase().includes(mentionQuery.toLowerCase())
                  )
                : undefined
            return (
              <button
                key={cand.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  insertCandidate(cand.data.label)
                }}
                className={`w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between transition-colors ${
                  idx === activeIndex
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                }`}
              >
                <span className="truncate">
                  {cand.data.label}
                  {matchedAlias && (
                    <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                      (aka {matchedAlias})
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-slate-400 ml-2 shrink-0">
                  {cand.data.entityType}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
