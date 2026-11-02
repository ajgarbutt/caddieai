import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { authClient } from '../auth'
import { disableGuestMode, enableGuestMode, isGuestMode } from '../utils/localStorage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading')
  const [user, setUser] = useState(null)
  const accountPrompt = useRef(false)

  const refresh = useCallback(async () => {
    const result = await authClient.getSession()
    if (result?.data?.session && result.data.user) {
      disableGuestMode()
      accountPrompt.current = false
      setUser(result.data.user)
      setStatus('authenticated')
      return result.data.user
    }
    setUser(null)
    setStatus(isGuestMode() && !accountPrompt.current ? 'guest' : 'anonymous')
    return null
  }, [])

  useEffect(() => {
    refresh().catch(() => {
      setUser(null)
      setStatus(isGuestMode() && !accountPrompt.current ? 'guest' : 'anonymous')
    })
  }, [refresh])

  const continueAsGuest = useCallback(() => {
    enableGuestMode()
    accountPrompt.current = false
    setUser(null)
    setStatus('guest')
  }, [])

  const openAccount = useCallback(() => {
    accountPrompt.current = true
    setStatus('anonymous')
  }, [])

  const signOut = useCallback(async () => {
    await authClient.signOut()
    disableGuestMode()
    accountPrompt.current = false
    setUser(null)
    setStatus('anonymous')
  }, [])

  return (
    <AuthContext.Provider value={{ status, user, refresh, signOut, continueAsGuest, openAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
