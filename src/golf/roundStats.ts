import { holeScore, penaltiesAfter, travelled } from './shotMath.js'
import {
  holeStrokesGained,
  roundStrokesGained,
  scoreForHandicap,
  handicapDifferential,
  shotCategory,
  type SgCategory,
  type SgLie,
  type SgMode,
  type SgShot,
} from './strokesGained.ts'

export type ScoreKind = 'eagle' | 'birdie' | 'par' | 'bogey' | 'double'

export type StatHole = {
  holeNumber: number
  par: number
  yards: number
  holedOut: boolean
}

export type StatShot = SgShot & {
  holeNumber: number
  seq: number
}

export type ScorecardHole = {
  holeNumber: number
  par: number
  yards: number
  holedOut: boolean
  score: number | null
  scoreToPar: number | null
  kind: ScoreKind | null
  putts: number
  penalties: number
  adjustedSg: number | null
  /** Null when the hole has not been started. */
  gir: boolean | null
  /** Null when a par 4 or 5 has not been started. Par 3s are `na`. */
  fairway: boolean | 'na' | null
}

export type SideTotals = {
  par: number
  yards: number
  score: number | null
  putts: number
  penalties: number
  adjustedSg: number | null
}

export type CountStat = { hit: number; chances: number }

const CATEGORIES: SgCategory[] = ['OTT', 'APP', 'ARG', 'PUTT']

function bySeq(a: StatShot, b: StatShot) {
  return a.seq - b.seq
}

export function shotsOnHole(shots: StatShot[], holeNumber: number): StatShot[] {
  return shots.filter((shot) => shot.holeNumber === holeNumber).sort(bySeq)
}

/** Eagle or better, birdie, par, bogey, double bogey or worse. */
export function scoreKind(score: number, par: number): ScoreKind {
  const diff = score - par
  if (diff <= -2) return 'eagle'
  if (diff === -1) return 'birdie'
  if (diff === 0) return 'par'
  if (diff === 1) return 'bogey'
  return 'double'
}

function nextLie(shots: StatShot[], index: number): StatShot | null {
  for (let cursor = index + 1; cursor < shots.length; cursor += 1) {
    if (shots[cursor].type !== 'PENALTY') return shots[cursor]
  }
  return null
}

function isArg(shot: StatShot, par: number): boolean {
  if (shot.type === 'PENALTY' || shot.type === 'PUTTS' || shot.distance == null) return false
  return shotCategory(shot.type as SgLie, shot.distance, par) === 'ARG'
}

/** Strokes taken before this index, including penalty strokes. */
function strokesBefore(shots: StatShot[], index: number): number {
  return holeScore(shots.slice(0, index))
}

/**
 * Par 4/5 tee shot with no penalty whose next lie is the fairway or the green.
 * A drive that finds the green (next shot is a putt) counts.
 */
export function fairwayHit(hole: StatHole, shots: StatShot[]): boolean {
  if (hole.par < 4) return false
  const teeIndex = shots.findIndex((shot) => shot.type === 'TEE')
  if (teeIndex < 0) return false
  if (penaltiesAfter(shots, teeIndex) > 0) return false
  const next = nextLie(shots, teeIndex)
  return next?.type === 'FAIRWAY' || next?.type === 'PUTTS'
}

/** Reached the green in par − 2 strokes or fewer. The putt itself is not counted. */
export function greenInRegulation(hole: StatHole, shots: StatShot[]): boolean {
  const puttIndex = shots.findIndex((shot) => shot.type === 'PUTTS')
  if (puttIndex < 0) return false
  return strokesBefore(shots, puttIndex) <= hole.par - 2
}

/**
 * Shots used to get on the green, beyond regulation.
 * In regulation this is 0. One under is −1. Chipping on from just off the green is 0.
 */
export function extraShotsOntoGreen(hole: StatHole, shots: StatShot[]): number | null {
  if (shots.length === 0) return null
  const puttIndex = shots.findIndex((shot) => shot.type === 'PUTTS')
  const before = puttIndex < 0 ? holeScore(shots) : strokesBefore(shots, puttIndex)
  const regulation = hole.par - 2
  if (puttIndex >= 0 && before <= regulation) return before - regulation
  return before - regulation - 1
}

/** Shots used to reach the first short-game shot or putt, beyond regulation. */
export function extraShotsNearGreen(hole: StatHole, shots: StatShot[]): number | null {
  if (shots.length === 0) return null
  const index = shots.findIndex((shot) => shot.type === 'PUTTS' || isArg(shot, hole.par))
  const before = index < 0 ? holeScore(shots) : strokesBefore(shots, index)
  return before - (hole.par - 2)
}

/** A scramble chance is a hole with a short-game shot. Holing the chip counts as up and down. */
export function scrambleResult(
  hole: StatHole,
  shots: StatShot[]
): 'success' | 'fail' | 'none' {
  let lastArg = -1
  shots.forEach((shot, index) => {
    if (isArg(shot, hole.par)) lastArg = index
  })
  if (lastArg < 0) return 'none'
  const puttsAfter = shots.slice(lastArg + 1).filter((shot) => shot.type === 'PUTTS').length
  if (hole.holedOut && puttsAfter <= 1) return 'success'
  return 'fail'
}

/**
 * Travelled yards of a par-4/5 tee shot that stayed in play and was not holed
 * with a putt. Re-tees qualify on their own. Null when this shot does not count.
 */
export function drivingDistance(hole: StatHole, shots: StatShot[], index: number): number | null {
  const shot = shots[index]
  if (!shot || hole.par < 4 || shot.type !== 'TEE') return null
  if (penaltiesAfter(shots, index) > 0) return null
  const next = nextLie(shots, index)
  if (next?.type === 'PUTTS') return null
  const yards = travelled(shots, index, hole.holedOut)
  return yards == null ? null : yards
}

function sumOrNull(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value != null)
  if (present.length === 0) return null
  return present.reduce((sum, value) => sum + value, 0)
}

export function sideTotals(holes: ScorecardHole[]): SideTotals {
  return {
    par: holes.reduce((sum, hole) => sum + hole.par, 0),
    yards: holes.reduce((sum, hole) => sum + hole.yards, 0),
    score: sumOrNull(holes.map((hole) => hole.score)),
    putts: holes.reduce((sum, hole) => sum + hole.putts, 0),
    penalties: holes.reduce((sum, hole) => sum + hole.penalties, 0),
    adjustedSg: sumOrNull(holes.map((hole) => hole.adjustedSg)),
  }
}

export type RoundStatsInput = {
  holes: StatHole[]
  shots: StatShot[]
  courseRating: number
  slopeRating: number
  nineHoles?: boolean
  handicapScoreOverride?: number | null
  referenceHandicap: number
  sgMode: SgMode
}

export type RoundStats = {
  holes: ScorecardHole[]
  out: SideTotals
  in: SideTotals
  total: SideTotals
  score: number
  scoreToPar: number
  par: number
  differential: number
  handicapScore: number
  fairways: CountStat
  greens: CountStat
  putts: number
  scrambling: CountStat
  extraOntoGreen: number
  extraNearGreen: number
  penaltyStrokes: number
  drivingDistance: number | null
  eagles: number
  birdies: number
  pars: number
  bogeys: number
  doubles: number
  adjustedByCategory: Record<SgCategory, number>
  rawByCategory: Record<SgCategory, number>
  sgTotal: number
  rawTotal: number
  penaltySgByCategory: Record<SgCategory, number>
  worstCategory: SgCategory | null
  /** Shots that have a strokes-gained value, with the round adjustment applied. */
  sgShots: StatSgShot[]
}

export type StatSgShot = {
  holeNumber: number
  type: SgLie
  distance: number | null
  category: SgCategory
  adjustedSG: number
  penaltySG: number
}

function zeroCategories(): Record<SgCategory, number> {
  return { OTT: 0, APP: 0, ARG: 0, PUTT: 0 }
}

export function buildRoundStats(input: RoundStatsInput): RoundStats {
  const holes = input.nineHoles ? input.holes.filter((hole) => hole.holeNumber <= 9) : input.holes
  const shots = input.nineHoles ? input.shots.filter((shot) => shot.holeNumber <= 9) : input.shots
  const played = holes.map((hole) => ({
    hole,
    shots: shotsOnHole(shots, hole.holeNumber),
  }))

  const defined: Array<{
    holeNumber: number
    rawSG: number
    penaltySG: number
    category: SgCategory
    type: SgLie
    distance: number | null
  }> = []
  for (const { hole, shots } of played) {
    for (const gained of holeStrokesGained(shots, hole.par, hole.holedOut)) {
      if (gained.rawSG == null) continue
      const source = shots[gained.index]
      if (!source || source.type === 'PENALTY') continue
      defined.push({
        holeNumber: hole.holeNumber,
        rawSG: gained.rawSG,
        penaltySG: gained.penaltySG,
        category: gained.category,
        type: source.type,
        distance: source.distance,
      })
    }
  }

  const counted = played.filter(({ hole, shots }) => hole.holedOut || shots.length > 0)
  const gross = counted.reduce((sum, { shots }) => sum + holeScore(shots), 0)
  const parTotal = counted.reduce((sum, { hole }) => sum + hole.par, 0)

  const adjusted = roundStrokesGained({
    shots: defined,
    score: gross,
    handicapScoreOverride: input.handicapScoreOverride,
    courseRating: input.courseRating,
    slopeRating: input.slopeRating,
    nineHoles: input.nineHoles,
    referenceHandicap: input.referenceHandicap,
    sgMode: input.sgMode,
  })

  const sgByHole = new Map<number, number>()
  defined.forEach((shot, index) => {
    const value = adjusted.shots[index]?.adjustedSG ?? 0
    sgByHole.set(shot.holeNumber, (sgByHole.get(shot.holeNumber) ?? 0) + value)
  })

  const card: ScorecardHole[] = played.map(({ hole, shots }) => {
    const hasScore = hole.holedOut || shots.length > 0
    const score = hasScore ? holeScore(shots) : null
    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      yards: hole.yards,
      holedOut: hole.holedOut,
      score,
      scoreToPar: score == null ? null : score - hole.par,
      kind: score == null || !hole.holedOut ? null : scoreKind(score, hole.par),
      putts: shots.filter((shot) => shot.type === 'PUTTS').length,
      penalties: shots.reduce(
        (sum, shot) => sum + (shot.type === 'PENALTY' ? shot.penaltyStrokes ?? 0 : 0),
        0
      ),
      adjustedSg: defined.some((shot) => shot.holeNumber === hole.holeNumber)
        ? (sgByHole.get(hole.holeNumber) ?? 0)
        : null,
      gir: hasScore ? greenInRegulation(hole, shots) : null,
      fairway: hole.par < 4 ? 'na' : hasScore ? fairwayHit(hole, shots) : null,
    }
  })

  const handicapScore = scoreForHandicap(gross, input.handicapScoreOverride)

  const started = played.filter(({ hole, shots }) => hole.holedOut || shots.length > 0)
  const fairwayHoles = started.filter(({ hole }) => hole.par >= 4)
  const drives: number[] = []
  for (const { hole, shots } of played) {
    shots.forEach((shot, index) => {
      if (shot.type !== 'TEE') return
      const yards = drivingDistance(hole, shots, index)
      if (yards != null) drives.push(yards)
    })
  }

  const penaltySgByCategory = zeroCategories()
  adjusted.shots.forEach((shot) => {
    penaltySgByCategory[shot.category] += shot.penaltySG
  })

  let worstCategory: SgCategory | null = null
  if (defined.length > 0) {
    for (const category of CATEGORIES) {
      if (
        worstCategory == null ||
        adjusted.adjustedByCategory[category] < adjusted.adjustedByCategory[worstCategory]
      ) {
        worstCategory = category
      }
    }
  }

  const scramblingHoles = played.filter(({ hole, shots }) =>
    shots.some((shot) => isArg(shot, hole.par))
  )

  return {
    holes: card,
    out: sideTotals(card.filter((hole) => hole.holeNumber <= 9)),
    in: sideTotals(card.filter((hole) => hole.holeNumber > 9)),
    total: sideTotals(card),
    score: gross,
    scoreToPar: gross - parTotal,
    par: parTotal,
    differential: handicapDifferential(handicapScore, input.courseRating, input.slopeRating),
    handicapScore,
    fairways: {
      hit: fairwayHoles.filter(({ hole, shots }) => fairwayHit(hole, shots)).length,
      chances: fairwayHoles.length,
    },
    greens: {
      hit: started.filter(({ hole, shots }) => greenInRegulation(hole, shots)).length,
      chances: started.length,
    },
    putts: played.reduce(
      (sum, { shots }) => sum + shots.filter((shot) => shot.type === 'PUTTS').length,
      0
    ),
    scrambling: {
      success: scramblingHoles.filter(({ hole, shots }) => scrambleResult(hole, shots) === 'success')
        .length,
      chances: scramblingHoles.length,
    },
    extraOntoGreen: played.reduce(
      (sum, { hole, shots }) => sum + (extraShotsOntoGreen(hole, shots) ?? 0),
      0
    ),
    extraNearGreen: played.reduce(
      (sum, { hole, shots }) => sum + (extraShotsNearGreen(hole, shots) ?? 0),
      0
    ),
    penaltyStrokes: played.reduce(
      (sum, { shots }) =>
        sum + shots.reduce((inner, shot) => inner + (shot.type === 'PENALTY' ? shot.penaltyStrokes ?? 0 : 0), 0),
      0
    ),
    drivingDistance: drives.length
      ? drives.reduce((sum, yards) => sum + yards, 0) / drives.length
      : null,
    eagles: card.filter((hole) => hole.kind === 'eagle').length,
    birdies: card.filter((hole) => hole.kind === 'birdie').length,
    pars: card.filter((hole) => hole.kind === 'par').length,
    bogeys: card.filter((hole) => hole.kind === 'bogey').length,
    doubles: card.filter((hole) => hole.kind === 'double').length,
    adjustedByCategory: adjusted.adjustedByCategory,
    rawByCategory: adjusted.rawByCategory,
    sgTotal: defined.length ? adjusted.total : 0,
    rawTotal: adjusted.rawTotal,
    penaltySgByCategory,
    worstCategory,
    sgShots: defined.map((shot, index) => ({
      holeNumber: shot.holeNumber,
      type: shot.type,
      distance: shot.distance,
      category: shot.category,
      adjustedSG: adjusted.shots[index]?.adjustedSG ?? shot.rawSG,
      penaltySG: shot.penaltySG,
    })),
  }
}
