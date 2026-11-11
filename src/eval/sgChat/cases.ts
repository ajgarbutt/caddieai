import type { SgMode } from '../../golf/strokesGained.ts'

/**
 * One Strokes Gained Expert question.
 * The reference handicap is the baseline the stats are compared with.
 * The player handicap is the golfer's own index, which must not be used instead.
 */
export type SgEvalCase = {
  id: string
  note: string
  /** A question about what the numbers mean. It has to resolve to a round or the average by itself. */
  question: string
  referenceHandicap: number
  playerHandicap: number
  sgMode: SgMode
  /** Extra baselines the brief and the reply must not match. */
  distractors: SgEvalDistractor[]
}

export type SgEvalDistractor = {
  label: string
  referenceHandicap: number
  sgMode?: SgMode
  /** `career` forces the average. `same` uses the scope the question resolved to. */
  scope?: 'same' | 'career'
}

export const SG_EVAL_CASES: SgEvalCase[] = [
  {
    id: 'ref-28-not-18',
    note: 'Reference handicap 28. The default and the player handicap are both 18.',
    question: 'What do my average strokes gained stats mean for my game, and how can I improve?',
    referenceHandicap: 28,
    playerHandicap: 18,
    sgMode: 'handicap',
    distractors: [],
  },
  {
    id: 'ref-10-not-player-24',
    note: 'Reference handicap 10. The golfer\'s own handicap is 24.',
    question: 'Looking at my average stats, what does my putting mean, and how do I improve it?',
    referenceHandicap: 10,
    playerHandicap: 24,
    sgMode: 'handicap',
    distractors: [],
  },
  {
    id: 'plus-2',
    note: 'Reference handicap +2, stored as -2. A reply that says "a 2 handicap" is the wrong baseline.',
    question: 'Across my rounds, what do these strokes gained numbers mean on the course, and what should I work on?',
    referenceHandicap: -2,
    playerHandicap: 12,
    sgMode: 'handicap',
    distractors: [],
  },
  {
    id: 'fractional-14-5',
    note: 'Reference handicap 14.5. Rounding it to 14 or 15 is the wrong baseline.',
    question: 'In general, what are my strokes gained stats showing, and how do I score better?',
    referenceHandicap: 14.5,
    playerHandicap: 18,
    sgMode: 'handicap',
    distractors: [
      { label: '14 handicap', referenceHandicap: 14 },
      { label: '15 handicap', referenceHandicap: 15 },
    ],
  },
  {
    id: 'scratch',
    note: 'Reference handicap 0, which is scratch. An 18-handicap comparison is wrong.',
    question: 'What do my average strokes gained numbers mean, and how do I improve from here?',
    referenceHandicap: 0,
    playerHandicap: 18,
    sgMode: 'handicap',
    distractors: [],
  },
  {
    id: 'raw-ignores-reference',
    note: 'Raw mode. The stored reference handicap is 28 and must not be applied.',
    question: 'What do my average strokes gained numbers mean for my game, and how can I improve?',
    referenceHandicap: 28,
    playerHandicap: 18,
    sgMode: 'raw',
    distractors: [],
  },
  {
    id: 'last-round-not-career',
    note: 'One round at reference handicap 18. The career average, and that round at the player handicap 28, are both wrong.',
    question: 'What did my last round\'s strokes gained mean, and how do I improve next time?',
    referenceHandicap: 18,
    playerHandicap: 28,
    sgMode: 'handicap',
    distractors: [
      { label: 'career average at 18', referenceHandicap: 18, scope: 'career' },
    ],
  },
]
