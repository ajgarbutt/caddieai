import { authClient } from '../auth'

function sessionJwt(result) {
  const token = result?.data?.token || result?.data?.session?.token
  if (typeof token !== 'string' || token.split('.').length !== 3) return null
  return token
}

async function authFetch(path, options = {}) {
  const tokenResult = await authClient.token()
  const token = sessionJwt(tokenResult)
  if (tokenResult?.error || !token) {
    throw new Error('Not signed in')
  }

  return fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function fetchPlayerState() {
  const response = await authFetch('/api/state')
  if (response.status === 401) throw new Error('Not signed in')
  if (!response.ok) throw new Error('Could not load your saved data.')
  const body = await response.json()
  return body.document ?? null
}

export async function savePlayerState(document) {
  const response = await authFetch('/api/state', {
    method: 'PUT',
    body: JSON.stringify(document),
  })
  if (!response.ok) throw new Error('Could not save your latest changes.')
}
