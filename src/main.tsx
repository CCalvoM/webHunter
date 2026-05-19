import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 0,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
  })
}

if (import.meta.env.VITE_UMAMI_WEBSITE_ID) {
  const script = document.createElement('script')
  script.defer = true
  script.src = import.meta.env.VITE_UMAMI_SCRIPT_URL || 'https://cloud.umami.is/script.js'
  script.setAttribute('data-website-id', import.meta.env.VITE_UMAMI_WEBSITE_ID)
  document.head.appendChild(script)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={
      <div className="p-8 text-center">
        <p className="text-sm text-red-600 font-medium">Algo ha ido mal. Por favor, recarga la página.</p>
      </div>
    }>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
