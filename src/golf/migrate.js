import { toCourse, toCourseHole, toRound, toShot } from './schema.js'

function newId() {
  return crypto.randomUUID()
}

/**
 * @param {unknown} raw
 * @param {string} userId
 */
function owned(raw, userId) {
  if (!raw || typeof raw !== 'object') return false
  const record = /** @type {{ userId?: unknown }} */ (raw)
  return record.userId == null || record.userId === '' || record.userId === userId
}

/**
 * @template T
 * @param {unknown} value
 * @param {(raw: Object) => T} build
 * @returns {T | null}
 */
function keep(value, build) {
  if (!value || typeof value !== 'object') return null
  try {
    return build(/** @type {Object} */ (value))
  } catch {
    return null
  }
}

/**
 * Reads golf collections out of a stored caddieai document.
 * Older documents have no golf keys. Rows for any other user are dropped.
 *
 * @param {Object} parsed
 * @param {string} userId
 */
export function readGolfCollections(parsed, userId) {
  const source = parsed && typeof parsed === 'object' ? parsed : {}

  /** @type {import('./schema.js').Course[]} */
  const courses = []
  for (const raw of Array.isArray(source.courses) ? source.courses : []) {
    if (!owned(raw, userId)) continue
    const course = keep(raw, (row) =>
      toCourse(userId, { ...row, id: row.id || newId() })
    )
    if (!course || courses.some((item) => item.id === course.id)) continue
    courses.push(course)
  }

  const courseIds = new Set(courses.map((course) => course.id))
  /** @type {import('./schema.js').CourseHole[]} */
  const courseHoles = []
  for (const raw of Array.isArray(source.courseHoles) ? source.courseHoles : []) {
    const hole = keep(raw, (row) => toCourseHole({ ...row, id: row.id || newId() }))
    if (!hole || !courseIds.has(hole.courseId)) continue
    const duplicate = courseHoles.some(
      (item) =>
        item.id === hole.id ||
        (item.courseId === hole.courseId && item.holeNumber === hole.holeNumber)
    )
    if (duplicate) continue
    courseHoles.push(hole)
  }

  /** @type {import('./schema.js').Round[]} */
  const rounds = []
  for (const raw of Array.isArray(source.rounds) ? source.rounds : []) {
    if (!owned(raw, userId)) continue
    const round = keep(raw, (row) => toRound(userId, { ...row, id: row.id || newId() }))
    if (!round || rounds.some((item) => item.id === round.id)) continue
    rounds.push(round)
  }

  const roundsById = new Map(rounds.map((round) => [round.id, round]))
  /** @type {import('./schema.js').GolfShot[]} */
  const golfShots = []
  for (const raw of Array.isArray(source.golfShots) ? source.golfShots : []) {
    const shot = keep(raw, (row) => toShot({ ...row, id: row.id || newId() }))
    if (!shot) continue
    const round = roundsById.get(shot.roundId)
    if (!round || !round.holes.some((hole) => hole.holeNumber === shot.holeNumber)) continue
    const duplicate = golfShots.some(
      (item) =>
        item.id === shot.id ||
        (item.roundId === shot.roundId &&
          item.holeNumber === shot.holeNumber &&
          item.seq === shot.seq)
    )
    if (duplicate) continue
    golfShots.push(shot)
  }

  return { courses, courseHoles, rounds, golfShots }
}
