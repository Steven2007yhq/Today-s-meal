export const CHINA_TIME_ZONE = 'Asia/Shanghai'

const chinaPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CHINA_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
})

export function getChinaWallClock(reference = new Date()) {
  const parts = Object.fromEntries(chinaPartsFormatter.formatToParts(reference)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]))
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
}

export function getChinaToday(reference = new Date()) {
  const chinaClock = getChinaWallClock(reference)
  return new Date(chinaClock.getFullYear(), chinaClock.getMonth(), chinaClock.getDate())
}

export function formatChinaHeader(reference = new Date()) {
  const date = new Intl.DateTimeFormat('zh-CN', {
    timeZone: CHINA_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(reference)
  const time = new Intl.DateTimeFormat('zh-CN', {
    timeZone: CHINA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(reference)
  return `${date} · 北京时间 ${time}`
}
