/**
 * Dev-only sample: one rated course and eight 18-hole rounds for a golfer
 * shooting 100–110. Nothing here is stored as strokes gained.
 */
import type { AnalysisRoundInput } from './dashboard.ts'

export type SeedLie = 'TEE' | 'FAIRWAY' | 'ROUGH' | 'SAND' | 'RECOVERY' | 'PUTTS' | 'PENALTY'

export type SeedShot = {
  id: string
  roundId: string
  holeNumber: number
  seq: number
  type: SeedLie
  distance: number | null
  penaltyStrokes: number
  penaltyKind: 'replay' | 'drop' | null
}

type Step = {
  type: SeedLie
  distance?: number | null
  penaltyStrokes?: number
  penaltyKind?: 'replay' | 'drop' | null
}

export type SeedHole = {
  holeNumber: number
  par: 3 | 4 | 5
  yards: number
}

export const SEED_COURSE = {
  id: 'seed-meadow',
  name: 'Meadow Park',
  teeName: 'White',
  courseRating: 71.8,
  slopeRating: 128,
}

export const SEED_HOLES: SeedHole[] = [
  { holeNumber: 1, par: 4, yards: 390 },
  { holeNumber: 2, par: 5, yards: 520 },
  { holeNumber: 3, par: 3, yards: 165 },
  { holeNumber: 4, par: 4, yards: 410 },
  { holeNumber: 5, par: 4, yards: 355 },
  { holeNumber: 6, par: 4, yards: 430 },
  { holeNumber: 7, par: 3, yards: 145 },
  { holeNumber: 8, par: 5, yards: 505 },
  { holeNumber: 9, par: 4, yards: 380 },
  { holeNumber: 10, par: 4, yards: 400 },
  { holeNumber: 11, par: 4, yards: 365 },
  { holeNumber: 12, par: 3, yards: 175 },
  { holeNumber: 13, par: 5, yards: 530 },
  { holeNumber: 14, par: 4, yards: 395 },
  { holeNumber: 15, par: 4, yards: 420 },
  { holeNumber: 16, par: 5, yards: 490 },
  { holeNumber: 17, par: 3, yards: 155 },
  { holeNumber: 18, par: 4, yards: 405 },
]

/** Compared with a 28 handicap when the dashboard is opened on this seed. */
export const SEED_REFERENCE_HANDICAP = 28

const DATES = [
  '2026-03-08',
  '2026-04-12',
  '2026-05-17',
  '2026-06-21',
  '2026-07-19',
  '2026-08-16',
  '2026-09-13',
  '2026-10-04',
]

/**
 * P par, 3 three-putt bogey, B bogey, D double with a duffed chip,
 * W water drop (+1), R recovery punch-out, OB local-rule drop (+2), T triple.
 */
const PLANS = [
  'P R P OB W D 3 D D 3 D B T D T B D OB',
  'OB T B D W 3 P R D T D D T OB D B 3 T',
  'P B P W 3 D P R OB D D B D T D T 3 D',
  'T R D OB D W 3 T OB D D B T D D D P T',
  'D R 3 OB P W B T D 3 D P T OB D D D T',
  'P B P D 3 W B R D OB D 3 D D T T D D',
  'OB T D D W 3 B R T D OB D T P D T 3 D',
  '3 R P W D OB P D D D 3 B T D OB D D T',
]

function stepsFor(par: number, yards: number, code: string): Step[] {
  if (code === 'P' && par === 4) return [{ type: 'TEE', distance: yards }, { type: 'FAIRWAY', distance: 135 }, { type: 'PUTTS', distance: 18 }, { type: 'PUTTS', distance: 2 }]
  if (code === 'P' && par === 3) return [{ type: 'TEE', distance: yards }, { type: 'PUTTS', distance: 20 }, { type: 'PUTTS', distance: 2 }]
  if (code === 'P' && par === 5) return [{ type: 'TEE', distance: yards }, { type: 'FAIRWAY', distance: 230 }, { type: 'FAIRWAY', distance: 70 }, { type: 'PUTTS', distance: 15 }, { type: 'PUTTS', distance: 2 }]
  if (code === '3' && par === 4) return [{ type: 'TEE', distance: yards }, { type: 'FAIRWAY', distance: 140 }, { type: 'PUTTS', distance: 42 }, { type: 'PUTTS', distance: 8 }, { type: 'PUTTS', distance: 2 }]
  if (code === '3' && par === 3) return [{ type: 'TEE', distance: yards }, { type: 'PUTTS', distance: 36 }, { type: 'PUTTS', distance: 7 }, { type: 'PUTTS', distance: 2 }]
  if (code === '3' && par === 5) return [{ type: 'TEE', distance: yards }, { type: 'FAIRWAY', distance: 220 }, { type: 'FAIRWAY', distance: 40 }, { type: 'PUTTS', distance: 38 }, { type: 'PUTTS', distance: 9 }, { type: 'PUTTS', distance: 2 }]
  if (code === 'B' && par === 4) return [{ type: 'TEE', distance: yards }, { type: 'ROUGH', distance: 150 }, { type: 'FAIRWAY', distance: 22 }, { type: 'PUTTS', distance: 8 }, { type: 'PUTTS', distance: 2 }]
  if (code === 'B' && par === 3) return [{ type: 'TEE', distance: yards }, { type: 'ROUGH', distance: 30 }, { type: 'PUTTS', distance: 8 }, { type: 'PUTTS', distance: 2 }]
  if (code === 'B' && par === 5) return [{ type: 'TEE', distance: yards }, { type: 'FAIRWAY', distance: 240 }, { type: 'ROUGH', distance: 80 }, { type: 'FAIRWAY', distance: 20 }, { type: 'PUTTS', distance: 10 }, { type: 'PUTTS', distance: 2 }]
  if (code === 'D' && par === 4) return [{ type: 'TEE', distance: yards }, { type: 'ROUGH', distance: 165 }, { type: 'ROUGH', distance: 32 }, { type: 'FAIRWAY', distance: 14 }, { type: 'PUTTS', distance: 6 }, { type: 'PUTTS', distance: 2 }]
  if (code === 'D' && par === 3) return [{ type: 'TEE', distance: yards }, { type: 'SAND', distance: 22 }, { type: 'SAND', distance: 14 }, { type: 'PUTTS', distance: 5 }, { type: 'PUTTS', distance: 2 }]
  if (code === 'D' && par === 5) return [{ type: 'TEE', distance: yards }, { type: 'FAIRWAY', distance: 250 }, { type: 'ROUGH', distance: 90 }, { type: 'ROUGH', distance: 28 }, { type: 'FAIRWAY', distance: 12 }, { type: 'PUTTS', distance: 4 }, { type: 'PUTTS', distance: 2 }]
  if (code === 'W' && par === 4) {
    return [
      { type: 'TEE', distance: yards },
      { type: 'FAIRWAY', distance: 140 },
      { type: 'PENALTY', penaltyStrokes: 1, penaltyKind: 'drop' },
      { type: 'SAND', distance: 28 },
      { type: 'PUTTS', distance: 12 },
      { type: 'PUTTS', distance: 2 },
    ]
  }
  if (code === 'R' && par === 5) {
    return [
      { type: 'TEE', distance: yards },
      { type: 'RECOVERY', distance: yards - 40 },
      { type: 'FAIRWAY', distance: 210 },
      { type: 'ROUGH', distance: 35 },
      { type: 'FAIRWAY', distance: 16 },
      { type: 'PUTTS', distance: 8 },
      { type: 'PUTTS', distance: 2 },
    ]
  }
  if (code === 'OB' && par === 4) {
    return [
      { type: 'TEE', distance: yards },
      { type: 'PENALTY', penaltyStrokes: 2, penaltyKind: 'drop' },
      { type: 'ROUGH', distance: 200 },
      { type: 'FAIRWAY', distance: 40 },
      { type: 'PUTTS', distance: 15 },
      { type: 'PUTTS', distance: 2 },
    ]
  }
  if (code === 'T' && par === 4) return [{ type: 'TEE', distance: yards }, { type: 'ROUGH', distance: 190 }, { type: 'ROUGH', distance: 70 }, { type: 'ROUGH', distance: 25 }, { type: 'FAIRWAY', distance: 10 }, { type: 'PUTTS', distance: 5 }, { type: 'PUTTS', distance: 2 }]
  if (code === 'T' && par === 3) return [{ type: 'TEE', distance: yards }, { type: 'ROUGH', distance: 40 }, { type: 'SAND', distance: 20 }, { type: 'SAND', distance: 12 }, { type: 'PUTTS', distance: 4 }, { type: 'PUTTS', distance: 2 }]
  if (code === 'T' && par === 5) return [{ type: 'TEE', distance: yards }, { type: 'ROUGH', distance: 300 }, { type: 'FAIRWAY', distance: 160 }, { type: 'ROUGH', distance: 50 }, { type: 'ROUGH', distance: 22 }, { type: 'FAIRWAY', distance: 10 }, { type: 'PUTTS', distance: 6 }, { type: 'PUTTS', distance: 2 }]
  throw new Error(`No ${code} pattern for a par ${par}.`)
}

function toShots(roundId: string, holeNumber: number, steps: Step[]): SeedShot[] {
  return steps.map((step, index) => ({
    id: `${roundId}-h${holeNumber}-s${index + 1}`,
    roundId,
    holeNumber,
    seq: index + 1,
    type: step.type,
    distance: step.type === 'PENALTY' ? null : (step.distance ?? null),
    penaltyStrokes: step.type === 'PENALTY' ? (step.penaltyStrokes ?? 0) : 0,
    penaltyKind: step.type === 'PENALTY' ? (step.penaltyKind ?? null) : null,
  }))
}

export type SeedRound = {
  id: string
  playedAt: string
  createdAt: string
  courseId: string
  nineHoles: boolean
  status: 'complete'
  includeInAnalysis: boolean
  handicapScoreOverride: null
  courseRating: number
  slopeRating: number
  holes: Array<SeedHole & { holedOut: boolean }>
}

export type SeedData = {
  course: typeof SEED_COURSE
  rounds: SeedRound[]
  shots: SeedShot[]
}

export function buildSeed(): SeedData {
  if (PLANS.length !== 8) throw new Error('The seed needs 8 rounds.')
  const rounds: SeedRound[] = []
  const shots: SeedShot[] = []
  PLANS.forEach((plan, index) => {
    const codes = plan.split(' ')
    if (codes.length !== SEED_HOLES.length) throw new Error(`Round ${index + 1} has ${codes.length} holes.`)
    const id = `seed-round-${index + 1}`
    const playedAt = DATES[index]
    rounds.push({
      id,
      playedAt,
      createdAt: `${playedAt}T12:00:00.000Z`,
      courseId: SEED_COURSE.id,
      nineHoles: false,
      status: 'complete',
      includeInAnalysis: true,
      handicapScoreOverride: null,
      courseRating: SEED_COURSE.courseRating,
      slopeRating: SEED_COURSE.slopeRating,
      holes: SEED_HOLES.map((hole) => ({ ...hole, holedOut: true })),
    })
    SEED_HOLES.forEach((hole, holeIndex) => {
      shots.push(...toShots(id, hole.holeNumber, stepsFor(hole.par, hole.yards, codes[holeIndex])))
    })
  })
  return { course: SEED_COURSE, rounds, shots }
}

export function seedDashboardInputs(seed: SeedData = buildSeed()): AnalysisRoundInput[] {
  return seed.rounds.map((round) => ({
    id: round.id,
    playedAt: round.playedAt,
    createdAt: round.createdAt,
    courseId: round.courseId,
    status: round.status,
    includeInAnalysis: round.includeInAnalysis,
    nineHoles: round.nineHoles,
    courseRating: round.courseRating,
    slopeRating: round.slopeRating,
    handicapScoreOverride: round.handicapScoreOverride,
    holes: round.holes,
    shots: seed.shots.filter((shot) => shot.roundId === round.id),
  }))
}
