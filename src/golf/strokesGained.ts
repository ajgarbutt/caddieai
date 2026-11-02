import baseline from './sg-baseline.json' with { type: 'json' }
import { penaltiesAfter } from './shotMath.js'

/** Expected strokes once the ball is in the hole. */
const HOLED_EXPECTED_STROKES = 0

/** One stroke is charged for playing the shot. */
const STROKE = 1

const YARD_LIES = ['TEE', 'FAIRWAY', 'ROUGH', 'SAND', 'RECOVERY'] as const

export type SgCategory = 'OTT' | 'APP' | 'ARG' | 'PUTT'

export type SgLie = (typeof YARD_LIES)[number] | 'PUTTS'

export type SgShot = {
  type: SgLie | 'PENALTY'
  distance: number | null
  penaltyStrokes?: number
  penaltyKind?: 'replay' | 'drop' | null
}

export type ShotStrokesGained = {
  index: number
  category: SgCategory
  /** Null when the hole is still in progress and this shot has no next lie. */
  rawSG: number | null
  penaltySG: number
}

type LookupRow = [number, number]

const yardTables = baseline.yards as Record<(typeof YARD_LIES)[number], LookupRow[]>
const puttTable = baseline.puttsFeet as LookupRow[]
const shortGameMaxYards = baseline.shortGameMaxYards
const categoryWeights = baseline.categoryWeights as Record<SgCategory, number>
const scratchAverageDifferential = baseline.scratchAverageDifferential as number
const doublingHandicap = baseline.doublingHandicap as number

/** Slope ratings are indexed to 113. */
const STANDARD_SLOPE = 113

const CATEGORIES: SgCategory[] = ['OTT', 'APP', 'ARG', 'PUTT']

export type SgMode = 'handicap' | 'raw'

export type RoundSgShot = {
  category: SgCategory
  rawSG: number
  penaltySG: number
}

export type AdjustedShot = {
  category: SgCategory
  rawSG: number
  adjustedSG: number
  penaltySG: number
}

export type CategorySgTotals = Record<SgCategory, number>

export type RoundStrokesGained = {
  shots: AdjustedShot[]
  rawByCategory: CategorySgTotals
  adjustedByCategory: CategorySgTotals
  rawTotal: number
  total: number
  differential: number
  expectedDifferential: number
  adjustment: number
  denom: number
}

/**
 * Floor lookup, same as Google Sheets LOOKUP: the row with the largest
 * distance less than or equal to the input. No interpolation.
 */
function floorLookup(rows: LookupRow[], distance: number): number {
  let expected = rows[0][1]
  for (const [rowDistance, rowExpected] of rows) {
    if (rowDistance <= distance) expected = rowExpected
    else break
  }
  return expected
}

/**
 * Expected strokes to hole out from a lie and distance. Holed is 0 and is
 * applied by the caller when a shot finishes the hole.
 */
export function expectedStrokes(type: SgLie, distance: number): number {
  if (type === 'PUTTS') return floorLookup(puttTable, distance)
  if (!YARD_LIES.includes(type)) {
    throw new Error(`No expected-strokes table for ${type}`)
  }
  return floorLookup(yardTables[type], distance)
}

/**
 * Category from the shot's start position.
 * A tee shot on a par 4 or 5 is off the tee, including a re-tee.
 * Every other non-putt uses the short-game distance from the baseline.
 */
export function shotCategory(type: SgLie, distance: number, par: number): SgCategory {
  if (type === 'PUTTS') return 'PUTT'
  if (type === 'TEE' && (par === 4 || par === 5)) return 'OTT'
  if (distance > shortGameMaxYards) return 'APP'
  return 'ARG'
}

function nextLie(shots: SgShot[], index: number): SgShot | null {
  for (let cursor = index + 1; cursor < shots.length; cursor += 1) {
    if (shots[cursor].type !== 'PENALTY') return shots[cursor]
  }
  return null
}

function startExpected(shot: SgShot): number {
  if (shot.type === 'PENALTY' || shot.distance == null || !Number.isFinite(shot.distance)) {
    throw new Error('Expected strokes need a lie and a distance.')
  }
  return expectedStrokes(shot.type, shot.distance)
}

/**
 * Raw strokes gained for one non-penalty shot.
 * rawSG = E(start) − 1 − penaltiesAfter(shot) − E(next).
 * E(next) is 0 when this shot holed out.
 */
export function shotStrokesGained(
  shots: SgShot[],
  index: number,
  par: number,
  holedOut: boolean
): ShotStrokesGained {
  const shot = shots[index]
  if (!shot || shot.type === 'PENALTY') {
    throw new Error('Strokes gained is only defined for a shot the ball was played from.')
  }
  const penalties = penaltiesAfter(shots, index)
  const start = startExpected(shot)
  const next = nextLie(shots, index)
  const nextExpected = next ? startExpected(next) : holedOut ? HOLED_EXPECTED_STROKES : null
  return {
    index,
    category: shotCategory(shot.type, shot.distance as number, par),
    rawSG: nextExpected == null ? null : start - STROKE - penalties - nextExpected,
    penaltySG: penalties === 0 ? 0 : -penalties,
  }
}

/** Raw strokes gained for every non-penalty shot, in play order. */
export function holeStrokesGained(
  shots: SgShot[],
  par: number,
  holedOut: boolean
): ShotStrokesGained[] {
  const gained: ShotStrokesGained[] = []
  for (let index = 0; index < shots.length; index += 1) {
    if (shots[index].type === 'PENALTY') continue
    gained.push(shotStrokesGained(shots, index, par, holedOut))
  }
  return gained
}

function emptyTotals(): CategorySgTotals {
  return { OTT: 0, APP: 0, ARG: 0, PUTT: 0 }
}

/** Gross score, unless the round stores a different score for handicap. */
export function scoreForHandicap(grossScore: number, handicapScoreOverride?: number | null): number {
  return handicapScoreOverride ?? grossScore
}

/** (score − course rating) × 113 / slope. */
export function handicapDifferential(
  score: number,
  courseRating: number,
  slopeRating: number
): number {
  return ((score - courseRating) * STANDARD_SLOPE) / slopeRating
}

/**
 * Expected differential for a reference handicap.
 * Scratch is the baseline average; a handicap of `doublingHandicap` expects
 * that handicap plus twice the scratch average. Nine-hole rounds use half.
 */
export function expectedHandicapDifferential(referenceHandicap: number, nineHoles = false): number {
  const full =
    referenceHandicap +
    (scratchAverageDifferential * (doublingHandicap + referenceHandicap)) / doublingHandicap
  return nineHoles ? full / 2 : full
}

export type RoundSgInput = {
  shots: RoundSgShot[]
  score: number
  handicapScoreOverride?: number | null
  courseRating: number
  slopeRating: number
  nineHoles?: boolean
  referenceHandicap: number
  sgMode: SgMode
}

/**
 * Spread the round adjustment across shots by category weight.
 * In raw mode the adjustment is 0, so adjusted strokes gained stay equal to raw.
 */
export function roundStrokesGained(input: RoundSgInput): RoundStrokesGained {
  const usedScore = scoreForHandicap(input.score, input.handicapScoreOverride)
  const differential = handicapDifferential(usedScore, input.courseRating, input.slopeRating)
  const expected = expectedHandicapDifferential(input.referenceHandicap, input.nineHoles ?? false)
  const rawTotal = input.shots.reduce((sum, shot) => sum + shot.rawSG, 0)
  const adjustment = input.sgMode === 'raw' ? 0 : expected - differential - rawTotal

  const counts = emptyTotals()
  for (const shot of input.shots) counts[shot.category] += 1
  const denom = CATEGORIES.reduce((sum, category) => sum + categoryWeights[category] * counts[category], 0)

  const shots = input.shots.map((shot) => {
    const share = denom === 0 ? 0 : (adjustment * categoryWeights[shot.category]) / denom
    return {
      category: shot.category,
      rawSG: shot.rawSG,
      adjustedSG: shot.rawSG + share,
      penaltySG: shot.penaltySG,
    }
  })

  const rawByCategory = emptyTotals()
  const adjustedByCategory = emptyTotals()
  for (const shot of shots) {
    rawByCategory[shot.category] += shot.rawSG
    adjustedByCategory[shot.category] += shot.adjustedSG
  }

  return {
    shots,
    rawByCategory,
    adjustedByCategory,
    rawTotal,
    total: input.sgMode === 'raw' ? rawTotal : expected - differential,
    differential,
    expectedDifferential: expected,
    adjustment,
    denom,
  }
}
