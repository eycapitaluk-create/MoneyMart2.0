import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import { installChunkErrorRecovery } from './lib/lazyWithRetry'
import { bootstrapSupabaseAuthFromUrl } from './lib/bootstrapSupabaseAuthFromUrl'
import App from './App.jsx'

installChunkErrorRecovery()

const rootElement = document.getElementById('root')
const staticFallbackElement = document.getElementById('static-seo-fallback')

async function mountApp() {
  try {
    await bootstrapSupabaseAuthFromUrl()
  } catch {
    /* session bootstrap is best-effort */
  }

  const app = (
    <StrictMode>
      <HelmetProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HelmetProvider>
    </StrictMode>
  )

  if (rootElement?.hasChildNodes()) {
    hydrateRoot(rootElement, app)
  } else {
    createRoot(rootElement).render(app)
  }

  if (staticFallbackElement) {
    staticFallbackElement.remove()
  }
}

void mountApp()
