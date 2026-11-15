import { useEffect, useId, useRef, ReactNode } from 'react'
import { X } from 'lucide-react'

interface NativeModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidthClass?: string
  lightDismiss?: boolean
}

export function NativeModal({
  open,
  onClose,
  title,
  children,
  maxWidthClass = 'max-w-md',
  lightDismiss = true
}: NativeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => {
      dialog.returnValue = ''
      onClose()
    }

    dialog.addEventListener('close', handleClose)

    // Fallback light-dismiss where native `closedBy` is unavailable
    let cleanupOutside: (() => void) | undefined
    if (lightDismiss && !('closedBy' in HTMLDialogElement.prototype)) {
      let pressedOutside = false
      const isOutside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect()
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
      }
      const onDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e)
      }
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e)) {
          dialog.close()
        }
      }
      dialog.addEventListener('pointerdown', onDown)
      dialog.addEventListener('pointerup', onUp)
      cleanupOutside = () => {
        dialog.removeEventListener('pointerdown', onDown)
        dialog.removeEventListener('pointerup', onUp)
      }
    }

    return () => {
      dialog.removeEventListener('close', handleClose)
      cleanupOutside?.()
    }
  }, [onClose, lightDismiss])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: lightDismiss ? 'any' : 'closerequest' } as any)}
      className={`no-export m-auto w-[92vw] ${maxWidthClass} rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl p-0 open:flex open:flex-col`}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60">
        <h2 id={titleId} className="text-base font-bold text-slate-800 dark:text-slate-100">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Close dialog"
          onClick={() => dialogRef.current?.close()}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
      <div className="p-5 overflow-y-auto max-h-[80vh]">{children}</div>
    </dialog>
  )
}

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = true,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  return (
    <NativeModal open={open} onClose={onCancel} title={title} maxWidthClass="max-w-sm">
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm()
            onCancel()
          }}
          className={`px-3.5 py-1.5 rounded-md text-sm font-semibold text-white transition-colors ${
            destructive
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </NativeModal>
  )
}
