import dotenv from 'dotenv'
import http from 'node:http'

dotenv.config({ path: '.env.local' })

const { default: stateHandler } = await import('../api/state.js')
const { default: authHandler } = await import('../api/neon-auth.js')

function adapt(res) {
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  return res
}

const server = http.createServer((req, res) => {
  adapt(res)
  const url = new URL(req.url, 'http://localhost:3000')
  const handler =
    url.pathname === '/api/state'
      ? stateHandler
      : url.pathname.startsWith('/api/neon-auth')
        ? authHandler
        : null

  if (!handler) {
    res.statusCode = 404
    res.end()
    return
  }

  Promise.resolve(handler(req, res)).catch((error) => {
    console.error(error)
    if (!res.headersSent) {
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Server error' }))
    }
  })
})

server.listen(3000, () => {
  console.log('API listening on http://localhost:3000')
})
