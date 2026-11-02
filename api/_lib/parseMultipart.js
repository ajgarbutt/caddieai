import Busboy from 'busboy'
import { Readable } from 'node:stream'
import { ALLOWED_AUDIO_MIME_TYPES, MAX_AUDIO_BYTES } from './config.js'

function normalizeMimeType(mimeType, filename = '') {
  const base = (mimeType || '').split(';')[0].trim().toLowerCase()
  if (base && ALLOWED_AUDIO_MIME_TYPES.has(base)) {
    return base
  }

  const extension = filename.split('.').pop()?.toLowerCase()
  if (extension === 'webm') return 'audio/webm'
  if (extension === 'm4a') return 'audio/m4a'
  if (extension === 'mp4') return 'audio/mp4'
  if (extension === 'wav') return 'audio/wav'
  if (extension === 'mp3') return 'audio/mpeg'
  if (extension === 'ogg') return 'audio/ogg'

  return base
}

function parseJsonBody(req) {
  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      throw new Error('INVALID_JSON')
    }
  }

  if (!body || typeof body !== 'object' || typeof body.audio !== 'string') {
    throw new Error('NO_FILE')
  }

  const filename = body.filename || 'recording.webm'
  const mimeType = normalizeMimeType(body.mimeType, filename)
  if (!ALLOWED_AUDIO_MIME_TYPES.has(mimeType)) {
    throw new Error('INVALID_FILE_TYPE')
  }

  const buffer = Buffer.from(body.audio, 'base64')
  if (!buffer.length) {
    throw new Error('NO_FILE')
  }
  if (buffer.length > MAX_AUDIO_BYTES) {
    throw new Error('FILE_TOO_LARGE')
  }

  return { buffer, mimeType, filename }
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) {
    return req.body
  }

  if (typeof req.body === 'string' && req.body.length > 0) {
    return Buffer.from(req.body, 'binary')
  }

  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
    if (typeof req.resume === 'function') {
      req.resume()
    }
  })
}

function parseMultipartBuffer(buffer, headers) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers })
    let fileBuffer = null
    let mimeType = ''
    let filename = 'recording.webm'
    let foundFile = false
    let tooLarge = false
    let fileSize = 0
    let fileDone = Promise.resolve()

    busboy.on('file', (fieldname, file, info) => {
      if (fieldname !== 'audio') {
        file.resume()
        return
      }

      foundFile = true
      mimeType = info.mimeType || ''
      filename = info.filename || 'recording.webm'

      const chunks = []
      fileDone = new Promise((resolveFile, rejectFile) => {
        file.on('data', (chunk) => {
          fileSize += chunk.length
          if (fileSize > MAX_AUDIO_BYTES) {
            tooLarge = true
            file.resume()
            return
          }
          chunks.push(chunk)
        })

        file.on('end', () => {
          if (!tooLarge) {
            fileBuffer = Buffer.concat(chunks)
          }
          resolveFile()
        })

        file.on('error', rejectFile)
      })
    })

    busboy.on('error', reject)

    busboy.on('finish', async () => {
      try {
        await fileDone
      } catch (error) {
        reject(error)
        return
      }

      if (tooLarge) {
        reject(new Error('FILE_TOO_LARGE'))
        return
      }
      if (!foundFile || !fileBuffer) {
        reject(new Error('NO_FILE'))
        return
      }

      const normalizedMimeType = normalizeMimeType(mimeType, filename)
      if (!ALLOWED_AUDIO_MIME_TYPES.has(normalizedMimeType)) {
        reject(new Error('INVALID_FILE_TYPE'))
        return
      }

      resolve({
        buffer: fileBuffer,
        mimeType: normalizedMimeType,
        filename,
      })
    })

    Readable.from(buffer).pipe(busboy)
  })
}

async function parseWebFormData(req) {
  const formData = await req.formData()
  const file = formData.get('audio')

  if (!file || typeof file === 'string') {
    throw new Error('NO_FILE')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length === 0) {
    throw new Error('NO_FILE')
  }
  if (buffer.length > MAX_AUDIO_BYTES) {
    throw new Error('FILE_TOO_LARGE')
  }

  const filename = file.name || 'recording.webm'
  const mimeType = normalizeMimeType(file.type, filename)
  if (!ALLOWED_AUDIO_MIME_TYPES.has(mimeType)) {
    throw new Error('INVALID_FILE_TYPE')
  }

  return { buffer, mimeType, filename }
}

export async function parseAudioUpload(req) {
  const contentType = req.headers?.['content-type'] || ''

  if (contentType.includes('application/json')) {
    return parseJsonBody(req)
  }

  if (typeof req.formData === 'function') {
    return parseWebFormData(req)
  }

  const body = await readRawBody(req)
  if (!body.length) {
    throw new Error('NO_FILE')
  }

  return parseMultipartBuffer(body, req.headers)
}
