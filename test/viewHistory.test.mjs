import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createViewHistory,
  getCurrentView,
  moveViewHistory,
  pushView,
} from '../src/services/viewHistory.js'

test('view history supports backward and forward navigation', () => {
  let history = createViewHistory({ module: 'standard', page: 'today' })
  history = pushView(history, { module: 'standard', page: 'calendar' })
  history = pushView(history, { module: 'standard', page: 'library' })

  history = moveViewHistory(history, -1)
  assert.equal(getCurrentView(history).page, 'calendar')

  history = moveViewHistory(history, 1)
  assert.equal(getCurrentView(history).page, 'library')
})

test('new navigation after going back clears the forward branch', () => {
  let history = createViewHistory({ module: 'standard', page: 'today' })
  history = pushView(history, { module: 'standard', page: 'calendar' })
  history = pushView(history, { module: 'standard', page: 'library' })
  history = moveViewHistory(history, -1)
  history = pushView(history, { module: 'standard', page: 'report' })

  assert.deepEqual(history.entries.map((entry) => entry.page), ['today', 'calendar', 'report'])
  assert.equal(history.index, 2)
})

test('duplicate views and out-of-range moves do not change history', () => {
  const history = createViewHistory({ module: 'standard', page: 'today' })
  assert.equal(pushView(history, { module: 'standard', page: 'today' }), history)
  assert.equal(moveViewHistory(history, -1), history)
  assert.equal(moveViewHistory(history, 1), history)
})
