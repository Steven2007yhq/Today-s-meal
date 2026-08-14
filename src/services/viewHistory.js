const MAX_VIEW_HISTORY = 50

export function createViewHistory(initialView) {
  return {
    entries: [{ ...initialView }],
    index: 0,
  }
}

export function getCurrentView(history) {
  return history.entries[history.index]
}

export function pushView(history, nextView) {
  const currentView = getCurrentView(history)
  if (currentView.page === nextView.page && currentView.module === nextView.module) return history

  const entries = [...history.entries.slice(0, history.index + 1), { ...nextView }]
    .slice(-MAX_VIEW_HISTORY)

  return {
    entries,
    index: entries.length - 1,
  }
}

export function moveViewHistory(history, offset) {
  const index = Math.min(
    history.entries.length - 1,
    Math.max(0, history.index + offset),
  )

  return index === history.index ? history : { ...history, index }
}
