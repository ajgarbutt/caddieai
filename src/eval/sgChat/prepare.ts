import type { AnalysisRoundInput } from '../../golf/dashboard.ts'
import { formatReferenceHandicap } from '../../golf/roundFormat.js'
import { DEFAULT_REFERENCE_HANDICAP } from '../../golf/schema.js'
import { SEED_COURSE, seedDashboardInputs } from '../../golf/seedRounds.ts'
import { buildSgExpertBrief, type SgBriefScope } from '../../golf/sgExpertBrief.ts'
import { expertRoundLabel, resolveSgScope, type ExpertRound } from '../../golf/sgExpertScope.ts'
import type { SgEvalCase, SgEvalDistractor } from './cases.ts'
import { roundSg, strokesGainedFigures } from './figures.ts'
import { distractorMode, type FigureSet, type PreparedSgEval } from './referenceHandicap.ts'

/** Fixed clock so a question that names a date does not follow the machine date. */
const EVAL_TODAY = new Date(2026, 10, 5)

/**
 * Build the same brief the Strokes Gained Expert sees, plus the strokes gained
 * at the reference handicap and at the baselines it must not be confused with.
 */
export function prepareSgEvalCase(evalCase: SgEvalCase, today = EVAL_TODAY): PreparedSgEval {
  const rounds = seedDashboardInputs()
  const choice = resolveSgScope(evalCase.question, catalog(rounds), null, today)
  if (choice.kind !== 'career' && choice.kind !== 'round') {
    throw new Error(
      `${evalCase.id} resolved to ${choice.kind}, so the expert would not analyse the stats.`
    )
  }
  const scope: SgBriefScope =
    choice.kind === 'round'
      ? { kind: 'round', roundId: choice.round.id, label: expertRoundLabel(choice.round) }
      : { kind: 'career' }
  const brief = buildSgExpertBrief(
    rounds,
    { referenceHandicap: evalCase.referenceHandicap, sgMode: evalCase.sgMode },
    scope
  )
  return {
    evalCase,
    scope,
    brief: brief.text,
    expected: strokesGainedFigures(rounds, evalCase.referenceHandicap, evalCase.sgMode, scope),
    distractors: distractorFigures(rounds, evalCase, scope),
  }
}

function catalog(rounds: AnalysisRoundInput[]): ExpertRound[] {
  return rounds.map((round) => ({
    id: round.id,
    playedAt: round.playedAt,
    createdAt: round.createdAt,
    courseName: SEED_COURSE.name,
    finished: round.status === 'complete',
  }))
}

function distractorFigures(
  rounds: AnalysisRoundInput[],
  evalCase: SgEvalCase,
  scope: SgBriefScope
): FigureSet[] {
  return dedupe(evalCase, [...evalCase.distractors, ...automaticDistractors(evalCase)])
    .filter((spec) => !sameAnalysis(evalCase, scope, spec))
    .map((spec) => ({
      label: spec.label,
      figures: strokesGainedFigures(
        rounds,
        spec.referenceHandicap,
        distractorMode(evalCase, spec.sgMode),
        spec.scope === 'career' ? { kind: 'career' } : scope
      ),
    }))
}

function automaticDistractors(evalCase: SgEvalCase): SgEvalDistractor[] {
  if (evalCase.sgMode === 'raw') {
    const specs: SgEvalDistractor[] = [
      {
        label: `handicap-adjusted at ${formatReferenceHandicap(evalCase.referenceHandicap)}`,
        referenceHandicap: evalCase.referenceHandicap,
        sgMode: 'handicap',
      },
    ]
    if (roundSg(evalCase.referenceHandicap) !== DEFAULT_REFERENCE_HANDICAP) {
      specs.push({
        label: 'handicap-adjusted at the default 18',
        referenceHandicap: DEFAULT_REFERENCE_HANDICAP,
        sgMode: 'handicap',
      })
    }
    if (
      roundSg(evalCase.playerHandicap) !== roundSg(evalCase.referenceHandicap) &&
      roundSg(evalCase.playerHandicap) !== DEFAULT_REFERENCE_HANDICAP
    ) {
      specs.push({
        label: `handicap-adjusted at the player handicap ${formatReferenceHandicap(evalCase.playerHandicap)}`,
        referenceHandicap: evalCase.playerHandicap,
        sgMode: 'handicap',
      })
    }
    return specs
  }

  const specs: SgEvalDistractor[] = []
  const add = (label: string, referenceHandicap: number) => {
    if (roundSg(referenceHandicap) === roundSg(evalCase.referenceHandicap)) return
    specs.push({ label, referenceHandicap })
  }
  add(`player handicap ${formatReferenceHandicap(evalCase.playerHandicap)}`, evalCase.playerHandicap)
  add('default reference handicap 18', DEFAULT_REFERENCE_HANDICAP)
  add('scratch', 0)
  return specs
}

function sameAnalysis(evalCase: SgEvalCase, scope: SgBriefScope, spec: SgEvalDistractor): boolean {
  const sameScope = (spec.scope ?? 'same') === 'same' || (spec.scope === 'career' && scope.kind === 'career')
  return (
    sameScope &&
    distractorMode(evalCase, spec.sgMode) === evalCase.sgMode &&
    roundSg(spec.referenceHandicap) === roundSg(evalCase.referenceHandicap)
  )
}

function dedupe(evalCase: SgEvalCase, specs: SgEvalDistractor[]): SgEvalDistractor[] {
  const seen = new Set<string>()
  const kept: SgEvalDistractor[] = []
  for (const spec of specs) {
    const key = `${distractorMode(evalCase, spec.sgMode)}|${spec.scope ?? 'same'}|${roundSg(spec.referenceHandicap)}`
    if (seen.has(key)) continue
    seen.add(key)
    kept.push(spec)
  }
  return kept
}
