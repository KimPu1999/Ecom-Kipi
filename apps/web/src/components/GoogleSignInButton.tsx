import { useEffect, useRef, useState } from 'react'

type GoogleCredentialResponse = { credential?: string }

type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void; cancel_on_tap_outside?: boolean }) => void
      renderButton: (parent: HTMLElement, options: { theme: string; size: string; text: string; shape: string; logo_alignment: string; width: number }) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentityServices
  }
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''
const googleScriptUrl = 'https://accounts.google.com/gsi/client'
let googleScriptPromise: Promise<void> | null = null

function loadGoogleScript(): Promise<void> {
  if (window.google) return Promise.resolve()
  if (googleScriptPromise) return googleScriptPromise

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${googleScriptUrl}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Google sign-in could not be loaded.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = googleScriptUrl
    script.async = true
    script.defer = true
    script.dataset.thangpcGoogle = 'true'
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('Google sign-in could not be loaded.')), { once: true })
    document.head.appendChild(script)
  })

  return googleScriptPromise
}

function GoogleGlyph() {
  return <span className="google-glyph" aria-hidden="true">G</span>
}

export function GoogleSignInButton({ onCredential, onError, disabled = false }: { onCredential: (credential: string) => void; onError?: (message: string) => void; disabled?: boolean }) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const onCredentialRef = useRef(onCredential)
  const onErrorRef = useRef(onError)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable' | 'error'>(googleClientId ? 'loading' : 'unavailable')

  useEffect(() => {
    onCredentialRef.current = onCredential
    onErrorRef.current = onError
  }, [onCredential, onError])

  useEffect(() => {
    if (!googleClientId) return

    let active = true
    void loadGoogleScript()
      .then(() => {
        if (!active || !buttonRef.current || !window.google) return

        window.google.accounts.id.initialize({
          client_id: googleClientId,
          cancel_on_tap_outside: true,
          callback: (response) => {
            if (response.credential) onCredentialRef.current(response.credential)
          },
        })
        buttonRef.current.replaceChildren()
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          width: 360,
        })
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (!active) return
        setStatus('error')
        onErrorRef.current?.(error instanceof Error ? error.message : 'Google sign-in is temporarily unavailable.')
      })

    return () => {
      active = false
      buttonRef.current?.replaceChildren()
    }
  }, [])

  if (status === 'unavailable') {
    return <button className="google-button google-button-disabled" type="button" disabled title="Google sign-in needs to be configured first"><GoogleGlyph />Continue with Google</button>
  }

  if (status === 'error') {
    return <button className="google-button google-button-disabled" type="button" disabled><GoogleGlyph />Google sign-in unavailable</button>
  }

  return <div className={`google-button-host ${disabled ? 'is-disabled' : ''}`} aria-busy={status === 'loading'}><div ref={buttonRef} />{status === 'loading' ? <span className="google-button-loading"><GoogleGlyph />Loading Google sign-in…</span> : null}</div>
}
