import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// The loader markup lives in index.html so it paints before this bundle arrives.
// On a slow connection it simply stays up until the app is ready to draw.
const loaderMinimumDuration = 420
const loaderFailsafeDuration = 8000
const loaderStartedAt = performance.now()

function hideAppLoader() {
  const loader = document.getElementById('app-loader')
  if (!loader) return
  loader.classList.add('is-hidden')
  window.setTimeout(() => loader.remove(), 320)
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Two frames after render the first paint has landed; hold the loader a beat
// longer so a fast local load does not flash it on and off.
window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
  const remaining = Math.max(loaderMinimumDuration - (performance.now() - loaderStartedAt), 0)
  window.setTimeout(hideAppLoader, remaining)
}))

// Failsafe: a render error must never leave the user staring at a grey screen.
window.setTimeout(hideAppLoader, loaderFailsafeDuration)
