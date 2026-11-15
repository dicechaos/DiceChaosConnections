import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import PlayerScreenApp from './components/PlayerScreenApp'

// Initialize color-scheme meta & root class before first React paint
try {
  const storedScheme = localStorage.getItem('color-scheme')
  const meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null
  const validOverride = storedScheme === 'light' || storedScheme === 'dark' ? storedScheme : null
  if (meta) {
    meta.content = validOverride ?? 'light dark'
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolvedDark = validOverride ? validOverride === 'dark' : prefersDark
  document.documentElement.classList.toggle('dark', resolvedDark)
} catch {
  // Ignore storage restrictions
}

const isPlayerScreenWindow =
  new URLSearchParams(window.location.search).get('windowMode') === 'playerScreen'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPlayerScreenWindow ? <PlayerScreenApp /> : <App />}
  </StrictMode>
)
