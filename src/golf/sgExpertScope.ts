export type ExpertRound = {
  id: string
  playedAt: string
  createdAt: string
  courseName: string
  finished: boolean
}

export type StoredSgScope = 'career' | string | null

export type SgScopeChoice =
  | { kind: 'ask' }
  | { kind: 'which' }
  | { kind: 'none' }
  | { kind: 'unfinished'; round: ExpertRound }
  | { kind: 'unknown' }
  | { kind: 'ambiguous'; options: ExpertRound[] }
  | { kind: 'career' }
  | { kind: 'round'; round: ExpertRound }

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

const MONTH_PATTERN = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|')

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

type DateMatch = {
  year: number | null
  month: number
  day: number
}

function mentionedDate(text: string, today: Date): DateMatch | null {
  const lower = text.toLowerCase()
  if (/\btoday\b/.test(lower)) {
    return { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() }
  }
  if (/\byesterday\b/.test(lower)) {
    const date = shiftDays(today, -1)
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
  }

  const weekday = lower.match(
    new RegExp(`\\blast\\s+(${WEEKDAYS.join('|')})\\b`)
  )
  if (weekday) {
    const target = WEEKDAYS.indexOf(weekday[1])
    const current = today.getDay()
    let delta = (current - target + 7) % 7
    if (delta === 0) delta = 7
    const date = shiftDays(today, -delta)
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
  }

  const iso = lower.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }

  const dayMonth = lower.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${MONTH_PATTERN})(?:\\s+(20\\d{2}))?\\b`)
  )
  if (dayMonth) {
    return {
      day: Number(dayMonth[1]),
      month: MONTHS[dayMonth[2]],
      year: dayMonth[3] ? Number(dayMonth[3]) : null,
    }
  }

  const monthDay = lower.match(
    new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,)?(?:\\s+(20\\d{2}))?\\b`)
  )
  if (monthDay) {
    return {
      month: MONTHS[monthDay[1]],
      day: Number(monthDay[2]),
      year: monthDay[3] ? Number(monthDay[3]) : null,
    }
  }

  const dayOnly = lower.match(/\bthe\s+(\d{1,2})(?:st|nd|rd|th)\b/)
  if (dayOnly) return { year: null, month: 0, day: Number(dayOnly[1]) }
  return null
}

function sameDate(playedAt: string, match: DateMatch): boolean {
  const [year, month, day] = playedAt.split('-').map(Number)
  if (match.month === 0) return day === match.day
  if (match.year != null && year !== match.year) return false
  return month === match.month && day === match.day
}

function wantsCareer(text: string): boolean {
  const trimmed = text.trim().toLowerCase()
  if (/^(the |my )?averages?$/.test(trimmed)) return true
  if (/^(my )?average stats$/.test(trimmed)) return true
  return /\b(career|overall|all (?:my )?rounds|every round|across (?:my )?rounds|my average(?:s| stats)?|average stats|in general)\b/.test(
    trimmed
  )
}

function wantsAnotherRound(text: string): boolean {
  return /\b(specific round|a particular round|one round|another round)\b/i.test(text)
}

function wantsLastRound(text: string): boolean {
  return /\b(last|latest|most recent|previous)\s+round\b/i.test(text)
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function editDistance(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index])
  for (let column = 1; column <= right.length; column += 1) rows[0][column] = column
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + cost
      )
    }
  }
  return rows[left.length][right.length]
}

function tokenClose(query: string, name: string): boolean {
  if (query === name) return true
  if (query.length >= 4 && (name.includes(query) || query.includes(name))) return true
  if (query.length < 5 || Math.abs(query.length - name.length) > 2) return false
  return editDistance(query, name) <= 2
}

/** How well the golfer's words match a course name. 0 means no match. */
export function courseMatchScore(text: string, courseName: string): number {
  const query = normalise(text)
  const name = normalise(courseName)
  if (!query || !name) return 0
  if (query.includes(name)) return 100
  const words = query.split(' ').filter((word) => word.length >= 4)
  const tokens = name.split(' ').filter((token) => token.length >= 4)
  if (tokens.length === 0 || words.length === 0) return 0
  const hits = tokens.filter((token) => words.some((word) => tokenClose(word, token)))
  if (hits.length === 0) return 0
  const strong = tokens.filter((token) => token.length >= 5)
  const strongHits = strong.filter((token) => hits.includes(token))
  if (strong.length > 0 && strongHits.length === strong.length) return 85
  if (strongHits.length > 0) return 70
  if (hits.length === tokens.length) return 80
  return 40
}

function byRecent(a: ExpertRound, b: ExpertRound): number {
  return b.playedAt.localeCompare(a.playedAt) || b.createdAt.localeCompare(a.createdAt)
}

export function expertRoundLabel(round: ExpertRound): string {
  const [year, month, day] = round.playedAt.split('-')
  const monthName = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ][Number(month) - 1]
  return `${round.courseName} on ${Number(day)} ${monthName} ${year}`
}

export function sgScopeReply(choice: SgScopeChoice, rounds: ExpertRound[]): string {
  const finished = rounds.filter((round) => round.finished).sort(byRecent)
  if (choice.kind === 'none' || finished.length === 0 && choice.kind !== 'unfinished') {
    return 'Finish a round first. A round still in progress is left out.'
  }
  if (choice.kind === 'ask') {
    return 'Do you want data from a specific round or your average stats?'
  }
  if (choice.kind === 'which') {
    const sample = finished.slice(0, 3).map(expertRoundLabel).join(', or ')
    return sample
      ? `Which round? Tell me the course and the date. I have ${sample}.`
      : 'Which round? Tell me the course and the date.'
  }
  if (choice.kind === 'unfinished') {
    return `${expertRoundLabel(choice.round)} is still in progress, so it is not in the stats yet.`
  }
  if (choice.kind === 'ambiguous') {
    const options = choice.options.map(expertRoundLabel).join(', or ')
    return `I found more than one round. Do you mean ${options}?`
  }
  const sample = finished.slice(0, 3).map(expertRoundLabel).join(', or ')
  return `I couldn't match that to a finished round. You can ask for your average stats${sample ? `, or name one I have: ${sample}` : ''}.`
}

/**
 * Decide whether the latest question is about one finished round or the average.
 * A follow-up that does not name a round keeps the scope already chosen.
 */
export function resolveSgScope(
  text: string,
  rounds: ExpertRound[],
  current: StoredSgScope,
  today = new Date()
): SgScopeChoice {
  const finished = rounds.filter((round) => round.finished).sort(byRecent)
  if (finished.length === 0 && rounds.every((round) => !round.finished)) return { kind: 'none' }

  if (wantsCareer(text)) return { kind: 'career' }
  if (wantsLastRound(text)) {
    if (!finished[0]) return { kind: 'none' }
    return { kind: 'round', round: finished[0] }
  }

  const date = mentionedDate(text, today)
  const scored = rounds
    .map((round) => ({ round, score: courseMatchScore(text, round.courseName) }))
    .filter((item) => item.score >= 60)
    .sort((a, b) => b.score - a.score)
  const best = scored[0]?.score ?? 0
  const named = scored.filter((item) => item.score >= best - 10).map((item) => item.round)
  const dated = date ? rounds.filter((round) => sameDate(round.playedAt, date)) : []

  let matches: ExpertRound[] = []
  if (named.length > 0 && dated.length > 0) {
    const ids = new Set(dated.map((round) => round.id))
    matches = named.filter((round) => ids.has(round.id))
  } else if (named.length > 0) {
    matches = named
  } else if (dated.length > 0 && (date?.month || /\bthe\s+\d{1,2}(?:st|nd|rd|th)\b/i.test(text))) {
    matches = dated
  }

  if (matches.length === 0 && wantsAnotherRound(text)) return { kind: 'which' }
  if (matches.length === 0) {
    if (current === 'career') return { kind: 'career' }
    const kept = current ? finished.find((round) => round.id === current) : null
    if (kept) return { kind: 'round', round: kept }
    return finished.length === 0 ? { kind: 'none' } : { kind: 'ask' }
  }

  const ready = matches.filter((round) => round.finished)
  if (ready.length === 1) return { kind: 'round', round: ready[0] }
  if (ready.length > 1) return { kind: 'ambiguous', options: ready.sort(byRecent).slice(0, 4) }
  return { kind: 'unfinished', round: matches[0] }
}
