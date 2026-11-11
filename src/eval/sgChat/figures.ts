import {
  averagesFor,
  CATEGORY_LABEL,
  prepareRounds,
  selectRounds,
  type AnalysisRound,
  type AnalysisRoundInput,
} from '../../golf/dashboard.ts'
import type { SgBriefScope } from '../../golf/sgExpertBrief.ts'
import type { SgCategory, SgMode } from '../../golf/strokesGained.ts'

const CATEGORIES: SgCategory[] = ['OTT', 'APP', 'ARG', 'PUTT']

/** One-decimal strokes gained, matching the figure the Stats page and the brief show. */
export function roundSg(value: number): number {
  return Number(value.toFixed(1))
}

/** Signed one-decimal strokes gained. Zero is `0`. */
export function formatSgFigure(value: number): string {
  const rounded = roundSg(value)
  if (rounded === 0) return '0'
  const body = Math.abs(rounded).toFixed(1)
  return rounded < 0 ? `-${body}` : `+${body}`
}

export type SgFigures = {
  roundCount: number
  adjustedTotal: number
  rawTotal: number
  categories: Array<{ label: string; adjusted: number; raw: number }>
}

/**
 * Strokes gained the Stats page would show for this reference handicap and mode.
 * Same finished-round selection as the expert brief.
 */
export function strokesGainedFigures(
  rounds: AnalysisRoundInput[],
  referenceHandicap: number,
  sgMode: SgMode,
  scope: SgBriefScope
): SgFigures {
  const prepared = prepareRounds(rounds, referenceHandicap, sgMode)
  const finished = selectRounds(prepared, {
    window: 'career',
    lastN: 5,
    seasonYear: new Date().getFullYear(),
    courseId: null,
  })
  const selected = scope.kind === 'round' ? finished.filter((round) => round.id === scope.roundId) : finished
  return figuresFor(selected)
}

function figuresFor(selected: AnalysisRound[]): SgFigures {
  const roundCount = selected.length
  const perRound = (total: number) => (roundCount === 0 ? 0 : total / roundCount)
  const averages = averagesFor(selected)
  return {
    roundCount,
    adjustedTotal: averages?.sgTotal ?? 0,
    rawTotal: perRound(selected.reduce((sum, round) => sum + round.stats.rawTotal, 0)),
    categories: CATEGORIES.map((category) => ({
      label: CATEGORY_LABEL[category],
      adjusted: perRound(
        selected.reduce((sum, round) => sum + round.stats.adjustedByCategory[category], 0)
      ),
      raw: perRound(selected.reduce((sum, round) => sum + round.stats.rawByCategory[category], 0)),
    })),
  }
}

/** Headline and category strokes gained at one decimal, adjusted for the reference handicap. */
export function adjustedMarks(figures: SgFigures): number[] {
  return [roundSg(figures.adjustedTotal), ...figures.categories.map((category) => roundSg(category.adjusted))]
}

/** The same lines as raw strokes gained versus the PGA Tour chart. */
export function rawMarks(figures: SgFigures): number[] {
  return [roundSg(figures.rawTotal), ...figures.categories.map((category) => roundSg(category.raw))]
}
