import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMonthCells,
  calendarDateKey,
  dateFromCalendarKey,
  mealsForCalendarDate,
  sameCalendarDate,
} from '../src/services/mealPlanner.js'

test('calendar keys round-trip and reject impossible dates', () => {
  const leapDay = new Date(2028, 1, 29)
  assert.equal(calendarDateKey(leapDay), '2028-02-29')
  assert.equal(calendarDateKey(dateFromCalendarKey('2028-02-29')), '2028-02-29')
  assert.equal(dateFromCalendarKey('2027-02-29'), null)
  assert.equal(dateFromCalendarKey('not-a-date'), null)
})

test('month grid always starts on Monday and contains six full weeks', () => {
  const cells = buildMonthCells(new Date(2026, 8, 1))
  assert.equal(cells.length, 42)
  assert.equal(cells[0].date.getDay(), 1)
  assert.equal(calendarDateKey(cells[0].date), '2026-08-31')
  assert.equal(cells.filter((cell) => cell.currentMonth).length, 30)
})

test('planner prefers current and explicitly saved meals before fallbacks', () => {
  const today = new Date(2026, 7, 13)
  const currentMeals = [{ title: '今天的饭' }]
  assert.equal(mealsForCalendarDate(new Date(2026, 7, 13), currentMeals, {}, { today }), currentMeals)

  const savedMeals = [{ title: '保存的饭' }]
  assert.equal(
    mealsForCalendarDate(new Date(2026, 7, 14), currentMeals, { '2026-08-14': savedMeals }, { today }),
    savedMeals,
  )
})

test('planner creates stable fallback IDs and independent meal objects', () => {
  const date = new Date(2026, 7, 17)
  const meals = mealsForCalendarDate(date, [], {}, { today: new Date(2026, 7, 13) })
  assert.equal(meals.length, 3)
  assert.equal(meals[0].calendarId, '2026-08-17-0')
  assert.equal(meals[0].title, '紫薯燕麦碗')
  assert.equal(meals[0].done, false)
  assert.equal(sameCalendarDate(date, new Date(2026, 7, 17, 23, 59)), true)
})
