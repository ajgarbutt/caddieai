import { query } from './_lib/db.js'
import { readSessionUser } from './_lib/neonAuth.js'

const MAX_BODY_BYTES = 1_500_000

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body)
      return
    }

    const chunks = []
    let size = 0

    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('BODY_TOO_LARGE'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('INVALID_JSON'))
      }
    })

    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  const user = await readSessionUser(req)
  if (!user) {
    sendJson(res, 401, { error: 'Sign in required.' })
    return
  }

  if (req.method === 'GET') {
    const result = await query(
      'select document from public.player_state where user_id = $1',
      [user.id]
    )
    sendJson(res, 200, { document: result.rows[0]?.document ?? null })
    return
  }

  if (req.method === 'PUT') {
    try {
      const body = await readJsonBody(req)
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        sendJson(res, 400, { error: 'Player data must be an object.' })
        return
      }

      const document = { ...body, userId: user.id }
      await query(
        `insert into public.player_state (user_id, document, updated_at)
         values ($1, $2::jsonb, now())
         on conflict (user_id) do update
         set document = excluded.document, updated_at = now()`,
        [user.id, JSON.stringify(document)]
      )
      sendJson(res, 200, { ok: true })
    } catch (error) {
      if (error?.message === 'BODY_TOO_LARGE') {
        sendJson(res, 413, { error: 'That save is too large.' })
        return
      }
      sendJson(res, 400, { error: 'Could not save your data.' })
    }
    return
  }

  res.setHeader('Allow', 'GET, PUT')
  sendJson(res, 405, { error: 'Method not allowed.' })
}
