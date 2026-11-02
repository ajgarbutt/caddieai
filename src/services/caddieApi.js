function extractPartialReply(jsonSoFar) {
  const keyIndex = jsonSoFar.indexOf('"reply"')
  if (keyIndex === -1) return ''

  const colonIndex = jsonSoFar.indexOf(':', keyIndex)
  if (colonIndex === -1) return ''

  let index = colonIndex + 1
  while (index < jsonSoFar.length && /\s/.test(jsonSoFar[index])) {
    index += 1
  }
  if (jsonSoFar[index] !== '"') return ''

  let result = ''
  index += 1

  while (index < jsonSoFar.length) {
    const char = jsonSoFar[index]
    if (char === '"') break
    if (char === '\\' && index + 1 < jsonSoFar.length) {
      const next = jsonSoFar[index + 1]
      if (next === 'n') result += '\n'
      else if (next === 't') result += '\t'
      else if (next === 'r') result += '\r'
      else result += next
      index += 2
      continue
    }
    result += char
    index += 1
  }

  return result
}

export async function getCaddieAdvice({
  profile,
  clubs,
  shotDetails,
  messages,
  stream = true,
  onDelta,
  mode = 'caddie',
  brief = null,
}) {
  const response = await fetch('/api/caddie', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile,
      clubs,
      shotDetails,
      messages,
      stream,
      mode,
      brief,
    }),
  })

  if (!response.ok) {
    let message = 'Sorry, something went wrong. Please try again.'
    try {
      const data = await response.json()
      if (data?.error) message = data.error
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  if (!stream || !response.body) {
    const data = await response.json()
    if (!data?.reply?.trim()) {
      throw new Error('Sorry, something went wrong. Please try again.')
    }
    return {
      reply: data.reply.trim(),
      extractedShotDetails: data.extractedShotDetails ?? null,
    }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let reply = ''
  let extractedShotDetails = null
  let rawJson = ''
  let streamedReplyLength = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6))
        if (event.type === 'delta' && event.text) {
          rawJson += event.text
          const partialReply = extractPartialReply(rawJson)
          if (partialReply.length > streamedReplyLength) {
            const delta = partialReply.slice(streamedReplyLength)
            streamedReplyLength = partialReply.length
            onDelta?.(delta)
          }
        }
        if (event.type === 'done') {
          reply = event.reply?.trim() ?? ''
          extractedShotDetails = event.extractedShotDetails ?? null
        }
      } catch {
        // ignore malformed SSE chunks
      }
    }
  }

  if (!reply) {
    throw new Error('Sorry, something went wrong. Please try again.')
  }

  return { reply, extractedShotDetails }
}
