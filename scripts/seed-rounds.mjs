/**
 * Dev-only. Prints the sample course and rounds. Does not write to the database.
 * Open the dashboard on this data at /stats?seed=1 while `npm run dev` is running.
 */
import { buildDashboard } from '../src/golf/dashboard.ts'
import { formatSg } from '../src/golf/roundFormat.js'
import { buildRoundStats } from '../src/golf/roundStats.ts'
import { holeScore } from '../src/golf/shotMath.js'
import { buildSeed, SEED_REFERENCE_HANDICAP, seedDashboardInputs } from '../src/golf/seedRounds.ts'
import {
  expectedHandicapDifferential,
  expectedStrokes,
  handicapDifferential,
  holeStrokesGained,
} from '../src/golf/strokesGained.ts'

const seed = buildSeed()
const errors = []

console.log(`${seed.course.name} · ${seed.course.teeName}`)
console.log(`Rating ${seed.course.courseRating} · slope ${seed.course.slopeRating}`)

for (const round of seed.rounds) {
  const shots = seed.shots.filter((shot) => shot.roundId === round.id)
  let score = 0
  for (const hole of round.holes) {
    const onHole = shots
      .filter((shot) => shot.holeNumber === hole.holeNumber)
      .sort((a, b) => a.seq - b.seq)
    const holeTotal = holeScore(onHole)
    score += holeTotal
    const gained = holeStrokesGained(onHole, hole.par, hole.holedOut)
    const raw = gained.reduce((sum, shot) => sum + (shot.rawSG ?? 0), 0)
    const tee = onHole[0]
    const identity = expectedStrokes('TEE', tee.distance) - holeTotal
    if (Math.abs(raw - identity) > 1e-6) {
      errors.push(`${round.playedAt} hole ${hole.holeNumber}: raw ${raw} vs E(tee) − score ${identity}`)
    }
  }
  const stats = buildRoundStats({
    holes: round.holes,
    shots,
    courseRating: round.courseRating,
    slopeRating: round.slopeRating,
    referenceHandicap: SEED_REFERENCE_HANDICAP,
    sgMode: 'handicap',
  })
  const expected = expectedHandicapDifferential(SEED_REFERENCE_HANDICAP, false)
  const differential = handicapDifferential(score, round.courseRating, round.slopeRating)
  if (stats.score !== score) errors.push(`${round.playedAt}: score ${stats.score} vs shots ${score}`)
  if (score < 100 || score > 110) errors.push(`${round.playedAt}: score ${score} is outside 100–110`)
  if (Math.abs(stats.sgTotal - (expected - differential)) > 1e-6) {
    errors.push(`${round.playedAt}: adjusted ${stats.sgTotal} vs expected − differential ${expected - differential}`)
  }
  console.log(`${round.playedAt}  ${score}  differential ${stats.differential.toFixed(1)}  SG ${formatSg(stats.sgTotal)}`)
}

const view = buildDashboard(seedDashboardInputs(seed), {
  window: 'career',
  lastN: 5,
  seasonYear: 2026,
  courseId: seed.course.id,
  referenceHandicap: SEED_REFERENCE_HANDICAP,
  sgMode: 'handicap',
})

console.log('')
console.log(
  `Headline: ${view.headline?.label} ${formatSg(view.headline?.perRound)} per round vs a ${SEED_REFERENCE_HANDICAP} handicap`
)
for (const bar of view.bars) {
  console.log(`  ${bar.label}  ${formatSg(bar.perRound)}  penalties ${formatSg(bar.penaltyPerRound)}`)
}
console.log(view.practice)

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}
