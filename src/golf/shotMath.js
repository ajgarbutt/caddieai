/** Feet in a yard, for putt distances stored in feet. */
const FEET_PER_YARD = 3

const SCORE_NAMES = new Map([
  [-4, 'Condor'],
  [-3, 'Albatross'],
  [-2, 'Eagle'],
  [-1, 'Birdie'],
  [0, 'Par'],
  [1, 'Bogey'],
  [2, 'Double bogey'],
  [3, 'Triple bogey'],
  [4, 'Quadruple bogey'],
])

/**
 * Strokes on a hole: each non-penalty shot counts as 1, plus penalty strokes.
 * @param {Array<{ type: string, penaltyStrokes?: number }>} shots
 */
export function holeScore(shots) {
  return shots.reduce(
    (total, shot) => total + (shot.type === 'PENALTY' ? shot.penaltyStrokes : 1),
    0
  )
}

/**
 * @param {number} strokes
 * @param {number} par
 */
export function scoreName(strokes, par) {
  const diff = strokes - par
  if (SCORE_NAMES.has(diff)) return SCORE_NAMES.get(diff)
  if (diff > 0) return `${diff} over`
  return `${Math.abs(diff)} under`
}

/**
 * @param {number} strokes
 * @param {number} par
 */
export function formatHoleScore(strokes, par) {
  return `${strokes} · ${scoreName(strokes, par)}`
}

/**
 * Soft range warning. Saving is still allowed.
 * @param {string} type
 * @param {unknown} raw
 * @returns {string | null}
 */
export function distanceWarning(type, raw) {
  if (!type || type === 'PENALTY' || raw == null) return null
  const text = String(raw).trim()
  if (text === '' || text === '.') return null
  const value = Number(text)
  if (!Number.isFinite(value) || value <= 0) return null
  if (type === 'TEE') {
    if (value < 100 || value > 660) return 'Tee shots are usually 100–660 yards.'
    return null
  }
  if (type === 'PUTTS') {
    if (value < 1 || value > 110) return 'Putts are usually 1–110 feet.'
    return null
  }
  if (value < 10) return 'For a chip under 10 yards, enter 10.'
  if (value > 600) return 'Shots are usually 10–600 yards.'
  return null
}

/**
 * @param {number} value
 */
export function formatQuantity(value) {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  return String(rounded)
}

/**
 * Penalty strokes on the PENALTY rows immediately after this shot.
 * Consecutive penalties belong to the same shot and are added together.
 * @param {Array<{ type: string, penaltyStrokes?: number }>} shots
 * @param {number} index
 */
export function penaltiesAfter(shots, index) {
  return immediatePenalties(shots, index).reduce((total, item) => total + item.penaltyStrokes, 0)
}

/**
 * @param {Array<{ type: string, penaltyStrokes?: number }>} shots
 * @param {number} index
 */
function immediatePenalties(shots, index) {
  /** @type {Array<{ type: string, penaltyStrokes?: number }>} */
  const run = []
  for (let cursor = index + 1; cursor < shots.length; cursor += 1) {
    if (shots[cursor].type !== 'PENALTY') break
    run.push(shots[cursor])
  }
  return run
}

/**
 * How far this shot travelled, in the shot's own unit. Never stored.
 * `null` when the shot is a penalty, not finished, or out of bounds.
 * `{ kind: 'ob' }` when a following penalty is a re-tee (stroke and distance).
 * @param {Array<{ type: string, distance: number | null, penaltyStrokes?: number, penaltyKind?: string | null }>} shots
 * @param {number} index
 * @param {boolean} holedOut
 * @returns {{ kind: 'yards' | 'feet' | 'ob' | 'pending', distance?: number } | null}
 */
export function shotTravel(shots, index, holedOut) {
  const shot = shots[index]
  if (!shot || shot.type === 'PENALTY') return null

  const penalties = immediatePenalties(shots, index)
  if (penalties.some((item) => item.penaltyKind === 'replay')) return { kind: 'ob' }

  const nextLie = shots[index + penalties.length + 1] ?? null
  if (!nextLie || nextLie.type === 'PENALTY') {
    if (!holedOut) return { kind: 'pending' }
    return {
      kind: shot.type === 'PUTTS' ? 'feet' : 'yards',
      distance: shot.distance,
    }
  }

  return travelledBetween(shot, nextLie)
}

/**
 * Travelled distance, or null for a penalty, an unfinished shot, or OB / lost ball.
 * @param {Array<{ type: string, distance: number | null, penaltyStrokes?: number, penaltyKind?: string | null }>} shots
 * @param {number} index
 * @param {boolean} [holedOut]
 * @returns {number | null}
 */
export function travelled(shots, index, holedOut = false) {
  const travel = shotTravel(shots, index, holedOut)
  if (!travel || travel.kind === 'ob' || travel.kind === 'pending') return null
  return travel.distance
}

/**
 * The shot played again after a stroke-and-distance penalty.
 * @param {Array<{ penaltyKind?: string | null }>} shots
 * @param {number} index
 */
export function isReplayShot(shots, index) {
  return shots[index - 1]?.penaltyKind === 'replay'
}

/**
 * Exclusive end index of the shots removed with this one.
 * A replay penalty also removes the re-tee that was added after it.
 * @param {Array<{ type: string, penaltyKind?: string | null }>} shots
 * @param {number} index
 */
export function removalEnd(shots, index) {
  const shot = shots[index]
  if (!shot) return index
  let end = index + 1
  if (shot.type !== 'PENALTY') {
    let sawReplay = false
    while (end < shots.length && shots[end].type === 'PENALTY') {
      if (shots[end].penaltyKind === 'replay') sawReplay = true
      end += 1
    }
    if (sawReplay && shots[end] && shots[end].type !== 'PENALTY') end += 1
    return end
  }
  if (shot.penaltyKind === 'replay' && shots[end] && shots[end].type !== 'PENALTY') return end + 1
  return end
}

/**
 * @param {{ type: string, distance: number }} current
 * @param {{ type: string, distance: number }} next
 */
function travelledBetween(current, next) {
  const currentPutts = current.type === 'PUTTS'
  const nextPutts = next.type === 'PUTTS'
  if (currentPutts && nextPutts) {
    return { kind: 'feet', distance: current.distance - next.distance }
  }
  if (!currentPutts && nextPutts) {
    return { kind: 'yards', distance: current.distance - next.distance / FEET_PER_YARD }
  }
  if (currentPutts && !nextPutts) {
    return { kind: 'feet', distance: current.distance - next.distance * FEET_PER_YARD }
  }
  return { kind: 'yards', distance: current.distance - next.distance }
}

/**
 * @param {{ penaltyStrokes?: number, penaltyKind?: string | null }} shot
 */
export function formatPenalty(shot) {
  if (shot.penaltyKind === 'replay') return `Penalty +${shot.penaltyStrokes} (OB, re-tee)`
  if (shot.penaltyStrokes === 2) return 'Penalty +2 (OB drop)'
  return 'Penalty +1 (water drop)'
}

/**
 * @param {{ seq: number, type: string, distance: number | null, penaltyStrokes?: number, penaltyKind?: string | null }} shot
 * @param {{ kind: string, distance?: number } | null} travel
 */
export function formatShotLine(shot, travel) {
  if (shot.type === 'PENALTY') return formatPenalty(shot)

  let place
  if (shot.type === 'PUTTS') {
    place = `${formatQuantity(shot.distance)} ft`
  } else {
    place = `${formatQuantity(shot.distance)} yds`
  }

  let tail = ''
  if (travel?.kind === 'ob') {
    tail = ' → OB / lost'
  } else if (travel?.kind === 'yards' || travel?.kind === 'feet') {
    const unit = travel.kind === 'feet' ? 'ft' : 'yds'
    const amount = formatQuantity(Math.abs(travel.distance))
    tail = travel.distance < 0 ? ` → went ${amount} ${unit} past` : ` → went ${amount} ${unit}`
  }

  return `#${shot.seq} · ${shot.type} · ${place}${tail}`
}
