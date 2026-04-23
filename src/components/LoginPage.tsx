import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '../lib/supabaseClient'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

const AUTH_HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: 'Unified command center',
    description: 'Move from landing to roster control without switching visual context.',
  },
  {
    icon: ShieldCheck,
    title: 'Clean account flow',
    description: 'Use the same polished drawer and auth surfaces as the rest of the app.',
  },
  {
    icon: LockKeyhole,
    title: 'Fast return path',
    description: 'Jump straight back into your user or admin dashboards after auth.',
  },
] as const

export default function LoginPage() {
  const navigate = useNavigate()
  const [isSignUp, setIsSignUp] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const authEmail = `${username.trim()}@dragonnest.local`

      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: authEmail,
          password,
        })

        if (signUpError) {
          throw signUpError
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password,
        })

        if (signInError) {
          throw signInError
        }
      }

      navigate('/dashboard')
    } catch (submitError) {
      setError(
        getErrorMessage(
          submitError,
          `Failed to ${isSignUp ? 'sign up' : 'sign in'}.`,
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-panel">
      <div className="auth-panel__copy">
        <div className="eyebrow">
          <Sparkles size={14} />
          Dragon Nest access
        </div>
        <h2>Open the command center and get every character back in formation.</h2>
        <p>
          Sign in with your Dragon Nest username to manage accounts, review patchnotes,
          and keep the weekly loop visible from one polished dashboard.
        </p>

        <div className="auth-highlight-list">
          {AUTH_HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="auth-highlight">
              <span className="auth-highlight__icon">
                <Icon size={18} />
              </span>
              <div>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-card__header">
          <div className="eyebrow">
            <UserRound size={14} />
            {isSignUp ? 'Create access' : 'Sign in'}
          </div>
          <strong>{isSignUp ? 'Create your roster login' : 'Return to your roster'}</strong>
          <p>{isSignUp ? 'Build a fresh command-center account.' : 'Use your existing Dragon Nest username.'}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field auth-field-group">
            <span className="field__label">Username</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter your Dragon Nest username"
              required
            />
          </label>

          <label className="field auth-field-group">
            <span className="field__label">Password</span>
            <div className="auth-password">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="icon-button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {error ? (
            <div className="inline-error" role="alert">
              <LockKeyhole size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Processing…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="auth-footer">
          {isSignUp ? 'Already have access? ' : "Don't have an account yet? "}
          <button
            type="button"
            className="auth-toggle"
            onClick={() => setIsSignUp((current) => !current)}
          >
            {isSignUp ? 'Sign in instead' : 'Create one now'}
          </button>
        </p>
      </div>
    </section>
  )
}
