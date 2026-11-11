import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SG_EVAL_CASES, type SgEvalCase } from './cases.ts'
import { formatSgFigure, roundSg } from './figures.ts'
import { prepareSgEvalCase } from './prepare.ts'
import {
  foreignMarks,
  scoreReferenceHandicapAnalysis,
  scoreReferenceHandicapFeedback,
  type PreparedSgEval,
} from './referenceHandicap.ts'
import { parseStructureJudgement, structureJudgePrompt, structurePassed } from './rubric.ts'

function caseById(id: string): SgEvalCase {
  const found = SG_EVAL_CASES.find((item) => item.id === id)
  if (!found) throw new Error(`Missing eval case ${id}`)
  return found
}

function failedChecks(prepared: PreparedSgEval, reply?: string): string {
  const score = reply == null
    ? scoreReferenceHandicapAnalysis(prepared)
    : scoreReferenceHandicapFeedback(prepared, reply)
  return score.checks
    .filter((check) => !check.pass)
    .map((check) => `${check.id}: ${check.detail}`)
    .join('\n')
}

function foreignMark(prepared: PreparedSgEval): number {
  const mark = foreignMarks(prepared).find((value) => value !== 0)
  if (mark == null) {
    throw new Error(`${prepared.evalCase.id} has no strokes gained figure that belongs only to another baseline.`)
  }
  return mark
}

describe('strokes gained reference handicap', () => {
  for (const evalCase of SG_EVAL_CASES) {
    it(`${evalCase.id} analyses with the reference handicap`, () => {
      const prepared = prepareSgEvalCase(evalCase)
      const result = scoreReferenceHandicapAnalysis(prepared)
      assert.equal(result.pass, true, failedChecks(prepared))
    })
  }

  it('keeps a single round off the career average', () => {
    const prepared = prepareSgEvalCase(caseById('last-round-not-career'))
    assert.equal(prepared.scope.kind, 'round')
    if (prepared.scope.kind === 'round') assert.equal(prepared.scope.roundId, 'seed-round-8')
    assert.equal(prepared.expected.roundCount, 1)
  })

  it('fails a brief that names the default handicap', () => {
    const prepared = prepareSgEvalCase(caseById('ref-28-not-18'))
    const swapped = {
      ...prepared,
      brief: prepared.brief.replace('compared with a 28 handicap', 'compared with a 18 handicap'),
    }
    const result = scoreReferenceHandicapAnalysis(swapped)
    assert.equal(result.checks.find((check) => check.id === 'baseline')?.pass, false)
  })

  it('fails a brief whose total belongs to another handicap', () => {
    const prepared = prepareSgEvalCase(caseById('ref-28-not-18'))
    const other = prepared.distractors.find(
      (item) => roundSg(item.figures.adjustedTotal) !== roundSg(prepared.expected.adjustedTotal)
    )
    assert.ok(other)
    const swapped = {
      ...prepared,
      brief: prepared.brief.replace(
        /^Strokes gained: \S+ \(raw /m,
        `Strokes gained: ${formatSgFigure(other.figures.adjustedTotal)} (raw `
      ),
    }
    const result = scoreReferenceHandicapAnalysis(swapped)
    assert.equal(result.checks.find((check) => check.id === 'total')?.pass, false)
  })

  it('accepts a reply that uses the reference handicap and its strokes gained', () => {
    const prepared = prepareSgEvalCase(caseById('ref-28-not-18'))
    const reply = `Compared with a 28 handicap, strokes gained is ${formatSgFigure(prepared.expected.adjustedTotal)}. That is shots given away on the hole. Take more club from the rough.`
    const result = scoreReferenceHandicapFeedback(prepared, reply)
    assert.equal(result.pass, true, failedChecks(prepared, reply))
  })

  it('rejects a reply that names a different handicap', () => {
    const prepared = prepareSgEvalCase(caseById('ref-28-not-18'))
    const result = scoreReferenceHandicapFeedback(
      prepared,
      'You are being compared with an 18 handicap, so this is an 18-handicap view of the round.'
    )
    assert.equal(result.checks.find((check) => check.id === 'baseline-handicap')?.pass, false)
  })

  it('rejects a strokes gained figure that belongs to another handicap', () => {
    const prepared = prepareSgEvalCase(caseById('ref-10-not-player-24'))
    const reply = `Strokes gained is ${formatSgFigure(foreignMark(prepared))}.`
    const result = scoreReferenceHandicapFeedback(prepared, reply)
    assert.equal(result.checks.find((check) => check.id === 'figures')?.pass, false)
  })

  it('rejects a handicap-mode reply that quotes only the raw chart', () => {
    const prepared = prepareSgEvalCase(caseById('ref-28-not-18'))
    assert.notEqual(roundSg(prepared.expected.rawTotal), roundSg(prepared.expected.adjustedTotal))
    const reply = `Strokes gained is ${formatSgFigure(prepared.expected.rawTotal)}.`
    const result = scoreReferenceHandicapFeedback(prepared, reply)
    assert.equal(result.checks.find((check) => check.id === 'figures')?.pass, false)
  })

  it('treats a plus handicap as the stored reference, not the unsigned number', () => {
    const prepared = prepareSgEvalCase(caseById('plus-2'))
    const total = formatSgFigure(prepared.expected.adjustedTotal)
    const plus = scoreReferenceHandicapFeedback(
      prepared,
      `Compared with a +2 handicap, strokes gained is ${total}. The approaches are where the shots go. Land it on the front of the green.`
    )
    assert.equal(plus.pass, true, failedChecks(prepared, `Compared with a +2 handicap, strokes gained is ${total}.`))
    const unsigned = scoreReferenceHandicapFeedback(prepared, 'Compared with a 2 handicap, the numbers look fine.')
    assert.equal(unsigned.checks.find((check) => check.id === 'baseline-handicap')?.pass, false)
  })

  it('allows scratch only when the reference handicap is 0', () => {
    const scratch = prepareSgEvalCase(caseById('scratch'))
    const allowed = scoreReferenceHandicapFeedback(
      scratch,
      `Compared with scratch, strokes gained is ${formatSgFigure(scratch.expected.adjustedTotal)}.`
    )
    assert.equal(allowed.pass, true, failedChecks(scratch, 'Compared with scratch.'))
    const other = prepareSgEvalCase(caseById('ref-28-not-18'))
    const rejected = scoreReferenceHandicapFeedback(other, 'This is compared with scratch.')
    assert.equal(rejected.checks.find((check) => check.id === 'scratch')?.pass, false)
  })

  it('does not apply the reference handicap in raw mode', () => {
    const prepared = prepareSgEvalCase(caseById('raw-ignores-reference'))
    const rawReply = `These are raw against the PGA Tour chart. The reference handicap is not used. Strokes gained is ${formatSgFigure(prepared.expected.adjustedTotal)}.`
    const allowed = scoreReferenceHandicapFeedback(prepared, rawReply)
    assert.equal(allowed.pass, true, failedChecks(prepared, rawReply))
    const named = scoreReferenceHandicapFeedback(
      prepared,
      'These are compared with a 28 handicap.'
    )
    assert.equal(named.checks.find((check) => check.id === 'baseline-handicap')?.pass, false)
    const adjusted = scoreReferenceHandicapFeedback(
      prepared,
      `Strokes gained is ${formatSgFigure(foreignMark(prepared))}.`
    )
    assert.equal(adjusted.checks.find((check) => check.id === 'figures')?.pass, false)
  })
})

describe('strokes gained answer structure', () => {
  it('asks the judge for the three parts of a meaning answer', () => {
    const prompt = structureJudgePrompt({ question: 'What does this mean?', brief: 'Putting: -1.2', reply: 'You miss the short ones.' })
    assert.match(prompt.system, /What the stats show/)
    assert.match(prompt.system, /how the golfer plays/)
    assert.match(prompt.system, /How the golfer can improve/)
    assert.match(prompt.user, /What does this mean\?/)
    assert.match(prompt.user, /Putting: -1\.2/)
    assert.match(prompt.user, /You miss the short ones\./)
  })

  it('reads a judge score and passes only when every part is present', () => {
    const judgement = parseStructureJudgement(`{
      "stats": { "score": 2, "evidence": "Putting is -1.2" },
      "experience": { "score": "1", "evidence": "Shots given away" },
      "improvement": { "score": 2, "evidence": "Lag the long ones" }
    }`)
    assert.equal(structurePassed(judgement), true)
    const missing = parseStructureJudgement(`{
      "stats": { "score": 2, "evidence": "Putting is -1.2" },
      "experience": { "score": 0, "evidence": "No translation" },
      "improvement": { "score": 2, "evidence": "Lag the long ones" }
    }`)
    assert.equal(structurePassed(missing), false)
  })

  it('rejects a judge score outside 0, 1, or 2', () => {
    assert.throws(
      () => parseStructureJudgement('{ "stats": { "score": 3, "evidence": "" }, "experience": { "score": 1, "evidence": "" }, "improvement": { "score": 1, "evidence": "" } }'),
      /stats score must be 0, 1, or 2/
    )
  })
})
