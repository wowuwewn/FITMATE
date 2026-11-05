import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// Native modal semantics provide focus trapping, Escape and an inert background.
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!
    const previousFocus = document.activeElement as HTMLElement | null
    const shell = document.querySelector<HTMLElement>('.app-shell')
    const rootOverflow = document.documentElement.style.overflow
    const shellOverflow = shell?.style.overflowY ?? ''
    element.showModal()
    document.documentElement.style.overflow = 'hidden'
    if (shell) shell.style.overflowY = 'hidden'
    return () => {
      element.close()
      document.documentElement.style.overflow = rootOverflow
      if (shell) shell.style.overflowY = shellOverflow
      previousFocus?.focus({ preventScroll: true })
    }
  }, [])
  return createPortal(<dialog ref={dialog} className="sheet" aria-label={title} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.target === event.currentTarget && (event.clientY < rect.top || event.clientY > rect.bottom || event.clientX < rect.left || event.clientX > rect.right)) onClose()
  }}>
    <header className="sheet-header"><h2>{title}</h2><button className="icon-button" aria-label={`${title} 닫기`} onClick={onClose} autoFocus><X /></button></header>
    <div className="sheet-content">{children}</div>
  </dialog>, document.body)
}
