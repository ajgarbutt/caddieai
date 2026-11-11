import { formatReferenceHandicap } from '../../golf/roundFormat.js'
import type { SgMode } from '../../golf/strokesGained.ts'
import type { SgEvalCase } from './cases.ts'
import {
  adjustedMarks,
  formatSgFigure,
  rawMarks,
  roundSg,
  type SgFigures,
} from './figures.ts'
import type { SgBriefScope } from '../../golf/sgExpertBrief.ts'

export type FigureSet = {
  label: string
  figures: SgFigures
}

export type PreparedSgEval = {
  evalCase: SgEvalCase
  scope: SgBriefScope
  brief: string
  expected: SgFigures
  distractors: FigureSet[]
}

export type EvalCheck = {
  id: string
  pass: boolean
  detail: string
}

export type EvalScore = {
  pass: boolean
  summary: string
  checks: EvalCheck[]
}

const CATEGORY_LABELS = ['Off the tee', 'Approach', 'Around the green', 'Putting'] as const
const MINUS = '−'

/**
 * Ground truth for the analysis the model is shown.
 * The brief must name the reference handicap and quote the strokes gained that handicap produces.
 */
export function scoreReferenceHandicapAnalysis(prepared: PreparedSgEval): EvalScore {
  const { evalCase, brief, expected, distractors } = prepared
  const checks: EvalCheck[] = []
  const handicap = formatReferenceHandicap(evalCase.referenceHandicap)

  checks.push(separableCheck(expected, distractors))

  if (expected.roundCount === 0) {
    checks.push({ id: 'rounds', pass: false, detail: 'No finished rounds were analysed.' })
  } else {
    checks.push({
      id: 'rounds',
      pass: true,
      detail: `${expected.roundCount} finished round${expected.roundCount === 1 ? '' : 's'} analysed.`,
    })
  }

  checks.push(baselineCheck(brief, evalCase))
  checks.push(...figureChecks(brief, expected))

  const pass = checks.every((check) => check.pass)
  const summary = evalCase.sgMode === 'raw'
    ? `Raw strokes gained ${formatSgFigure(expected.adjustedTotal)}. Reference handicap ${handicap} is not applied.`
    : `Reference handicap ${handicap}. Strokes gained ${formatSgFigure(expected.adjustedTotal)} (raw ${formatSgFigure(expected.rawTotal)}).`
  return { pass, summary, checks }
}

/**
 * Ground truth for the reply. A reply fails when it names another baseline, quotes another
 * handicap's strokes gained, or (in handicap mode) quotes only the raw PGA Tour figures.
 */
export function scoreReferenceHandicapFeedback(prepared: PreparedSgEval, reply: string): EvalScore {
  const text = reply.trim()
  const checks: EvalCheck[] = []
  const handicap = formatReferenceHandicap(prepared.evalCase.referenceHandicap)

  if (!text) {
    checks.push({ id: 'reply', pass: false, detail: 'The reply is empty.' })
    return { pass: false, summary: 'No reply to score.', checks }
  }
  checks.push({ id: 'reply', pass: true, detail: 'The reply is present.' })
  checks.push(namedBaselineCheck(text, prepared.evalCase))
  checks.push(scratchCheck(text, prepared.evalCase))
  checks.push(citedFigureCheck(text, prepared))

  const pass = checks.every((check) => check.pass)
  const summary = pass
    ? `Reply stays on reference handicap ${handicap}.`
    : `Reply does not stay on reference handicap ${handicap}.`
  return { pass, summary, checks }
}

function separableCheck(expected: SgFigures, distractors: FigureSet[]): EvalCheck {
  const expectedMarks = adjustedMarks(expected).join(',')
  const collided = distractors.filter((distractor) => adjustedMarks(distractor.figures).join(',') === expectedMarks)
  if (collided.length === 0) {
    return {
      id: 'separable',
      pass: true,
      detail: 'Each other baseline produces different strokes gained at one decimal.',
    }
  }
  return {
    id: 'separable',
    pass: false,
    detail: `These baselines round to the same strokes gained, so the case cannot tell them apart: ${collided.map((item) => item.label).join(', ')}.`,
  }
}

function baselineCheck(brief: string, evalCase: SgEvalCase): EvalCheck {
  const named = handicapsIn(brief, /compared with a (\+|-|−)?(\d+(?:\.\d+)?) handicap/g)
  if (evalCase.sgMode === 'raw') {
    const saysUnused = brief.includes('The reference handicap is not used.')
    if (saysUnused && named.length === 0) {
      return {
        id: 'baseline',
        pass: true,
        detail: 'Brief says the reference handicap is not used.',
      }
    }
    return {
      id: 'baseline',
      pass: false,
      detail: saysUnused
        ? `Raw brief also compares with ${named.map(displayHandicap).join(', ')}.`
        : 'Raw brief does not say that the reference handicap is unused.',
    }
  }

  const handicap = formatReferenceHandicap(evalCase.referenceHandicap)
  if (named.length === 1 && sameHandicap(named[0], evalCase.referenceHandicap)) {
    return { id: 'baseline', pass: true, detail: `Brief compares with reference handicap ${handicap}.` }
  }
  if (named.length === 0) {
    return { id: 'baseline', pass: false, detail: `Brief does not compare with reference handicap ${handicap}.` }
  }
  return {
    id: 'baseline',
    pass: false,
    detail: `Brief compares with ${named.map(displayHandicap).join(', ')}, not reference handicap ${handicap}.`,
  }
}

function figureChecks(brief: string, expected: SgFigures): EvalCheck[] {
  const checks: EvalCheck[] = []
  const total = brief.match(/^Strokes gained: (\S+) \(raw (\S+)\)$/m)
  if (!total) {
    checks.push({ id: 'total', pass: false, detail: 'Brief has no strokes gained total.' })
  } else {
    const adjusted = parseSgToken(total[1])
    const raw = parseSgToken(total[2])
    const adjustedOk = adjusted != null && roundSg(adjusted) === roundSg(expected.adjustedTotal)
    const rawOk = raw != null && roundSg(raw) === roundSg(expected.rawTotal)
    checks.push({
      id: 'total',
      pass: adjustedOk && rawOk,
      detail: adjustedOk && rawOk
        ? `Strokes gained total is ${formatSgFigure(expected.adjustedTotal)} (raw ${formatSgFigure(expected.rawTotal)}).`
        : `Brief total is ${total[1]} (raw ${total[2]}). Reference handicap total is ${formatSgFigure(expected.adjustedTotal)} (raw ${formatSgFigure(expected.rawTotal)}).`,
    })
  }

  const mismatches: string[] = []
  for (const label of CATEGORY_LABELS) {
    const line = brief.match(new RegExp(`^${label}: (\\S+) \\(raw (\\S+); penalties `, 'm'))
    const category = expected.categories.find((item) => item.label === label)
    if (!line || !category) {
      mismatches.push(`${label} is missing`)
      continue
    }
    const adjusted = parseSgToken(line[1])
    const raw = parseSgToken(line[2])
    if (adjusted == null || roundSg(adjusted) !== roundSg(category.adjusted)) {
      mismatches.push(
        `${label} is ${line[1]}, reference handicap figure is ${formatSgFigure(category.adjusted)}`
      )
    }
    if (raw == null || roundSg(raw) !== roundSg(category.raw)) {
      mismatches.push(`${label} raw is ${line[2]}, chart figure is ${formatSgFigure(category.raw)}`)
    }
  }
  checks.push({
    id: 'categories',
    pass: mismatches.length === 0,
    detail: mismatches.length === 0
      ? 'Off the tee, approach, around the green, and putting match the reference handicap.'
      : mismatches.join('. ') + '.',
  })
  return checks
}

function namedBaselineCheck(reply: string, evalCase: SgEvalCase): EvalCheck {
  const named = citedHandicaps(reply)
  const handicap = formatReferenceHandicap(evalCase.referenceHandicap)
  if (evalCase.sgMode === 'raw') {
    if (named.length === 0) {
      return { id: 'baseline-handicap', pass: true, detail: 'Reply does not compare the raw figures with a handicap.' }
    }
    return {
      id: 'baseline-handicap',
      pass: false,
      detail: `Reply compares raw strokes gained with ${named.map(displayHandicap).join(', ')}. The reference handicap is not used in raw mode.`,
    }
  }
  const wrong = named.filter((value) => !sameHandicap(value, evalCase.referenceHandicap))
  if (wrong.length === 0) {
    return {
      id: 'baseline-handicap',
      pass: true,
      detail: named.length === 0
        ? 'Reply does not name a different reference handicap.'
        : `Reply names reference handicap ${handicap}.`,
    }
  }
  return {
    id: 'baseline-handicap',
    pass: false,
    detail: `Reply compares with ${wrong.map(displayHandicap).join(', ')}. The reference handicap is ${handicap}.`,
  }
}

function scratchCheck(reply: string, evalCase: SgEvalCase): EvalCheck {
  const scratch = mentionsScratchBaseline(reply)
  const scratchIsReference = evalCase.sgMode === 'handicap' && sameHandicap(evalCase.referenceHandicap, 0)
  if (!scratch || scratchIsReference) {
    return {
      id: 'scratch',
      pass: true,
      detail: scratchIsReference
        ? 'Scratch is the reference handicap.'
        : 'Reply does not use scratch as the baseline.',
    }
  }
  return {
    id: 'scratch',
    pass: false,
    detail: `Reply uses scratch as the baseline. The reference handicap is ${formatReferenceHandicap(evalCase.referenceHandicap)}.`,
  }
}

/** One-decimal strokes gained that belong to another baseline and not to this one. */
export function foreignMarks(prepared: PreparedSgEval): number[] {
  const expectedAdjusted = new Set(adjustedMarks(prepared.expected))
  const expectedRaw = new Set(rawMarks(prepared.expected))
  const marks: number[] = []
  for (const distractor of prepared.distractors) {
    for (const mark of adjustedMarks(distractor.figures)) {
      if (expectedAdjusted.has(mark)) continue
      if (prepared.evalCase.sgMode === 'handicap' && expectedRaw.has(mark)) continue
      if (!marks.includes(mark)) marks.push(mark)
    }
  }
  return marks
}

function citedFigureCheck(reply: string, prepared: PreparedSgEval): EvalCheck {
  const cited = citedSgNumbers(reply)
  const expectedAdjusted = new Set(adjustedMarks(prepared.expected))
  const expectedRaw = new Set(rawMarks(prepared.expected))
  const mode = prepared.evalCase.sgMode
  const banned = new Set(foreignMarks(prepared))

  const foreign = cited.filter((value) => banned.has(value))
  if (foreign.length > 0) {
    return {
      id: 'figures',
      pass: false,
      detail: `Reply quotes ${foreign.map(formatSgFigure).join(', ')}, which belongs to a different baseline. Reference handicap strokes gained is ${formatSgFigure(prepared.expected.adjustedTotal)}.`,
    }
  }

  if (mode === 'handicap') {
    const rawOnly = cited.filter((value) => expectedRaw.has(value) && !expectedAdjusted.has(value))
    const usedAdjusted = cited.some((value) => expectedAdjusted.has(value))
    if (rawOnly.length > 0 && !usedAdjusted) {
      return {
        id: 'figures',
        pass: false,
        detail: `Reply quotes the raw figure ${rawOnly.map(formatSgFigure).join(', ')} and not the handicap-adjusted strokes gained ${formatSgFigure(prepared.expected.adjustedTotal)}.`,
      }
    }
  }

  return {
    id: 'figures',
    pass: true,
    detail: cited.length === 0
      ? 'Reply does not quote a strokes gained figure from another baseline.'
      : 'Quoted strokes gained figures match this reference handicap.',
  }
}

function citedHandicaps(reply: string): number[] {
  const patterns = [
    /(?:compared with|versus|against|for|from|than)\s+an?\s+(\+|plus\s+|minus\s+|-|−)?(\d+(?:\.\d+)?)\s+handicap/gi,
    /(\+|plus\s+|minus\s+|-|−)?(\d+(?:\.\d+)?)\s*-\s*handicap/gi,
    /handicap\s+(?:of|is|at)\s+(?:an?\s+)?(\+|plus\s+|minus\s+|-|−)?(\d+(?:\.\d+)?)/gi,
    /\ban?\s+(\+|plus\s+|minus\s+|-|−)?(\d+(?:\.\d+)?)\s+handicap/gi,
  ]
  const values: number[] = []
  for (const pattern of patterns) {
    for (const match of reply.matchAll(pattern)) {
      const value = handicapFromParts(match[1], match[2])
      if (value == null || value < -10 || value > 54) continue
      if (!values.some((existing) => sameHandicap(existing, value))) values.push(value)
    }
  }
  return values
}

function handicapsIn(text: string, pattern: RegExp): number[] {
  const values: number[] = []
  for (const match of text.matchAll(pattern)) {
    const value = handicapFromParts(match[1], match[2])
    if (value == null) continue
    if (!values.some((existing) => sameHandicap(existing, value))) values.push(value)
  }
  return values
}

function handicapFromParts(sign: string | undefined, digits: string): number | null {
  const magnitude = Number(digits)
  if (!Number.isFinite(magnitude)) return null
  const marker = sign?.trim().toLowerCase() ?? ''
  if (marker === '+' || marker.startsWith('plus')) return -Math.abs(magnitude)
  if (marker === '-' || marker === MINUS || marker.startsWith('minus')) return -Math.abs(magnitude)
  return magnitude
}

function mentionsScratchBaseline(reply: string): boolean {
  const patterns = [
    /(?:compared with|versus|against|like|for)\s+(?:an?\s+)?scratch\b/gi,
    /\bscratch\s+handicap\b/gi,
  ]
  for (const pattern of patterns) {
    for (const match of reply.matchAll(pattern)) {
      const before = reply.slice(Math.max(0, (match.index ?? 0) - 12), match.index ?? 0)
      if (/\bnot\s+$/i.test(before) || /n't\s+$/i.test(before)) continue
      return true
    }
  }
  return false
}

function citedSgNumbers(reply: string): number[] {
  const stripped = reply
    .replace(/(?:compared with|versus|against|for|from|than)\s+an?\s+(?:\+|plus\s+|minus\s+|-|−)?\d+(?:\.\d+)?\s+handicap/gi, ' ')
    .replace(/(?:\+|plus\s+|minus\s+|-|−)?\d+(?:\.\d+)?\s*-\s*handicap/gi, ' ')
    .replace(/handicap\s+(?:of|is|at)\s+(?:an?\s+)?(?:\+|plus\s+|minus\s+|-|−)?\d+(?:\.\d+)?/gi, ' ')
    .replace(/\ban?\s+(?:\+|plus\s+|minus\s+|-|−)?\d+(?:\.\d+)?\s+handicap/gi, ' ')

  const values = new Set<number>()
  for (const match of stripped.matchAll(/[+\u2212-]\d+\.\d+/g)) {
    const value = parseSgToken(match[0])
    if (value != null) values.add(roundSg(value))
  }
  const lower = stripped.toLowerCase()
  let from = 0
  while (from < lower.length) {
    const at = lower.indexOf('strokes gained', from)
    if (at < 0) break
    const window = stripped.slice(Math.max(0, at - 8), Math.min(stripped.length, at + 'strokes gained'.length + 28))
    for (const match of window.matchAll(/[+\u2212-]?\d+\.\d+/g)) {
      const value = parseSgToken(match[0])
      if (value != null) values.add(roundSg(value))
    }
    from = at + 'strokes gained'.length
  }
  return [...values]
}

/** A brief or reply token such as `+1.2`, `-1.2`, or `−1.2`. */
export function parseSgToken(token: string): number | null {
  const cleaned = token.trim().replaceAll(MINUS, '-').replaceAll('+', '')
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

function sameHandicap(left: number, right: number): boolean {
  return roundSg(left) === roundSg(right)
}

function displayHandicap(value: number): string {
  return formatReferenceHandicap(value)
}

export function scoreSummary(score: EvalScore): string {
  const failed = score.checks.filter((check) => !check.pass)
  if (failed.length === 0) return score.summary
  return failed.map((check) => check.detail).join(' ')
}

/** The mode the distractor is calculated in. Raw cases compare against handicap-adjusted figures. */
export function distractorMode(evalCase: SgEvalCase, mode: SgMode | undefined): SgMode {
  return mode ?? evalCase.sgMode
}
