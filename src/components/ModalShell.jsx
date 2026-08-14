import { useEffect, useRef } from 'react'

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function ModalShell({ children, onClose, className = '' }) {
  const modalRef = useRef(null)

  useEffect(() => {
    const modal = modalRef.current
    const preferredField = modal?.querySelector('input:not([disabled]), textarea:not([disabled]), select:not([disabled])')
    const firstControl = modal?.querySelector(focusableSelector)
    window.requestAnimationFrame(() => (preferredField || firstControl)?.focus())
  }, [])

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = [...modalRef.current.querySelectorAll(focusableSelector)]
      .filter((element) => element.getClientRects().length > 0)
    if (!focusable.length) return
    const currentIndex = focusable.indexOf(document.activeElement)
    const direction = event.shiftKey ? -1 : 1
    const nextIndex = currentIndex < 0
      ? (event.shiftKey ? focusable.length - 1 : 0)
      : (currentIndex + direction + focusable.length) % focusable.length
    const nextControl = focusable[nextIndex]
    event.preventDefault()
    nextControl.focus()
    if (nextControl.matches('input, textarea') && nextControl.value) {
      window.requestAnimationFrame(() => {
        try {
          nextControl.select()
        } catch {}
      })
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div ref={modalRef} className={`modal-card ${className}`} role="dialog" aria-modal="true" onKeyDown={handleKeyDown} onMouseDown={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
