const PAGE_SHORTCUTS = Object.freeze({
  1: 'today',
  2: 'calendar',
  3: 'library',
  4: 'report',
  5: 'favorites',
})

const MODULE_SHORTCUTS = Object.freeze({
  1: 'standard',
  2: 'family',
  3: 'elder',
  4: 'fitness',
})

export function resolveKeyboardShortcut(event) {
  if (event.defaultPrevented || event.repeat) return null

  const key = String(event.key || '').toLowerCase()
  const withCommand = Boolean(event.ctrlKey || event.metaKey)

  if (event.altKey && key === 'arrowleft') return { type: 'history', direction: 'back' }
  if (event.altKey && key === 'arrowright') return { type: 'history', direction: 'forward' }
  if (event.altKey && MODULE_SHORTCUTS[key]) return { type: 'module', target: MODULE_SHORTCUTS[key] }

  if (withCommand && event.shiftKey && key === 'a') return { type: 'assistant' }
  if (withCommand && PAGE_SHORTCUTS[key]) return { type: 'page', target: PAGE_SHORTCUTS[key] }
  if (withCommand && key === 'k') return { type: 'search' }
  if (withCommand && key === ',') return { type: 'settings' }
  if (withCommand && key === '/') return { type: 'document', target: 'keyboard-shortcuts' }

  if (key === 'f1') return { type: 'document', target: 'user-guide' }
  if (key === 'escape') return { type: 'close-overlay' }
  return null
}
