import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const appSource = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const librarySource = fs.readFileSync(new URL('../src/components/DishLibraryView.jsx', import.meta.url), 'utf8')
const mainSource = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const globalStyles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const libraryStyles = fs.readFileSync(new URL('../src/styles/dish-library.css', import.meta.url), 'utf8')

function contrastRatio(foreground, background) {
  const luminance = (hex) => {
    const channels = hex.match(/[0-9a-f]{2}/gi).map((channel) => Number.parseInt(channel, 16) / 255)
      .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  }
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

test('dish library lives outside the application shell', () => {
  assert.match(appSource, /import \{ DishLibraryView \} from '\.\/components\/DishLibraryView'/)
  assert.doesNotMatch(appSource, /function DishLibraryView/)
  assert.ok(appSource.split(/\r?\n/).length < 2_000)
  assert.match(mainSource, /import '\.\/styles\/dish-library\.css'/)
})

test('dish detail is an accessible dismissible dialog', () => {
  assert.match(librarySource, /role="dialog"/)
  assert.match(librarySource, /aria-modal="true"/)
  assert.match(librarySource, /aria-labelledby="dish-detail-title"/)
  assert.match(librarySource, /event\.key === 'Escape'/)
  assert.match(librarySource, /previousFocus\.focus/)
  assert.match(librarySource, /dish-detail-backdrop/)
})

test('typography and zoom layout keep explicit accessibility floors', () => {
  assert.match(globalStyles, /min-width:\s*720px/)
  assert.match(globalStyles, /Body copy and form text never drops below 12px/)
  assert.match(globalStyles, /font-size:\s*12px !important/)
  assert.match(globalStyles, /--action:\s*#b94724/)
  assert.match(libraryStyles, /font-size:\s*12px/)
  assert.match(libraryStyles, /@media \(max-width:\s*900px\)/)
  assert.match(libraryStyles, /@media \(max-width:\s*720px\)/)
  assert.match(libraryStyles, /width:\s*min\(520px, calc\(100vw - 24px\)\)/)
  assert.ok(contrastRatio('756d64', 'f5f3ed') >= 4.5)
  assert.ok(contrastRatio('6f675f', 'fffefd') >= 4.5)
  for (const actionColor of ['b94724', '8a4e00', '207761', '394fb8']) {
    assert.ok(contrastRatio(actionColor, 'ffffff') >= 4.5)
  }
})

test('drawer motion respects reduced-motion preferences', () => {
  assert.match(libraryStyles, /@media \(prefers-reduced-motion:\s*reduce\)/)
  assert.match(libraryStyles, /\.dish-detail,[\s\S]*\.dish-detail-backdrop \{ animation:\s*none;/)
})
