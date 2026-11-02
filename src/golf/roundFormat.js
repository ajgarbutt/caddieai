const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** One-decimal strokes gained, with a leading plus or a minus sign. */
export function formatSg(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10
  const text = Math.abs(rounded).toFixed(1)
  if (rounded > 0) return `+${text}`
  if (rounded < 0) return `−${text}`
  return '0.0'
}

/** Whole-number strokes relative to par. */
export function formatToPar(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value === 0) return 'E'
  if (value > 0) return `+${value}`
  return `−${Math.abs(value)}`
}

export function formatPlayedAt(iso) {
  const [year, month, day] = String(iso).split('-').map(Number)
  if (!year || !month || !day) return iso
  return `${day} ${MONTHS[month - 1]} ${year}`
}

export function formatRatio(hit, chances) {
  return `${hit} / ${chances}`
}

export function formatDrive(yards) {
  if (yards == null || !Number.isFinite(yards)) return '—'
  return `${Math.round(yards)} yds`
}

/** Plus handicaps are stored negative and shown as +2. */
export function formatReferenceHandicap(value) {
  const rounded = Math.round(Number(value) * 10) / 10
  if (!Number.isFinite(rounded)) return ''
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return rounded < 0 ? `+${text.slice(1)}` : text
}

export function formatDifferential(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10
  const text = Math.abs(rounded).toFixed(1)
  if (rounded > 0) return `+${text}`
  if (rounded < 0) return `−${text}`
  return '0.0'
}
