import { createRemoteJWKSet, jwtVerify } from 'jose'

const jwksUrl = process.env.NEON_AUTH_JWKS_URL
const authBaseUrl = process.env.NEON_AUTH_BASE_URL

const JWKS = jwksUrl ? createRemoteJWKSet(new URL(jwksUrl)) : null

export async function readSessionUser(req) {
  if (!JWKS || !authBaseUrl) return null

  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) return null

  try {
    const { payload } = await jwtVerify(header.slice('Bearer '.length), JWKS, {
      issuer: new URL(authBaseUrl).origin,
    })
    if (typeof payload.sub !== 'string' || payload.sub === '') return null
    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
    }
  } catch {
    return null
  }
}
