import { useState } from 'react'
import { authClient } from '../auth'
import { useAuth } from '../context/AuthContext'
import Button from '../components/Button'

export default function Login() {
  const { refresh, continueAsGuest } = useAuth()
  const [mode, setMode] = useState('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const isSignUp = mode === 'sign-up'

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setPending(true)

    try {
      const result = isSignUp
        ? await authClient.signUp.email({
            name: email.split('@')[0] || 'Player',
            email: email.trim(),
            password,
          })
        : await authClient.signIn.email({
            email: email.trim(),
            password,
          })

      if (result?.error) {
        setError(result.error.message || 'Could not sign you in.')
        return
      }

      const user = await refresh()
      if (!user) {
        setError(
          isSignUp
            ? 'Account created. Sign in with that email and password.'
            : 'Sign-in did not start a session. Try again.'
        )
      }
    } catch (err) {
      setError(err?.message || 'Could not sign you in.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-center px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-dark-green">CaddieAI</h1>
      <p className="mb-6 text-sm text-dark-green/75">
        {isSignUp
          ? 'Create an account to keep your clubs and rounds.'
          : 'Sign in to open your clubs and rounds.'}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-semibold text-dark-green">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full min-h-[52px] rounded-xl border-2 border-gray-200 bg-white px-4 text-base text-dark-green placeholder:text-gray-400 focus:border-dark-green focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-semibold text-dark-green">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full min-h-[52px] rounded-xl border-2 border-gray-200 bg-white px-4 text-base text-dark-green placeholder:text-gray-400 focus:border-dark-green focus:outline-none"
          />
        </div>

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth disabled={pending}>
          {pending ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <button
        type="button"
        className="mt-4 min-h-[44px] text-sm font-semibold text-dark-green underline"
        onClick={() => {
          setMode(isSignUp ? 'sign-in' : 'sign-up')
          setError('')
        }}
      >
        {isSignUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
      </button>

      <button
        type="button"
        className="mt-2 min-h-[44px] text-sm font-semibold text-dark-green underline"
        onClick={continueAsGuest}
      >
        Continue without registering
      </button>
      <p className="text-center text-xs text-gray-600">
        Clubs and rounds stay on this device only.
      </p>
    </div>
  )
}
