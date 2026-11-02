import baseline from './sg-baseline.json' with { type: 'json' }
import {
  averagesFor,
  categoryBars,
  prepareRounds,
  puttTable,
  selectRounds,
  yardTable,
  type AnalysisRound,
  type AnalysisRoundInput,
  type DashboardOptions,
} from './dashboard.ts'
import { holeScore } from './shotMath.js'
import { drivingDistance, shotsOnHole, type StatShot } from './roundStats.ts'

const PUTT_BINS = baseline.puttBinsFeet as [number, number][]
const YARD_BINS = baseline.yardBins as [number, number][]
const LIES = ['TEE', 'FAIRWAY', 'ROUGH', 'SAND', 'RECOVERY'] as const

const LIE_NAME: Record<(typeof LIES)[number], string> = {
  TEE: 'tee',
  FAIRWAY: 'fairway',
  ROUGH: 'rough',
  SAND: 'sand',
  RECOVERY: 'recovery',
}

export type SgExpertBrief = {
  roundCount: number
  text: string
}

export type SgBriefScope =
  | { kind: 'career' }
  | { kind: 'round'; roundId: string; label: string }

function signed(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits))
  if (rounded === 0) return '0'
  const body = Math.abs(rounded).toFixed(digits)
  return rounded < 0 ? `−${body}` : `+${body}`
}

function count(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits))
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits)
}

function amount(value: number, singular: string, plural: string): string {
  const text = count(value)
  return `${text} ${Number(text) === 1 ? singular : plural}`
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function perRound(total: number, rounds: number): number {
  return rounds === 0 ? 0 : total / rounds
}

type HolePlay = {
  round: AnalysisRound
  holeNumber: number
  par: number
  yards: number
  shots: StatShot[]
}

function holesOf(round: AnalysisRound, source: AnalysisRoundInput | undefined): HolePlay[] {
  if (!source) return []
  const limit = source.nineHoles ? 9 : 18
  return source.holes
    .filter((hole) => hole.holeNumber <= limit && hole.holedOut)
    .map((hole) => ({
      round,
      holeNumber: hole.holeNumber,
      par: hole.par,
      yards: hole.yards,
      shots: shotsOnHole(
        source.shots.filter((shot) => shot.holeNumber <= limit),
        hole.holeNumber
      ),
    }))
}

function firstPuttFeet(shots: StatShot[]): number | null {
  const putt = shots.find((shot) => shot.type === 'PUTTS' && shot.distance != null)
  return putt?.distance ?? null
}

function secondShotYards(shots: StatShot[]): number | null {
  const teeIndex = shots.findIndex((shot) => shot.type === 'TEE')
  if (teeIndex < 0) return null
  for (let index = teeIndex + 1; index < shots.length; index += 1) {
    const shot = shots[index]
    if (shot.type === 'PENALTY') continue
    if (shot.type === 'PUTTS' || shot.distance == null) return null
    return shot.distance
  }
  return null
}

/**
 * Plain-language stats for the Strokes Gained Expert.
 * Uses the same finished, included rounds as the career Stats page.
 */
export function buildSgExpertBrief(
  rounds: AnalysisRoundInput[],
  options: Pick<DashboardOptions, 'referenceHandicap' | 'sgMode'>,
  scope: SgBriefScope = { kind: 'career' }
): SgExpertBrief {
  const prepared = prepareRounds(rounds, options.referenceHandicap, options.sgMode)
  const finished = selectRounds(prepared, {
    window: 'career',
    lastN: 5,
    seasonYear: new Date().getFullYear(),
    courseId: null,
  })
  const selected = scope.kind === 'round' ? finished.filter((round) => round.id === scope.roundId) : finished
  if (scope.kind === 'round' && selected.length === 0) {
    return {
      roundCount: 0,
      text: `${scope.label} is not in the stats. It is still in progress, or it is left out of analysis.`,
    }
  }
  if (selected.length === 0) {
    return {
      roundCount: 0,
      text: 'Finished rounds included in analysis: 0. There is nothing to explain until a round is finished and included in analysis. In-progress rounds are left out.',
    }
  }

  const byId = new Map(rounds.map((round) => [round.id, round]))
  const plays = selected.flatMap((round) => holesOf(round, byId.get(round.id)))
  const roundCount = selected.length
  const averages = averagesFor(selected)
  const bars = categoryBars(selected)
  const comparison =
    options.sgMode === 'raw'
      ? 'The strokes gained numbers are raw, compared with the PGA Tour chart. The reference handicap is not used.'
      : `The strokes gained numbers match the Stats page: handicap-adjusted, compared with a ${count(options.referenceHandicap, 1)} handicap. Raw strokes gained versus the PGA Tour chart is shown in brackets.`

  const each = scope.kind === 'round' ? 'this round' : 'per round'
  const lines = [
    scope.kind === 'round'
      ? `Scope: one round, ${scope.label}. The figures are for this round, not an average.`
      : `Scope: average across ${roundCount} finished round${roundCount === 1 ? '' : 's'}.`,
    'In-progress rounds are left out.',
    comparison,
    '',
    scope.kind === 'round' ? 'This round' : 'Per round',
    `Score: ${count(averages?.score ?? 0)}`,
    `Strokes gained: ${signed(averages?.sgTotal ?? 0)} (raw ${signed(perRound(selected.reduce((sum, round) => sum + round.stats.rawTotal, 0), roundCount))})`,
    ...bars.map((bar) => {
      const raw = perRound(
        selected.reduce((sum, round) => sum + round.stats.rawByCategory[bar.category], 0),
        roundCount
      )
      return `${bar.label}: ${signed(bar.perRound)} (raw ${signed(raw)}; penalties ${signed(bar.penaltyPerRound)})`
    }),
    `Putts: ${count(averages?.putts ?? 0)}`,
    `Driving distance: ${averages?.drivingDistance == null ? 'not measured' : `${count(averages.drivingDistance, 0)} yards`}`,
    `Fairways: ${count(averages?.fairwayHits ?? 0)} of ${count(averages?.fairwayChances ?? 0)}`,
    `Greens: ${count(averages?.greenHits ?? 0)} of ${count(averages?.greenChances ?? 0)}`,
    `Scrambling: ${count(averages?.scrambleSuccess ?? 0)} of ${count(averages?.scrambleChances ?? 0)}`,
    `Penalty strokes: ${count(averages?.penaltyStrokes ?? 0)}`,
    '',
    'Putting. The putt count treats every putt as equal. Strokes gained scores each putt from the distance it started, using the chart for that distance. A two-putt from long range can be fine. A miss from close range loses strokes.',
  ]

  const puttCells = puttTable(selected)
  PUTT_BINS.forEach(([lo, hi], index) => {
    const cell = puttCells[index]
    if (!cell || cell.shotsPerRound == null || cell.shotsPerRound === 0) return
    lines.push(
      `${lo}–${hi} ft: ${amount(cell.shotsPerRound ?? 0, 'putt', 'putts')} ${each}, strokes gained ${signed(cell.sgPerRound ?? 0)}`
    )
  })

  const firstPutts = plays
    .map((hole) => firstPuttFeet(hole.shots))
    .filter((feet): feet is number => feet != null)
  const threePutts = plays.filter((hole) => hole.shots.filter((shot) => shot.type === 'PUTTS').length >= 3)
  lines.push(
    `First putt: ${firstPutts.length === 0 ? 'none recorded' : `${count(mean(firstPutts) ?? 0, 0)} ft on average, ${count(perRound(firstPutts.length, roundCount))} ${each}`}`
  )
  lines.push(`Holes with 3 or more putts: ${count(perRound(threePutts.length, roundCount))} ${each}`)

  lines.push('', 'By par. Strokes gained here is the whole hole, per hole.')
  for (const par of [3, 4, 5]) {
    const holes = plays.filter((hole) => hole.par === par)
    if (holes.length === 0) {
      lines.push(`Par ${par}: none`)
      continue
    }
    const scores = holes.map((hole) => holeScore(hole.shots))
    const sg = holes.map(
      (hole) => hole.round.stats.holes.find((item) => item.holeNumber === hole.holeNumber)?.adjustedSg ?? null
    )
    const known = sg.filter((value): value is number => value != null)
    lines.push(
      `Par ${par}: ${amount(holes.length, 'hole', 'holes')}, average score ${count(mean(scores) ?? 0)} (${signed((mean(scores) ?? 0) - par)} to par), strokes gained ${known.length ? signed(mean(known) ?? 0) : 'unknown'} per hole`
    )
  }

  const par5 = plays.filter((hole) => hole.par === 5)
  const travels = par5
    .map((hole) =>
      drivingDistance(
        { holeNumber: hole.holeNumber, par: hole.par, yards: hole.yards, holedOut: true },
        hole.shots,
        hole.shots.findIndex((shot) => shot.type === 'TEE')
      )
    )
    .filter((yards): yards is number => yards != null)
  const left = par5
    .map((hole) => secondShotYards(hole.shots))
    .filter((yards): yards is number => yards != null)
  lines.push(
    `Par 5 tee shots travelled: ${travels.length ? `${count(mean(travels) ?? 0, 0)} yards` : 'not measured'}`
  )
  lines.push(
    `Par 5 yards left for the next shot: ${left.length ? `${count(mean(left) ?? 0, 0)} yards` : 'not measured'}`
  )

  const lies = lieLines(selected, each)
  if (lies.length > 0) {
    lines.push(
      '',
      'By starting lie and distance. This is the off-the-tee, approach, and short-game detail. The same yardage costs more from the rough, sand, or a recovery lie than from the fairway or the tee.'
    )
    lies.forEach((line) => lines.push(line))
  }

  return { roundCount, text: lines.join('\n') }
}

function lieLines(rounds: AnalysisRound[], each: string): string[] {
  const table = yardTable(rounds)
  const cells: { line: string; sg: number }[] = []
  YARD_BINS.forEach(([lo, hi], bin) => {
    LIES.forEach((lie, lieIndex) => {
      const cell = table.cells[bin]?.[lieIndex]
      if (!cell?.shotsPerRound) return
      cells.push({
        sg: cell.sgPerRound ?? 0,
        line: `${lo}–${hi} yds from the ${LIE_NAME[lie]}: ${amount(cell.shotsPerRound ?? 0, 'shot', 'shots')} ${each}, strokes gained ${signed(cell.sgPerRound ?? 0)}`,
      })
    })
  })
  return cells
    .sort((a, b) => a.sg - b.sg)
    .slice(0, 24)
    .map((cell) => cell.line)
}
