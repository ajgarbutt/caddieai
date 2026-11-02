import { Pool } from 'pg'
import { attachDatabasePool } from '@vercel/functions'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
})

attachDatabasePool(pool)

export function query(text, params) {
  return pool.query(text, params)
}
