import { initialMeals, mealSlots, weekPlan } from '../data/mealPlan.js'
import { getChinaToday } from '../utils/chinaTime.js'

export function sameCalendarDate(firstDate, secondDate) {
  return firstDate.getFullYear() === secondDate.getFullYear()
    && firstDate.getMonth() === secondDate.getMonth()
    && firstDate.getDate() === secondDate.getDate()
}

export function buildMonthCells(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const mondayBasedOffset = (new Date(year, month, 1).getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, index - mondayBasedOffset + 1)
    return { date, currentMonth: date.getMonth() === month }
  })
}

export function calendarDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateFromCalendarKey(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''))
  if (!match) return null
  const [, yearText, monthText, dayText] = match
  const date = new Date(Number(yearText), Number(monthText) - 1, Number(dayText))
  return calendarDateKey(date) === dateKey ? date : null
}

export function mealsForCalendarDate(date, meals, calendarMealsByDate = {}, options = {}) {
  const today = options.today || getChinaToday()
  if (sameCalendarDate(date, today)) return meals
  const dateKey = calendarDateKey(date)
  if (Array.isArray(calendarMealsByDate[dateKey])) return calendarMealsByDate[dateKey]
  const mondayBasedDay = (date.getDay() + 6) % 7
  const plan = options.weekPlan || weekPlan
  const slots = options.mealSlots || mealSlots
  const fallbackMeals = options.initialMeals || initialMeals
  return plan[mondayBasedDay].slice(1).map((title, index) => ({
    ...slots[index],
    calendarId: `${dateKey}-${index}`,
    title,
    description: '由循环食谱自动安排，可点击继续调整食材与用量。',
    tag: '循环食谱',
    image: fallbackMeals[index]?.image,
    done: false,
    portionMultiplier: 1,
  }))
}
