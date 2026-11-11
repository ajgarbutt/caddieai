export type StructureCriterion = 'stats' | 'experience' | 'improvement'

export const STRUCTURE_LABELS: Record<StructureCriterion, string> = {
  stats: 'What the stats show',
  experience: 'What this means on the course',
  improvement: 'How to improve',
}

export type StructureScore = {
  score: 0 | 1 | 2
  evidence: string
}

export type StructureJudgement = Record<StructureCriterion, StructureScore>

/** A meaning answer passes when each part of the reply is present and not contradicted by the stats. */
export function structurePassed(judgement: StructureJudgement): boolean {
  return (
    judgement.stats.score >= 1 &&
    judgement.experience.score >= 1 &&
    judgement.improvement.score >= 1
  )
}

const CRITERIA: StructureCriterion[] = ['stats', 'experience', 'improvement']

/**
 * Judge prompt for a Strokes Gained answer about what the data means.
 * The three scores are the three parts of that answer. They are sentences, not headings.
 */
export function structureJudgePrompt(input: { question: string; brief: string; reply: string }): {
  system: string
  user: string
} {
  return {
    system: `You score one reply from the CaddieAI Strokes Gained Expert. The golfer asked what their stats mean. Judge the reply only against the player stats. Ignore tone, length, and layout. The reply is spoken prose, so the three parts are sentences, not headings.

Score each part 0, 1, or 2.

stats — What the stats show.
2: States the strokes-gained result the question asks about. The direction matches the player stats, and a figure or a ranking of the areas matches those stats.
1: Names the relevant area or direction and stays consistent with the player stats, but leaves the result vague.
0: Does not say what the stats show, or states a result the player stats contradict.

experience — What this means for how the golfer plays.
2: Turns that result into a concrete on-course experience the player stats support, such as where the shots are lost or what a hole tends to feel like.
1: Says they are gaining or losing shots, without a specific experience the stats point to.
0: Never connects the number to how the round plays.

improvement — How the golfer can improve this score.
2: Gives one concrete way to improve the score, aimed at the weakness the stats show.
1: Gives advice, but the advice is generic or only loosely tied to that weakness.
0: Gives no way to improve, or the advice is about a different part of the game than the question and the stats.

A part can score 2 only when it agrees with the player stats. Use 0 when it contradicts them.

Return JSON only, with integer scores:
{
  "stats": { "score": 0, "evidence": "short quote or paraphrase from the reply" },
  "experience": { "score": 0, "evidence": "" },
  "improvement": { "score": 0, "evidence": "" }
}`,
    user: `QUESTION
${input.question}

PLAYER STATS
${input.brief}

REPLY
${input.reply}`,
  }
}

export function parseStructureJudgement(text: string): StructureJudgement {
  const parsed = parseJsonObject(text)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Judge did not return an object.')
  }
  const record = parsed as Record<string, unknown>
  const judgement = {} as StructureJudgement
  for (const criterion of CRITERIA) {
    judgement[criterion] = parseCriterion(criterion, record[criterion])
  }
  return judgement
}

function parseCriterion(criterion: StructureCriterion, value: unknown): StructureScore {
  if (!value || typeof value !== 'object') {
    throw new Error(`Judge omitted the ${criterion} score.`)
  }
  const record = value as Record<string, unknown>
  const score = typeof record.score === 'string' ? Number(record.score) : record.score
  if (score !== 0 && score !== 1 && score !== 2) {
    throw new Error(`Judge ${criterion} score must be 0, 1, or 2.`)
  }
  const evidence = typeof record.evidence === 'string' ? record.evidence.trim() : ''
  return { score, evidence }
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1))
    throw new Error('Judge did not return JSON.')
  }
}
