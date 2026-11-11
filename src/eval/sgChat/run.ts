import { pathToFileURL } from 'node:url'
import { MAX_OUTPUT_TOKENS, OPENAI_ADVICE_TEMPERATURE } from '../../../api/_lib/config.js'
import { getOpenAIClient, getOpenAIModel } from '../../../api/_lib/openai.js'
import { buildCaddieConversationInput, parseCaddieResponseJson } from '../../utils/buildGolfPrompt.js'
import { buildSgExpertSystemPrompt } from '../../utils/sgExpertPrompt.js'
import { SG_EVAL_CASES } from './cases.ts'
import { prepareSgEvalCase } from './prepare.ts'
import {
  scoreReferenceHandicapAnalysis,
  scoreReferenceHandicapFeedback,
  scoreSummary,
  type EvalScore,
  type PreparedSgEval,
} from './referenceHandicap.ts'
import {
  STRUCTURE_LABELS,
  parseStructureJudgement,
  structureJudgePrompt,
  structurePassed,
  type StructureJudgement,
} from './rubric.ts'

type CaseResult = {
  id: string
  analysis: EvalScore
  feedback: EvalScore | null
  structure: { pass: boolean; judgement: StructureJudgement } | { pass: false; error: string } | null
}

const invokedDirectly =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}

async function main() {
  const args = readArgs(process.argv.slice(2))
  if (args.help) {
    console.log(`Usage: npm run eval:sg -- [--objective] [--case <id>]

Scores the Strokes Gained Expert.
  reference handicap   The brief uses that handicap's strokes gained, and the reply does not use another baseline.
  structure            A judge scores what the stats show, what that means on the course, and how to improve.

--objective   Score the briefs only. No model calls.
--case <id>   Run one case.

Cases: ${SG_EVAL_CASES.map((item) => item.id).join(', ')}`)
    return
  }

  const selected = args.caseId == null
    ? SG_EVAL_CASES
    : SG_EVAL_CASES.filter((item) => item.id === args.caseId)
  if (selected.length === 0) {
    console.error(`No eval case named ${args.caseId}.`)
    process.exitCode = 1
    return
  }

  const prepared = selected.map((item) => prepareSgEvalCase(item))
  if (args.objective) {
    const results = prepared.map((item) => ({
      id: item.evalCase.id,
      analysis: scoreReferenceHandicapAnalysis(item),
      feedback: null,
      structure: null,
    }))
    printReport(results, true)
    if (results.some((result) => !result.analysis.pass)) process.exitCode = 1
    return
  }

  let openai
  try {
    openai = getOpenAIClient()
  } catch {
    console.error('Set OPENAI_API_KEY in .env.local, or run with --objective to score the briefs only.')
    process.exitCode = 1
    return
  }

  const model = getOpenAIModel()
  const results: CaseResult[] = []
  for (const item of prepared) {
    const analysis = scoreReferenceHandicapAnalysis(item)
    try {
      const reply = await expertReply(openai, model, item)
      const feedback = scoreReferenceHandicapFeedback(item, reply)
      let structure: CaseResult['structure']
      try {
        const judgement = await judgeReply(openai, model, item, reply)
        structure = { pass: structurePassed(judgement), judgement }
      } catch (error) {
        structure = { pass: false, error: error instanceof Error ? error.message : 'The judge failed.' }
      }
      results.push({ id: item.evalCase.id, analysis, feedback, structure })
    } catch (error) {
      results.push({
        id: item.evalCase.id,
        analysis,
        feedback: {
          pass: false,
          summary: 'The expert did not reply.',
          checks: [{
            id: 'reply',
            pass: false,
            detail: error instanceof Error ? error.message : 'The expert did not reply.',
          }],
        },
        structure: null,
      })
    }
  }

  printReport(results, false)
  const failed = results.some((result) => {
    if (!result.analysis.pass) return true
    if (result.feedback && !result.feedback.pass) return true
    return result.structure != null && !result.structure.pass
  })
  if (failed) process.exitCode = 1
}

function readArgs(argv: string[]) {
  const caseFlag = argv.indexOf('--case')
  return {
    help: argv.includes('--help') || argv.includes('-h'),
    objective: argv.includes('--objective'),
    caseId: caseFlag >= 0 ? argv[caseFlag + 1] ?? null : null,
  }
}

async function expertReply(openai: ReturnType<typeof getOpenAIClient>, model: string, prepared: PreparedSgEval) {
  const messages = [{
    role: 'user' as const,
    text: prepared.evalCase.question,
    createdAt: new Date().toISOString(),
  }]
  const response = await openai.responses.create({
    model,
    temperature: OPENAI_ADVICE_TEMPERATURE,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    input: [
      {
        role: 'system',
        content: buildSgExpertSystemPrompt({
          profile: {
            name: 'Sam',
            handicap: prepared.evalCase.playerHandicap,
            units: 'yards',
            sassMode: false,
          },
          brief: prepared.brief,
        }),
      },
      ...buildCaddieConversationInput(messages),
    ],
    text: { format: { type: 'json_object' } },
  })
  return parseCaddieResponseJson(response.output_text || '{}', null, messages).reply
}

async function judgeReply(
  openai: ReturnType<typeof getOpenAIClient>,
  model: string,
  prepared: PreparedSgEval,
  reply: string
) {
  const prompt = structureJudgePrompt({
    question: prepared.evalCase.question,
    brief: prepared.brief,
    reply,
  })
  const response = await openai.responses.create({
    model: process.env.SG_EVAL_JUDGE_MODEL?.trim() || model,
    temperature: 0,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    input: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    text: { format: { type: 'json_object' } },
  })
  return parseStructureJudgement(response.output_text || '{}')
}

function printReport(results: CaseResult[], objectiveOnly: boolean) {
  console.log('Strokes Gained chat eval')
  console.log('')
  for (const result of results) {
    const evalCase = SG_EVAL_CASES.find((item) => item.id === result.id)
    console.log(result.id)
    if (evalCase) console.log(`  ${evalCase.note}`)
    console.log(`  reference handicap (analysis)  ${result.analysis.pass ? 'pass' : 'fail'}  ${scoreSummary(result.analysis)}`)
    if (!result.analysis.pass) printFailed(result.analysis)
    if (result.feedback) {
      console.log(`  reference handicap (reply)     ${result.feedback.pass ? 'pass' : 'fail'}  ${scoreSummary(result.feedback)}`)
      if (!result.feedback.pass) printFailed(result.feedback)
    }
    if (result.structure && 'judgement' in result.structure) {
      const scores = (['stats', 'experience', 'improvement'] as const)
        .map((criterion) => `${STRUCTURE_LABELS[criterion]} ${result.structure && 'judgement' in result.structure ? result.structure.judgement[criterion].score : ''}`)
        .join(', ')
      console.log(`  structure                      ${result.structure.pass ? 'pass' : 'fail'}  ${scores}`)
      for (const criterion of ['stats', 'experience', 'improvement'] as const) {
        const item = result.structure.judgement[criterion]
        if (item.evidence) console.log(`    ${STRUCTURE_LABELS[criterion]}: ${item.evidence}`)
      }
    } else if (result.structure) {
      console.log(`  structure                      fail  ${result.structure.error}`)
    }
    console.log('')
  }

  const analysisPassed = results.filter((result) => result.analysis.pass).length
  console.log(`Reference handicap, analysis: ${analysisPassed}/${results.length} passed`)
  if (objectiveOnly) {
    console.log('Structure: skipped. Run without --objective to call the expert and the judge.')
    return
  }
  const feedback = results.filter((result) => result.feedback)
  const feedbackPassed = feedback.filter((result) => result.feedback?.pass).length
  console.log(`Reference handicap, reply: ${feedbackPassed}/${feedback.length} passed`)
  const structure = results.filter((result) => result.structure)
  const structurePassedCount = structure.filter((result) => result.structure?.pass).length
  console.log(`Structure: ${structurePassedCount}/${structure.length} passed`)
}

function printFailed(score: EvalScore) {
  for (const check of score.checks) {
    if (!check.pass) console.log(`    ${check.detail}`)
  }
}
