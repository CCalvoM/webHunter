import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'

export default function Login() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
                <circle cx="8" cy="8" r="5" stroke="white" strokeWidth="1.8"/>
                <line x1="12" y1="12" x2="16" y2="16" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-display font-bold text-2xl text-ink">Cloza</span>
          </div>
          <p className="text-ink-muted text-sm">Autogestiona tus ventas de páginas web</p>
        </div>

        {/* Auth UI */}
        <div className="card shadow-sm">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#e85d2f',
                    brandAccent: '#c0401a',
                    inputBackground: 'white',
                    inputBorder: 'rgba(26,24,20,0.15)',
                    inputBorderFocus: '#e85d2f',
                    inputText: '#1a1814',
                    inputPlaceholder: '#b5b3ae',
                  },
                  radii: {
                    borderRadiusButton: '100px',
                    buttonBorderRadius: '100px',
                    inputBorderRadius: '8px',
                  },
                  fonts: {
                    bodyFontFamily: 'DM Sans, sans-serif',
                    buttonFontFamily: 'DM Sans, sans-serif',
                  },
                },
              },
              style: {
                button: { fontWeight: '500', fontSize: '14px' },
                anchor: { color: '#e85d2f' },
                label: { fontSize: '13px', color: '#6b6760', marginBottom: '4px' },
              },
            }}
            providers={['google']}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Email',
                  password_label: 'Contraseña',
                  button_label: 'Entrar',
                  social_provider_text: 'Entrar con {{provider}}',
                  link_text: '¿Ya tienes cuenta? Entra aquí',
                },
                sign_up: {
                  email_label: 'Email',
                  password_label: 'Contraseña',
                  button_label: 'Crear cuenta gratis',
                  social_provider_text: 'Registrarse con {{provider}}',
                  link_text: '¿No tienes cuenta? Regístrate gratis',
                },
              },
            }}
            redirectTo={`${window.location.origin}/app`}
          />
        </div>

        <p className="text-center text-xs text-ink-faint mt-4">
          Los primeros 200 usuarios acceden al plan Pro gratis 3 meses.
        </p>

      </div>
    </div>
  )
}
