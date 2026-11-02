import {
  GolfDataError,
  assertPatch,
  parseBuilderCourseRating,
  parseBuilderYards,
  parseHoleNumber,
  parsePar,
  toCourse,
  toCourseHole,
  toRound,
  toRoundHole,
  toShot,
} from './schema.js'
import { removalEnd } from './shotMath.js'

/**
 * @param {import('./schema.js').GolfStore} store
 */
function assertStore(store) {
  if (!store || typeof store.userId !== 'string' || store.userId === '') {
    throw new GolfDataError('Golf data is missing its user.')
  }
  for (const key of ['courses', 'courseHoles', 'rounds', 'golfShots']) {
    if (!Array.isArray(store[key])) {
      throw new GolfDataError('Golf data is not initialised.')
    }
  }
}

/**
 * @param {{ id: string }[]} rows
 * @param {unknown} id
 */
function takeId(rows, id) {
  const resolved = typeof id === 'string' && id.trim() ? id.trim() : crypto.randomUUID()
  if (rows.some((row) => row.id === resolved)) {
    throw new GolfDataError('That id already exists.')
  }
  return resolved
}

/**
 * @template {{ id: string }} T
 * @param {T[]} rows
 * @param {T} next
 */
function replaceById(rows, next) {
  return rows.map((row) => (row.id === next.id ? next : row))
}

/** @param {import('./schema.js').GolfStore} store */
export function listCourses(store) {
  assertStore(store)
  return store.courses
    .filter((course) => course.userId === store.userId && !course.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name) || a.teeName.localeCompare(b.teeName))
}

/** @param {import('./schema.js').GolfStore} store @param {string} id */
export function getCourse(store, id) {
  return listCourses(store).find((course) => course.id === id) ?? null
}

/** @param {import('./schema.js').GolfStore} store @param {string} id */
function requireCourse(store, id) {
  const course = getCourse(store, id)
  if (!course) throw new GolfDataError('Course not found.')
  return course
}

/**
 * @param {import('./schema.js').GolfStore} store
 * @param {string} courseId
 */
export function listCourseHoles(store, courseId) {
  requireCourse(store, courseId)
  return store.courseHoles
    .filter((hole) => hole.courseId === courseId)
    .sort((a, b) => a.holeNumber - b.holeNumber)
}

/** @param {import('./schema.js').GolfStore} store @param {string} id */
export function getCourseHole(store, id) {
  assertStore(store)
  const hole = store.courseHoles.find((item) => item.id === id)
  if (!hole || !getCourse(store, hole.courseId)) return null
  return hole
}

/** @param {import('./schema.js').GolfStore} store @param {string} id */
function requireCourseHole(store, id) {
  const hole = getCourseHole(store, id)
  if (!hole) throw new GolfDataError('Course hole not found.')
  return hole
}

/** @param {import('./schema.js').GolfStore} store */
export function listRounds(store) {
  assertStore(store)
  return store.rounds
    .filter((round) => round.userId === store.userId)
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt) || b.createdAt.localeCompare(a.createdAt))
}

/** @param {import('./schema.js').GolfStore} store @param {string} id */
export function getRound(store, id) {
  return listRounds(store).find((round) => round.id === id) ?? null
}

/** @param {import('./schema.js').GolfStore} store @param {string} id */
function requireRound(store, id) {
  const round = getRound(store, id)
  if (!round) throw new GolfDataError('Round not found.')
  return round
}

/**
 * @param {import('./schema.js').Round} round
 * @param {number} holeNumber
 */
export function isHoledOut(round, holeNumber) {
  return round.holes.some((hole) => hole.holeNumber === holeNumber && hole.holedOut)
}

/**
 * @param {import('./schema.js').GolfStore} store
 * @param {string} roundId
 */
export function listShots(store, roundId) {
  requireRound(store, roundId)
  return store.golfShots
    .filter((shot) => shot.roundId === roundId)
    .sort((a, b) => a.holeNumber - b.holeNumber || a.seq - b.seq)
}

/** @param {import('./schema.js').GolfStore} store @param {string} id */
export function getShot(store, id) {
  assertStore(store)
  const shot = store.golfShots.find((item) => item.id === id)
  if (!shot || !getRound(store, shot.roundId)) return null
  return shot
}

/** @param {import('./schema.js').GolfStore} store @param {string} id */
function requireShot(store, id) {
  const shot = getShot(store, id)
  if (!shot) throw new GolfDataError('Shot not found.')
  return shot
}

/**
 * @param {import('./schema.js').GolfStore} store
 * @param {{ id?: string, name: string, teeName: string, courseRating: number | string, slopeRating: number | string }} input
 */
export function createCourse(store, input) {
  assertStore(store)
  const now = new Date().toISOString()
  const course = toCourse(store.userId, {
    ...input,
    id: takeId(store.courses, input?.id),
    createdAt: now,
    updatedAt: now,
  })
  return {
    store: { ...store, courses: [...store.courses, course] },
    record: course,
  }
}

const COURSE_PATCH = new Set(['name', 'teeName', 'courseRating', 'slopeRating'])

/**
 * @param {import('./schema.js').GolfStore} store
 * @param {string} id
 * @param {Object} updates
 */
export function updateCourse(store, id, updates) {
  assertPatch(updates, COURSE_PATCH)
  const current = requireCourse(store, id)
  const course = toCourse(store.userId, {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  })
  return {
    store: { ...store, courses: replaceById(store.courses, course) },
    record: course,
  }
}

/** @param {import('./schema.js').GolfStore} store @param {string} courseId */
function courseHasRounds(store, courseId) {
  return store.rounds.some(
    (round) => round.courseId === courseId && round.userId === store.userId
  )
}

/** @param {import('./schema.js').GolfStore} store @param {string} id */
export function deleteCourse(store, id) {
  const course = requireCourse(store, id)
  if (courseHasRounds(store, course.id)) {
    const hidden = {
      ...course,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    return {
      store: { ...store, courses: replaceById(store.courses, hidden) },
      record: hidden,
    }
  }

  return {
    store: {
      ...store,
      courses: store.courses.filter((item) => item.id !== course.id),
      courseHoles: store.courseHoles.filter((hole) => hole.courseId !== course.id),
    },
  }
}

/**
 * Writes a course and its 18 holes together.
 * @param {import('./schema.js').GolfStore} store
 * @param {{ id?: string, name: string, teeName?: string, courseRating: number | string, slopeRating: number | string, holes: { holeNumber: number, par: number | string, yards: number | string, id?: string }[] }} input
 */
export function saveCourseWithHoles(store, input) {
  assertStore(store)
  const holesInput = Array.isArray(input?.holes) ? input.holes : []
  if (holesInput.length !== 18) {
    throw new GolfDataError('A course needs all 18 holes.')
  }

  const courseRating = parseBuilderCourseRating(input?.courseRating)
  const builtHoles = holesInput.map((raw) => ({
    holeNumber: parseHoleNumber(raw?.holeNumber),
    par: parsePar(raw?.par),
    yards: parseBuilderYards(raw?.yards),
    id: raw?.id,
  }))
  for (let holeNumber = 1; holeNumber <= 18; holeNumber += 1) {
    if (!builtHoles.some((hole) => hole.holeNumber === holeNumber)) {
      throw new GolfDataError(`Hole ${holeNumber} is missing.`)
    }
  }

  const courseInput = {
    name: input?.name,
    teeName: input?.teeName ?? '',
    courseRating,
    slopeRating: input?.slopeRating,
  }
  const saved = input?.id
    ? updateCourse(store, input.id, courseInput)
    : createCourse(store, courseInput)
  const course = saved.record
  const previous = saved.store.courseHoles.filter((hole) => hole.courseId === course.id)
  const holes = builtHoles.map((raw) => {
    const existing = previous.find((hole) => hole.holeNumber === raw.holeNumber)
    return toCourseHole({
      id: existing?.id || raw.id || crypto.randomUUID(),
      courseId: course.id,
      holeNumber: raw.holeNumber,
      par: raw.par,
      yards: raw.yards,
    })
  })

  return {
    store: {
      ...saved.store,
      courseHoles: [
        ...saved.store.courseHoles.filter((hole) => hole.courseId !== course.id),
        ...holes,
      ],
    },
    record: course,
  }
}

/**
 * @param {import('./schema.js').GolfStore} store
 * @param {string} courseId
 * @param {number} holeNumber
 * @param {string} [ignoreId]
 */
function assertUniqueHole(store, courseId, holeNumber, ignoreId) {
  const taken = store.courseHoles.some(
    (hole) =>
      hole.courseId === courseId &&
      hole.holeNumber === holeNumber &&
      hole.id !== ignoreId
  )
  if (taken) throw new GolfDataError(`Hole ${holeNumber} already exists on this course.`)
}

/**
 * @param {import('./schema.js').GolfStore} store
 * @param {{ id?: string, courseId: string, holeNumber: number | string, par: number | string, yards: number | string }} input
 */
export function createCourseHole(store, input) {
  assertStore(store)
  requireCourse(store, input?.courseId)
  const hole = toCourseHole({
    ...input,
    id: takeId(store.courseHoles, input?.id),
  })
  assertUniqueHole(store, hole.courseId, hole.holeNumber)
  return {
    store: { ...store, courseHoles: [...store.courseHoles, hole] },
    record: hole,
  }
}

const HOLE_PATCH = new Set(['holeNumber', 'par', 'yards'])

/**
 * @param {import('./schema.js').GolfStore} store
 * @param {string} id
 * @param {Object} updates
 */
export function updateCourseHole(store, id, updates) {
  assertPatch(updates, HOLE_PATCH)
  const current = requireCourseHole(store, id)
  const hole = toCourseHole({ ...current, ...updates })
  assertUniqueHole(store, hole.courseId, hole.holeNumber, hole.id)
  return {
    store: { ...store, courseHoles: replaceById(store.courseHoles, hole) },
    record: hole,
  }
}

/** @param {import('./schema.js').GolfStore} store @param {string} id */
export function deleteCourseHole(store, id) {
  const hole = requireCourseHole(store, id)
  return {
    store: {
      ...store,
      courseHoles: store.courseHoles.filter((item) => item.id !== hole.id),
    },
  }
}

/**
 * @param {import('./schema.js').GolfStore} store
 * @param {{ id?: string, courseId: string, playedAt: string, nineHoles?: boolean, status?: import('./schema.js').RoundStatus, includeInAnalysis?: boolean, notes?: string | null, handicapScoreOverride?: number | null }} input
 */
export function createRound(store, input) {
  assertStore(store)
  const course = requireCourse(store, input?.courseId)
  const now = new Date().toISOString()
  const holes = listCourseHoles(store, course.id).map((hole) =>
    toRoundHole({
      holeNumber: hole.holeNumber,
      par: hole.par,
      yards: hole.yards,
      holedOut: false,
    })
  )
  const round = toRound(store.userId, {
    id: takeId(store.rounds, input?.id),
    courseId: course.id,
    playedAt: input.playedAt,
    nineHoles: input.nineHoles,
    status: input.status,
    includeInAnalysis: input.includeInAnalysis,
    notes: input.notes,
    handicapScoreOverride: input.handicapScoreOverride,
    courseRating: course.courseRating,
    slopeRating: course.slopeRating,
    holes,
    createdAt: now,
    updatedAt: now,
  })
  return {
    store: { ...store, rounds: [...store.rounds, round] },
    record: round,
  }
}

const ROUND_PATCH = new Set([
  'playedAt',
  'nineHoles',
  'status',
  'includeInAnalysis',
  'notes',
  'handicapScoreOverride',
])

/**
 * @param {import('./schema.js').GolfStore} store
 * @param {string} id
 * @param {Object} updates
 */
export function updateRound(store, id, updates) {
  assertPatch(updates, ROUND_PATCH)
  const current = requireRound(store, id)
  const round = toRound(store.userId, {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  })
  return {
    store: { ...store, rounds: replaceById(store.rounds, round) },
    record: round,
  }
}

/** @param {import('./schema.js').GolfStore} store @param {string} id */
export function deleteRound(store, id) {
  const round = requireRound(store, id)
  return {
    store: {
      ...store,
      rounds: store.rounds.filter((item) => item.id !== round.id),
      golfShots: store.golfShots.filter((shot) => shot.roundId !== round.id),
    },
  }
}

/**
 * @param {import('./schema.js').GolfStore} store
 * @param {string} roundId
 * @param {number} holeNumber
 * @param {{ par?: number, yards?: number, holedOut?: boolean }} updates
 */
export function updateRoundHole(store, roundId, holeNumber, updates) {
  assertPatch(updates, new Set(['par', 'yards', 'holedOut']))
  const round = requireRound(store, roundId)
  const parsedHole = parseHoleNumber(holeNumber)
  const index = round.holes.findIndex((hole) => hole.holeNumber === parsedHole)
  if (index === -1) throw new GolfDataError(`Hole ${parsedHole} is not on this round.`)

  const nextHole = toRoundHole({ ...round.holes[index], ...updates })
  const holes = round.holes.map((hole, holeIndex) => (holeIndex === index ? nextHole : hole))
  const record = { ...round, holes, updatedAt: new Date().toISOString() }
  return {
    store: { ...store, rounds: replaceById(store.rounds, record) },
    record,
  }
}

/**
 * @param {import('./schema.js').GolfStore} store
 * @param {string} roundId
 * @param {number} holeNumber
 * @param {boolean} holedOut
 */
export function setHoleHoledOut(store, roundId, holeNumber, holedOut) {
  return updateRoundHole(store, roundId, holeNumber, { holedOut })
}

/**
 * @param {import('./schema.js').GolfStore} store
 * @param {string} roundId
 * @param {number} holeNumber
 */
function nextSeq(store, roundId, holeNumber) {
  const seqs = store.golfShots
    .filter((shot) => shot.roundId === roundId && shot.holeNumber === holeNumber)
    .map((shot) => shot.seq)
  return seqs.length ? Math.max(...seqs) + 1 : 1
}

/**
 * @param {import('./schema.js').GolfStore} store
 * @param {import('./schema.js').GolfShot} shot
 * @param {string} [ignoreId]
 */
function assertUniqueSeq(store, shot, ignoreId) {
  const taken = store.golfShots.some(
    (item) =>
      item.id !== ignoreId &&
      item.roundId === shot.roundId &&
      item.holeNumber === shot.holeNumber &&
      item.seq === shot.seq
  )
  if (taken) {
    throw new GolfDataError(
      `Sequence ${shot.seq} already exists on hole ${shot.holeNumber}.`
    )
  }
}

/**
 * @param {import('./schema.js').Round} round
 * @param {number} holeNumber
 */
function assertHoleOnRound(round, holeNumber) {
  if (!round.holes.some((hole) => hole.holeNumber === holeNumber)) {
    throw new GolfDataError(`Hole ${holeNumber} is not on this round.`)
  }
}

/**
 * @param {import('./schema.js').GolfStore} store
 * @param {Object} input
 */
export function createShot(store, input) {
  assertStore(store)
  const round = requireRound(store, input?.roundId)
  const holeNumber = parseHoleNumber(input?.holeNumber)
  assertHoleOnRound(round, holeNumber)
  const seq =
    input.seq == null || input.seq === '' ? nextSeq(store, round.id, holeNumber) : input.seq
  const shot = toShot({
    ...input,
    id: takeId(store.golfShots, input?.id),
    roundId: round.id,
    holeNumber,
    seq,
  })
  assertUniqueSeq(store, shot)
  assertPenaltyFollowsCause(store, shot)
  return {
    store: { ...store, golfShots: [...store.golfShots, shot] },
    record: shot,
  }
}

const SHOT_PATCH = new Set(['holeNumber', 'seq', 'type', 'distance', 'penaltyStrokes', 'penaltyKind'])

/**
 * @param {import('./schema.js').GolfStore} store
 * @param {string} id
 * @param {Object} updates
 */
export function updateShot(store, id, updates) {
  assertPatch(updates, SHOT_PATCH)
  const current = requireShot(store, id)
  const round = requireRound(store, current.roundId)
  const shot = toShot({ ...current, ...updates })
  assertHoleOnRound(round, shot.holeNumber)
  if (shot.holeNumber !== current.holeNumber && isHoledOut(round, shot.holeNumber)) {
    throw new GolfDataError(`Hole ${shot.holeNumber} is already holed out.`)
  }
  assertUniqueSeq(store, shot, shot.id)
  assertPenaltyFollowsCause(store, shot)
  return {
    store: { ...store, golfShots: replaceById(store.golfShots, shot) },
    record: shot,
  }
}

/**
 * A penalty records strokes on the shot before it, so it cannot lead the hole.
 * @param {import('./schema.js').GolfStore} store
 * @param {import('./schema.js').GolfShot} shot
 */
function assertPenaltyFollowsCause(store, shot) {
  if (shot.type !== 'PENALTY') return
  const caused = store.golfShots.some(
    (item) =>
      item.id !== shot.id &&
      item.roundId === shot.roundId &&
      item.holeNumber === shot.holeNumber &&
      item.seq < shot.seq &&
      item.type !== 'PENALTY'
  )
  if (!caused) {
    throw new GolfDataError('A penalty has to follow the shot that caused it.')
  }
}

/** @param {import('./schema.js').GolfStore} store @param {string} id */
export function deleteShot(store, id) {
  const shot = requireShot(store, id)
  const onHoleBefore = store.golfShots
    .filter((item) => item.roundId === shot.roundId && item.holeNumber === shot.holeNumber)
    .sort((a, b) => a.seq - b.seq)
  const index = onHoleBefore.findIndex((item) => item.id === shot.id)
  const removeIds = new Set(
    onHoleBefore.slice(index, removalEnd(onHoleBefore, index)).map((item) => item.id)
  )
  const remaining = store.golfShots.filter((item) => !removeIds.has(item.id))
  const onHole = remaining
    .filter((item) => item.roundId === shot.roundId && item.holeNumber === shot.holeNumber)
    .sort((a, b) => a.seq - b.seq)
  const seqById = new Map(onHole.map((item, index) => [item.id, index + 1]))
  return {
    store: {
      ...store,
      golfShots: remaining.map((item) => {
        const seq = seqById.get(item.id)
        if (seq == null || seq === item.seq) return item
        return { ...item, seq }
      }),
    },
  }
}

/**
 * Creates the opening tee shot when a hole has none yet.
 * Finished holes are left alone so a deleted tee is not put back.
 * @param {import('./schema.js').GolfStore} store
 * @param {string} roundId
 * @param {number} holeNumber
 */
export function ensureTeeShot(store, roundId, holeNumber) {
  assertStore(store)
  const round = requireRound(store, roundId)
  const parsed = parseHoleNumber(holeNumber)
  assertHoleOnRound(round, parsed)
  const existing = store.golfShots.some(
    (shot) => shot.roundId === round.id && shot.holeNumber === parsed
  )
  if (existing || isHoledOut(round, parsed)) return { store, record: null }
  const hole = round.holes.find((item) => item.holeNumber === parsed)
  return createShot(store, {
    roundId: round.id,
    holeNumber: parsed,
    type: 'TEE',
    distance: hole.yards,
    seq: 1,
  })
}
