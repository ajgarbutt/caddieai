function blobToBase64(audioBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Could not encode audio.'))
        return
      }
      const commaIndex = result.indexOf(',')
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
    }
    reader.onerror = () => reject(new Error('Could not encode audio.'))
    reader.readAsDataURL(audioBlob)
  })
}

export async function transcribeAudio(audioBlob) {
  const mimeType = (audioBlob.type || 'audio/webm').split(';')[0]
  const filename =
    mimeType.includes('mp4') || mimeType.includes('m4a')
      ? 'recording.m4a'
      : 'recording.webm'

  const audio = await blobToBase64(audioBlob)

  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio, mimeType, filename }),
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new Error(
      data?.error || 'I could not hear that clearly. Please try again or type your shot.'
    )
  }

  if (!data?.transcript?.trim()) {
    throw new Error('I could not hear that clearly. Please try again or type your shot.')
  }

  return data.transcript.trim()
}
