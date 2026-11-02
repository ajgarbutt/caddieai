const HOP_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'accept-encoding',
  'transfer-encoding',
  // Neon Auth treats this as its own hostname and rejects the public site host.
  'x-forwarded-host',
])

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      resolve(undefined)
      return
    }

    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function rewriteCookie(cookie) {
  return cookie.replace(/;\s*Domain=[^;]*/gi, '')
}

export default async function handler(req, res) {
  const baseUrl = process.env.NEON_AUTH_BASE_URL
  if (!baseUrl) {
    res.status(500).json?.({ error: 'Auth is not configured.' })
    if (!res.writableEnded) res.end(JSON.stringify({ error: 'Auth is not configured.' }))
    return
  }

  const incoming = new URL(req.url, 'http://localhost')
  const prefix = '/api/neon-auth'
  const suffix = incoming.pathname.startsWith(prefix)
    ? incoming.pathname.slice(prefix.length)
    : ''
  const target = new URL(`${baseUrl.replace(/\/$/, '')}${suffix}${incoming.search}`)

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null || HOP_HEADERS.has(key.toLowerCase())) continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value))
  }

  const response = await fetch(target, {
    method: req.method,
    headers,
    body: await readRawBody(req),
    redirect: 'manual',
  })

  res.statusCode = response.status
  const setCookies = []
  response.headers.forEach((value, key) => {
    if (key === 'set-cookie' || key === 'content-encoding' || key === 'content-length') return
    res.setHeader(key, value)
  })

  const cookies =
    typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  for (const cookie of cookies) setCookies.push(rewriteCookie(cookie))
  if (setCookies.length) res.setHeader('set-cookie', setCookies)

  const body = Buffer.from(await response.arrayBuffer())
  res.end(body)
}
