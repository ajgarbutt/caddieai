import { createAuthClient } from '@neondatabase/auth'
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'

function authBaseUrl() {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/neon-auth`
  }
  return import.meta.env.VITE_NEON_AUTH_URL
}

export const authClient = createAuthClient(authBaseUrl(), {
  adapter: BetterAuthReactAdapter({
    fetchOptions: { credentials: 'include' },
  }),
})
