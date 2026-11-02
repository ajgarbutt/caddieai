const SECTION_DEFS = [
  { key: 'club', pattern: /🏌️\s*CLUB:\s*([\s\S]*?)(?=\n🎯|\n🏌️\s*SETUP|\n💭|$)/i },
  { key: 'target', pattern: /🎯\s*TARGET:\s*([\s\S]*?)(?=\n🏌️|\n💭|$)/i },
  {
    key: 'setup',
    pattern: /🏌️\s*SETUP\s*&\s*STRIKE:\s*([\s\S]*?)(?=\n💭|$)/i,
  },
  { key: 'thought', pattern: /💭\s*KEY\s*THOUGHT:\s*([\s\S]*?)$/i },
]

export function isFormattedAdvice(text) {
  if (!text) return false
  const markers = ['CLUB:', 'TARGET:', 'SETUP & STRIKE:', 'KEY THOUGHT:']
  const hits = markers.filter((m) => text.includes(m))
  return hits.length >= 2
}

export function parseFormattedAdvice(text) {
  if (!isFormattedAdvice(text)) return null

  const sections = []
  for (const def of SECTION_DEFS) {
    const match = text.match(def.pattern)
    if (match?.[1]?.trim()) {
      sections.push({ key: def.key, content: match[1].trim() })
    }
  }

  return sections.length > 0 ? sections : null
}

export function toNaturalAdvice(text) {
  if (!text) return ''

  const sections = parseFormattedAdvice(text)
  if (!sections) return text

  const byKey = Object.fromEntries(sections.map((s) => [s.key, s.content]))
  const parts = []

  if (byKey.club) {
    parts.push(byKey.club.endsWith('.') ? byKey.club : `${byKey.club}.`)
  }
  if (byKey.target) {
    const target = byKey.target.replace(/^Centre/i, 'the centre')
    parts.push(`I'd aim for ${target.charAt(0).toLowerCase()}${target.slice(1)}${target.endsWith('.') ? '' : '.'}`)
  }
  if (byKey.setup) {
    parts.push(byKey.setup.endsWith('.') ? byKey.setup : `${byKey.setup}.`)
  }
  if (byKey.thought) {
    parts.push(byKey.thought.endsWith('.') ? byKey.thought : `${byKey.thought}.`)
  }

  return parts.join(' ')
}

export function toDisplayAdvice(text) {
  return isFormattedAdvice(text) ? toNaturalAdvice(text) : text
}

export function shouldAutoReadAdvice(text) {
  return Boolean(text?.trim())
}
