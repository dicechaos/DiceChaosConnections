import { useState, useEffect } from 'react'
import { CustomArchetype, CustomEntityType } from '../types'
import { availableIcons } from '../utils/icons'
import { Check, Trash2, X } from 'lucide-react'

interface CustomCategoryManagerProps {
  mode: 'create' | 'edit'
  initialValue?: CustomEntityType
  onSave: (category: CustomEntityType) => void
  onDelete?: () => void
  onCancel: () => void
}

const ARCHETYPE_OPTIONS: Array<{ value: CustomArchetype; label: string; hint: string }> = [
  { value: 'character', label: 'Character / Creature', hint: 'Ancestry, Role, Faction, AC/HP & Disposition' },
  { value: 'organization', label: 'Organization / Army', hint: 'Influence, Headquarters & Faction Goal' },
  { value: 'location', label: 'Location / Realm', hint: 'Region & Location Type' },
  { value: 'item', label: 'Item / Relic', hint: 'Rarity, Attunement & Current Holder' },
  { value: 'event', label: 'Event / Quest / Lore', hint: 'Quest Status & Session Date' }
]

export default function CustomCategoryManager({
  mode,
  initialValue,
  onSave,
  onDelete,
  onCancel
}: CustomCategoryManagerProps) {
  const [label, setLabel] = useState(initialValue?.label || '')
  const [color, setColor] = useState(initialValue?.color || '#6366f1')
  const [icon, setIcon] = useState(initialValue?.icon || 'Star')
  const [borderStyle, setBorderStyle] = useState<'solid' | 'dashed' | 'dotted'>(
    initialValue?.borderStyle || 'solid'
  )
  const [archetype, setArchetype] = useState<CustomArchetype>(
    initialValue?.archetype || 'organization'
  )

  useEffect(() => {
    if (initialValue) {
      setLabel(initialValue.label)
      setColor(initialValue.color)
      setIcon(initialValue.icon || 'Star')
      setBorderStyle(initialValue.borderStyle || 'solid')
      setArchetype(initialValue.archetype || 'organization')
    }
  }, [initialValue])

  const handleSubmit = () => {
    const clean = label.trim()
    if (!clean) return
    onSave({
      label: clean,
      color,
      icon,
      borderStyle,
      archetype
    })
  }

  return (
    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col gap-2.5 mt-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
          {mode === 'create' ? 'New Custom Category' : `Edit "${initialValue?.label}"`}
        </span>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close category editor"
          className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      <input
        type="text"
        placeholder="Category Name (e.g. Army / Host, Deity, Clue)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleSubmit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded p-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          D&amp;D Sheet Template
        </label>
        <select
          value={archetype}
          onChange={(e) => setArchetype(e.target.value as CustomArchetype)}
          className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ARCHETYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-slate-400">
          {ARCHETYPE_OPTIONS.find((o) => o.value === archetype)?.hint}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between gap-1.5 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800">
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-6 h-5 cursor-pointer border-0 bg-transparent p-0"
          />
        </div>
        <select
          value={borderStyle}
          onChange={(e) => setBorderStyle(e.target.value as any)}
          aria-label="Category border style"
          className="border border-slate-300 dark:border-slate-700 rounded p-1 text-xs bg-white dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="solid">Solid Border</option>
          <option value="dashed">Dashed Border</option>
          <option value="dotted">Dotted Border</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Icon</span>
        <div className="dcc-scroll-y grid grid-cols-6 gap-1 bg-white dark:bg-[#0a1022] p-1.5 rounded border border-slate-200 dark:border-slate-700 max-h-24 overflow-y-auto">
          {Object.entries(availableIcons).map(([name, IconComp]) => (
            <button
              key={name}
              type="button"
              onClick={() => setIcon(name)}
              className={`p-1 flex items-center justify-center rounded transition-colors cursor-pointer ${
                icon === name
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
              title={name}
            >
              <IconComp size={14} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-1.5 pt-1">
        {mode === 'edit' && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="px-2 py-1 text-xs font-semibold bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 rounded flex items-center gap-1 cursor-pointer"
          >
            <Trash2 size={12} /> Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-2.5 py-1 text-xs font-medium bg-slate-200 dark:bg-slate-700 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 cursor-pointer"
          >
            <Check size={12} /> {mode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
