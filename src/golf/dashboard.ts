import baseline from './sg-baseline.json' with { type: 'json' }
import {
  buildRoundStats,
  type RoundStats,
  type RoundStatsInput,
  type StatSgShot,
} from './roundStats.ts'
import type { SgCategory, SgMode } from './strokesGained.ts'

export type RoundWindow = 'career' | 'season' | 'last'

export type TrendKey =
  | 'sgTotal'
  | 'OTT'
  | 'APP'
  | 'ARG'
  | 'PUTT'
  | 'score'
  | 'scoreToPar'
  | 'putts'
  | 'penalties'
  | 'differential'
  | 'fairways'
  | 'greens'
  | 'driving'

const CATEGORIES: SgCategory[] = ['OTT', 'APP', 'ARG', 'PUTT']

export const CATEGORY_LABEL: Record<SgCategory, string> = {
  OTT: 'Off the tee',
  APP: 'Approach',
  ARG: 'Around the green',
  PUTT: 'Putting',
}

const LIE_ORDER = ['TEE', 'FAIRWAY', 'ROUGH', 'SAND', 'RECOVERY'] as const
type YardLie = (typeof LIE_ORDER)[number]

export const LIE_LABEL: Record<YardLie | 'TOTAL', string> = {
  TEE: 'Tee',
  FAIRWAY: 'Fairway',
  ROUGH: 'Rough',
  SAND: 'Sand',
  RECOVERY: 'Recovery',
  TOTAL: 'Total',
}

const YARD_BINS = baseline.yardBins as [number, number][]
const PUTT_BINS = baseline.puttBinsFeet as [number, number][]

export type RoundPlayStatus = 'in_progress' | 'complete'

export type AnalysisRoundInput = {
  id: string
  playedAt: string
  createdAt: string
  courseId: string
  status: RoundPlayStatus
  includeInAnalysis: boolean
  nineHoles?: boolean
  courseRating: number
  slopeRating: number
  handicapScoreOverride?: number | null
  holes: RoundStatsInput['holes']
  shots: RoundStatsInput['shots']
}

export type AnalysisRound = {
  id: string
  playedAt: string
  createdAt: string
  courseId: string
  status: RoundPlayStatus
  includeInAnalysis: boolean
  stats: RoundStats
}

export type DashboardOptions = {
  window: RoundWindow
  lastN: number
  seasonYear: number
  courseId: string | null
  referenceHandicap: number
  sgMode: SgMode
}

export type BinMetric = {
  sgPerRound: number | null
  shotsPerRound: number | null
  sgPerShot: number | null
}

export type CategoryBar = {
  category: SgCategory
  label: string
  perRound: number
  penaltyPerRound: number
  /** Share of the widest bar, from 0 to 1. */
  width: number
  worst: boolean
}

export type TrendPoint = {
  playedAt: string
  value: number | null
  average: number | null
}

export type HoleAverage = {
  holeNumber: number
  rounds: number
  score: number
  adjustedSg: number | null
}

export type DashboardAverages = {
  fairwayHits: number
  fairwayChances: number
  greenHits: number
  greenChances: number
  putts: number
  scrambleSuccess: number
  scrambleChances: number
  extraOntoGreen: number
  extraNearGreen: number
  penaltyStrokes: number
  drivingDistance: number | null
  eagles: number
  birdies: number
  pars: number
  bogeys: number
  doubles: number
  score: number
  scoreToPar: number
  differential: number
  sgTotal: number
  handicapIndex: number | null
}

export type DashboardView = {
  roundCount: number
  headline: { category: SgCategory; label: string; perRound: number; negative: boolean } | null
  bars: CategoryBar[]
  averages: DashboardAverages | null
  yardBins: { label: string }[]
  yardLies: { key: YardLie | 'TOTAL'; label: string }[]
  yardCells: BinMetric[][]
  puttBins: { label: string }[]
  puttCells: BinMetric[]
  holes: HoleAverage[] | null
  practice: string | null
  rounds: AnalysisRound[]
}

function byDateDesc(a: AnalysisRound, b: AnalysisRound) {
  return b.playedAt.localeCompare(a.playedAt) || b.createdAt.localeCompare(a.createdAt)
}

function byDateAsc(a: AnalysisRound, b: AnalysisRound) {
  return a.playedAt.localeCompare(b.playedAt) || a.createdAt.localeCompare(b.createdAt)
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function roundHasScore(stats: RoundStats) {
  return stats.holes.some((hole) => hole.score != null)
}

export function prepareRounds(
  rounds: AnalysisRoundInput[],
  referenceHandicap: number,
  sgMode: SgMode
): AnalysisRound[] {
  return rounds.map((round) => ({
    id: round.id,
    playedAt: round.playedAt,
    createdAt: round.createdAt,
    courseId: round.courseId,
    status: round.status,
    includeInAnalysis: round.includeInAnalysis,
    stats: buildRoundStats({
      holes: round.holes,
      shots: round.shots,
      courseRating: round.courseRating,
      slopeRating: round.slopeRating,
      nineHoles: round.nineHoles,
      handicapScoreOverride: round.handicapScoreOverride,
      referenceHandicap,
      sgMode,
    }),
  }))
}

/**
 * Career, this calendar year, or the most recent N.
 * In-progress rounds, rounds left out of analysis, and rounds with no score
 * are left out of every window. A course filter narrows every window.
 */
export function selectRounds(
  rounds: AnalysisRound[],
  options: Pick<DashboardOptions, 'window' | 'lastN' | 'seasonYear' | 'courseId'>
): AnalysisRound[] {
  let selected = rounds.filter(
    (round) =>
      round.status === 'complete' && round.includeInAnalysis && roundHasScore(round.stats)
  )
  if (options.courseId) selected = selected.filter((round) => round.courseId === options.courseId)
  if (options.window === 'season') {
    const prefix = `${options.seasonYear}-`
    selected = selected.filter((round) => round.playedAt.startsWith(prefix))
  } else if (options.window === 'last') {
    const count = Math.max(1, Math.floor(options.lastN))
    selected = [...selected].sort(byDateDesc).slice(0, count)
  }
  return [...selected].sort(byDateDesc)
}

/** Average of the lowest 8 differentials among the most recent 20 selected rounds. */
export function handicapIndex(rounds: AnalysisRound[]): number | null {
  const recent = [...rounds].sort(byDateDesc).slice(0, 20)
  if (recent.length < 8) return null
  const lowest = recent
    .map((round) => round.stats.differential)
    .sort((a, b) => a - b)
    .slice(0, 8)
  return lowest.reduce((sum, value) => sum + value, 0) / 8
}

function binIndex(bins: [number, number][], distance: number): number {
  return bins.findIndex(([lo, hi]) => distance >= lo && distance <= hi)
}

function emptyMetric(): { sg: number; shots: number } {
  return { sg: 0, shots: 0 }
}

function toMetric(cell: { sg: number; shots: number }, rounds: number): BinMetric {
  if (cell.shots === 0) return { sgPerRound: null, shotsPerRound: null, sgPerShot: null }
  return {
    sgPerRound: rounds === 0 ? null : cell.sg / rounds,
    shotsPerRound: rounds === 0 ? null : cell.shots / rounds,
    sgPerShot: cell.sg / cell.shots,
  }
}

export function categoryBars(rounds: AnalysisRound[]): CategoryBar[] {
  const count = rounds.length
  const bars = CATEGORIES.map((category) => {
    const perRound =
      count === 0
        ? 0
        : rounds.reduce((sum, round) => sum + round.stats.adjustedByCategory[category], 0) / count
    const penaltyPerRound =
      count === 0
        ? 0
        : rounds.reduce((sum, round) => sum + round.stats.penaltySgByCategory[category], 0) / count
    return { category, label: CATEGORY_LABEL[category], perRound, penaltyPerRound, width: 0, worst: false }
  })
  bars.sort((a, b) => a.perRound - b.perRound)
  const peak = Math.max(...bars.map((bar) => Math.abs(bar.perRound)))
  bars.forEach((bar, index) => {
    bar.width = peak === 0 ? 0 : Math.abs(bar.perRound) / peak
    bar.worst = index === 0 && bar.perRound < 0
  })
  return bars
}

export function averagesFor(rounds: AnalysisRound[]): DashboardAverages | null {
  if (rounds.length === 0) return null
  const count = rounds.length
  const divide = (total: number) => total / count
  const drives = rounds
    .map((round) => round.stats.drivingDistance)
    .filter((value): value is number => value != null)
  return {
    fairwayHits: divide(rounds.reduce((sum, round) => sum + round.stats.fairways.hit, 0)),
    fairwayChances: divide(rounds.reduce((sum, round) => sum + round.stats.fairways.chances, 0)),
    greenHits: divide(rounds.reduce((sum, round) => sum + round.stats.greens.hit, 0)),
    greenChances: divide(rounds.reduce((sum, round) => sum + round.stats.greens.chances, 0)),
    putts: divide(rounds.reduce((sum, round) => sum + round.stats.putts, 0)),
    scrambleSuccess: divide(rounds.reduce((sum, round) => sum + round.stats.scrambling.success, 0)),
    scrambleChances: divide(rounds.reduce((sum, round) => sum + round.stats.scrambling.chances, 0)),
    extraOntoGreen: divide(rounds.reduce((sum, round) => sum + round.stats.extraOntoGreen, 0)),
    extraNearGreen: divide(rounds.reduce((sum, round) => sum + round.stats.extraNearGreen, 0)),
    penaltyStrokes: divide(rounds.reduce((sum, round) => sum + round.stats.penaltyStrokes, 0)),
    drivingDistance: mean(drives),
    eagles: divide(rounds.reduce((sum, round) => sum + round.stats.eagles, 0)),
    birdies: divide(rounds.reduce((sum, round) => sum + round.stats.birdies, 0)),
    pars: divide(rounds.reduce((sum, round) => sum + round.stats.pars, 0)),
    bogeys: divide(rounds.reduce((sum, round) => sum + round.stats.bogeys, 0)),
    doubles: divide(rounds.reduce((sum, round) => sum + round.stats.doubles, 0)),
    score: divide(rounds.reduce((sum, round) => sum + round.stats.score, 0)),
    scoreToPar: divide(rounds.reduce((sum, round) => sum + round.stats.scoreToPar, 0)),
    differential: divide(rounds.reduce((sum, round) => sum + round.stats.differential, 0)),
    sgTotal: divide(rounds.reduce((sum, round) => sum + round.stats.sgTotal, 0)),
    handicapIndex: handicapIndex(rounds),
  }
}

function shotsOf(rounds: AnalysisRound[]): StatSgShot[] {
  return rounds.flatMap((round) => round.stats.sgShots)
}

export function yardTable(rounds: AnalysisRound[]): { cells: BinMetric[][] } {
  const grid = YARD_BINS.map(() => LIE_ORDER.map(() => emptyMetric()))
  for (const shot of shotsOf(rounds)) {
    if (shot.type === 'PUTTS' || shot.distance == null) continue
    const bin = binIndex(YARD_BINS, shot.distance)
    const lie = LIE_ORDER.indexOf(shot.type as YardLie)
    if (bin < 0 || lie < 0) continue
    grid[bin][lie].sg += shot.adjustedSG
    grid[bin][lie].shots += 1
  }
  return {
    cells: grid.map((row) => {
      const total = row.reduce(
        (sum, cell) => ({ sg: sum.sg + cell.sg, shots: sum.shots + cell.shots }),
        emptyMetric()
      )
      return [...row, total].map((cell) => toMetric(cell, rounds.length))
    }),
  }
}

export function puttTable(rounds: AnalysisRound[]): BinMetric[] {
  const row = PUTT_BINS.map(() => emptyMetric())
  for (const shot of shotsOf(rounds)) {
    if (shot.type !== 'PUTTS' || shot.distance == null || shot.distance < PUTT_BINS[0][0]) continue
    const bin = binIndex(PUTT_BINS, shot.distance)
    if (bin < 0) continue
    row[bin].sg += shot.adjustedSG
    row[bin].shots += 1
  }
  return row.map((cell) => toMetric(cell, rounds.length))
}

function trendValue(round: AnalysisRound, key: TrendKey): number | null {
  const stats = round.stats
  if (key === 'sgTotal') return stats.sgTotal
  if (key === 'OTT' || key === 'APP' || key === 'ARG' || key === 'PUTT') {
    return stats.adjustedByCategory[key]
  }
  if (key === 'score') return stats.score
  if (key === 'scoreToPar') return stats.scoreToPar
  if (key === 'putts') return stats.putts
  if (key === 'penalties') return stats.penaltyStrokes
  if (key === 'differential') return stats.differential
  if (key === 'fairways') {
    return stats.fairways.chances === 0 ? null : stats.fairways.hit / stats.fairways.chances
  }
  if (key === 'greens') {
    return stats.greens.chances === 0 ? null : stats.greens.hit / stats.greens.chances
  }
  return stats.drivingDistance
}

/** Chronological values, with a trailing average of the last `running` rounds when asked. */
export function trendSeries(rounds: AnalysisRound[], key: TrendKey, running: number | null): TrendPoint[] {
  const ordered = [...rounds].sort(byDateAsc)
  return ordered.map((round, index) => {
    const value = trendValue(round, key)
    if (running == null || running < 1) return { playedAt: round.playedAt, value, average: null }
    const window = ordered
      .slice(Math.max(0, index - running + 1), index + 1)
      .map((item) => trendValue(item, key))
      .filter((item): item is number => item != null)
    return { playedAt: round.playedAt, value, average: mean(window) }
  })
}

export function holeAverages(rounds: AnalysisRound[]): HoleAverage[] {
  const holes: HoleAverage[] = []
  for (let holeNumber = 1; holeNumber <= 18; holeNumber += 1) {
    const played = rounds.flatMap((round) =>
      round.stats.holes.filter((hole) => hole.holeNumber === holeNumber && hole.score != null)
    )
    if (played.length === 0) continue
    const sg = played
      .map((hole) => hole.adjustedSg)
      .filter((value): value is number => value != null)
    holes.push({
      holeNumber,
      rounds: played.length,
      score: played.reduce((sum, hole) => sum + (hole.score ?? 0), 0) / played.length,
      adjustedSg: mean(sg),
    })
  }
  return holes
}

const PRACTICE_ADVICE: Record<SgCategory, string> = {
  OTT: 'Practise starting the ball on your line from this distance.',
  APP: 'Practise advancing the ball to a comfortable wedge distance instead.',
  ARG: 'Practise getting the ball onto the green and close enough for one putt.',
  PUTT: 'Practise the pace of these putts until they become automatic.',
}

function binLabel(lo: number, hi: number, unit: 'yds' | 'ft') {
  return `${lo}–${hi} ${unit}`
}

export function practiceFocus(rounds: AnalysisRound[]): string | null {
  const bars = categoryBars(rounds)
  const worst = bars.find((bar) => bar.worst) ?? bars[0]
  if (!worst || rounds.length === 0) return null
  const category = worst.category
  const shots = shotsOf(rounds).filter((shot) => shot.category === category)
  if (category === 'PUTT') {
    let worstBin = -1
    let worstSg = Infinity
    PUTT_BINS.forEach((_, index) => {
      const cell = puttTable(rounds)[index]
      if (cell.sgPerRound == null || cell.sgPerRound >= worstSg) return
      worstSg = cell.sgPerRound
      worstBin = index
    })
    if (worstBin < 0) {
      return `Most of your lost strokes are putts. ${PRACTICE_ADVICE.PUTT}`
    }
    const [lo, hi] = PUTT_BINS[worstBin]
    return `Most of your lost strokes are putts from ${binLabel(lo, hi, 'ft')}. ${PRACTICE_ADVICE.PUTT}`
  }

  const cells = new Map<string, { bin: number; lie: number; sg: number }>()
  for (const shot of shots) {
    if (shot.distance == null) continue
    const bin = binIndex(YARD_BINS, shot.distance)
    const lie = LIE_ORDER.indexOf(shot.type as YardLie)
    if (bin < 0 || lie < 0) continue
    const key = `${bin}:${lie}`
    const cell = cells.get(key) ?? { bin, lie, sg: 0 }
    cell.sg += shot.adjustedSG
    cells.set(key, cell)
  }
  let worstBin = -1
  let worstLie = 0
  let worstSg = Infinity
  for (const cell of cells.values()) {
    const perRound = cell.sg / rounds.length
    if (perRound >= worstSg) continue
    worstSg = perRound
    worstBin = cell.bin
    worstLie = cell.lie
  }

  const name =
    category === 'OTT'
      ? 'off the tee'
      : category === 'APP'
        ? 'approach shots'
        : 'shots around the green'
  if (worstBin < 0) {
    return `Most of your lost strokes are ${name}. ${PRACTICE_ADVICE[category]}`
  }
  const [lo, hi] = YARD_BINS[worstBin]
  const lie = LIE_LABEL[LIE_ORDER[worstLie]].toLowerCase()
  const place = category === 'OTT' ? '' : ` in the ${lie}`
  return `Most of your lost strokes are ${name} from ${binLabel(lo, hi, 'yds')}${place}. ${PRACTICE_ADVICE[category]}`
}

/** Largest absolute value, used to colour a table from red to green. */
export function peakMagnitude(values: Array<number | null>): number {
  const peak = values.reduce((max, value) => {
    if (value == null) return max
    return Math.max(max, Math.abs(value))
  }, 0)
  return peak === 0 ? 1 : peak
}

export function heatColor(value: number | null, peak: number): string {
  if (value == null || value === 0 || peak === 0) return 'transparent'
  const strength = Math.min(1, Math.abs(value) / peak)
  const alpha = 0.12 + strength * 0.55
  return value < 0 ? `rgba(220, 38, 38, ${alpha})` : `rgba(22, 120, 70, ${alpha})`
}

export function buildDashboard(rounds: AnalysisRoundInput[], options: DashboardOptions): DashboardView {
  const prepared = prepareRounds(rounds, options.referenceHandicap, options.sgMode)
  const selected = selectRounds(prepared, options)
  const bars = categoryBars(selected)
  const worst = bars.find((bar) => bar.perRound === Math.min(...bars.map((item) => item.perRound)))
  const yard = yardTable(selected)
  return {
    roundCount: selected.length,
    headline:
      selected.length === 0 || !worst
        ? null
        : {
            category: worst.category,
            label: worst.label,
            perRound: worst.perRound,
            negative: worst.perRound < 0,
          },
    bars,
    averages: averagesFor(selected),
    yardBins: YARD_BINS.map(([lo, hi]) => ({ label: binLabel(lo, hi, 'yds') })),
    yardLies: [...LIE_ORDER, 'TOTAL' as const].map((key) => ({ key, label: LIE_LABEL[key] })),
    yardCells: yard.cells,
    puttBins: PUTT_BINS.map(([lo, hi]) => ({ label: binLabel(lo, hi, 'ft') })),
    puttCells: puttTable(selected),
    holes: options.courseId ? holeAverages(selected) : null,
    practice: practiceFocus(selected),
    rounds: selected,
  }
}
