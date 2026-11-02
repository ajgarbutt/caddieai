import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import baseline from './sg-baseline.json' with { type: 'json' }
import { buildDashboard, type BinMetric } from './dashboard.ts'
import { holeScore, formatShotLine, shotTravel } from './shotMath.js'
import { buildRoundStats } from './roundStats.ts'
import { buildSeed, seedDashboardInputs, SEED_REFERENCE_HANDICAP, type SeedShot } from './seedRounds.ts'
import {
  expectedHandicapDifferential,
  expectedStrokes,
  handicapDifferential,
  holeStrokesGained,
  type SgShot,
} from './strokesGained.ts'

const seed = buildSeed()
const near = (actual: number, expected: number) => Math.abs(actual - expected) < 1e-6

function shotsOn(roundId: string, holeNumber: number): SeedShot[] {
  return seed.shots
    .filter((shot) => shot.roundId === roundId && shot.holeNumber === holeNumber)
    .sort((a, b) => a.seq - b.seq)
}

describe('seed rounds', () => {
  it('builds one rated course and eight rounds between 100 and 110', () => {
    assert.equal(seed.course.courseRating, 71.8)
    assert.equal(seed.course.slopeRating, 128)
    assert.equal(seed.rounds.length, 8)
    const kinds = new Set(seed.shots.map((shot) => `${shot.type}:${shot.penaltyStrokes}:${shot.penaltyKind}`))
    assert.ok(kinds.has('PENALTY:2:drop'))
    assert.ok(kinds.has('PENALTY:1:drop'))
    assert.ok(seed.shots.some((shot) => shot.type === 'RECOVERY'))
    for (const round of seed.rounds) {
      const stats = buildRoundStats({
        holes: round.holes,
        shots: seed.shots.filter((shot) => shot.roundId === round.id),
        courseRating: round.courseRating,
        slopeRating: round.slopeRating,
        referenceHandicap: SEED_REFERENCE_HANDICAP,
        sgMode: 'handicap',
      })
      assert.ok(stats.score >= 100 && stats.score <= 110, `${round.id} scored ${stats.score}`)
      assert.ok(stats.pars > 0)
      const onRound = seed.shots.filter((shot) => shot.roundId === round.id)
      assert.ok(onRound.some((shot) => shot.type === 'RECOVERY'))
      assert.ok(onRound.some((shot) => shot.penaltyStrokes === 2 && shot.penaltyKind === 'drop'))
      assert.ok(onRound.some((shot) => shot.penaltyStrokes === 1 && shot.penaltyKind === 'drop'))
      assert.ok(hasDuffedChip(onRound))
      assert.ok(hasThreePutts(onRound))
    }
  })

  it('keeps score, raw strokes gained, and the adjusted total in agreement', () => {
    for (const round of seed.rounds) {
      const roundShots = seed.shots.filter((shot) => shot.roundId === round.id)
      let score = 0
      for (const hole of round.holes) {
        const shots = shotsOn(round.id, hole.holeNumber)
        const holeTotal = holeScore(shots)
        score += holeTotal
        const gained = holeStrokesGained(shots, hole.par, hole.holedOut)
        const raw = gained.reduce((sum, shot) => sum + (shot.rawSG ?? 0), 0)
        const tee = shots[0]
        assert.equal(tee.type, 'TEE')
        assert.ok(
          near(raw, expectedStrokes('TEE', tee.distance as number) - holeTotal),
          `${round.id} hole ${hole.holeNumber}`
        )
      }
      const stats = buildRoundStats({
        holes: round.holes,
        shots: roundShots,
        courseRating: round.courseRating,
        slopeRating: round.slopeRating,
        referenceHandicap: SEED_REFERENCE_HANDICAP,
        sgMode: 'handicap',
      })
      assert.equal(stats.score, score)
      const expected = expectedHandicapDifferential(SEED_REFERENCE_HANDICAP, false)
      const differential = handicapDifferential(score, round.courseRating, round.slopeRating)
      assert.ok(near(stats.sgTotal, expected - differential))
      assert.ok(near(stats.differential, differential))
    }
  })

  it('makes the dashboard headline, bars, and bins match the rounds', () => {
    const view = buildDashboard(seedDashboardInputs(seed), {
      window: 'career',
      lastN: 5,
      seasonYear: 2026,
      courseId: seed.course.id,
      referenceHandicap: SEED_REFERENCE_HANDICAP,
      sgMode: 'handicap',
    })
    assert.equal(view.roundCount, 8)
    assert.equal(view.headline?.category, view.bars[0].category)
    assert.equal(view.headline?.perRound, view.bars[0].perRound)
    assert.equal(view.bars[0].worst, true)
    for (const bar of view.bars) {
      const average =
        view.rounds.reduce((sum, round) => sum + round.stats.adjustedByCategory[bar.category], 0) /
        view.roundCount
      assert.ok(near(bar.perRound, average))
      const penalties =
        view.rounds.reduce((sum, round) => sum + round.stats.penaltySgByCategory[bar.category], 0) /
        view.roundCount
      assert.ok(near(bar.penaltyPerRound, penalties))
    }

    const yardBins = baseline.yardBins as [number, number][]
    const lies = ['TEE', 'FAIRWAY', 'ROUGH', 'SAND', 'RECOVERY']
    const shots = view.rounds.flatMap((round) => round.stats.sgShots)
    yardBins.forEach(([lo, hi], row) => {
      lies.forEach((lie, column) => {
        const matched = shots.filter(
          (shot) =>
            shot.type === lie && shot.distance != null && shot.distance >= lo && shot.distance <= hi
        )
        assert.ok(cellAgrees(view.yardCells[row][column], matched, view.roundCount))
      })
    })

    const puttBins = baseline.puttBinsFeet as [number, number][]
    const putts = shots.filter((shot) => shot.type === 'PUTTS' && (shot.distance ?? 0) >= 3)
    const leftOut = shots.filter((shot) => shot.type === 'PUTTS' && (shot.distance ?? 0) < 3)
    assert.ok(leftOut.length > 0)
    puttBins.forEach(([lo, hi], index) => {
      const matched = putts.filter((shot) => (shot.distance ?? 0) >= lo && (shot.distance ?? 0) <= hi)
      assert.ok(cellAgrees(view.puttCells[index], matched, view.roundCount))
    })
    const binned = puttBins.reduce(
      (sum, [lo, hi]) =>
        sum + putts.filter((shot) => (shot.distance ?? 0) >= lo && (shot.distance ?? 0) <= hi).length,
      0
    )
    assert.equal(binned, putts.length)
  })
})

function cellAgrees(
  cell: BinMetric,
  matched: Array<{ adjustedSG: number }>,
  rounds: number
) {
  if (matched.length === 0) return cell.sgPerRound == null && cell.shotsPerRound == null
  const sg = matched.reduce((sum, shot) => sum + shot.adjustedSG, 0)
  return (
    near(cell.sgPerRound ?? NaN, sg / rounds) &&
    near(cell.shotsPerRound ?? NaN, matched.length / rounds) &&
    near(cell.sgPerShot ?? NaN, sg / matched.length)
  )
}

describe('edge cases', () => {
  const hole = { holeNumber: 1, par: 4 as const, yards: 380, holedOut: true }
  const rating = { courseRating: 71.8, slopeRating: 128, referenceHandicap: 18, sgMode: 'handicap' as const }

  it('leaves a hole with no shots out of the score', () => {
    const stats = buildRoundStats({
      holes: [hole, { holeNumber: 2, par: 4, yards: 400, holedOut: false }],
      shots: [
        { holeNumber: 1, seq: 1, type: 'TEE', distance: 380, penaltyStrokes: 0 },
        { holeNumber: 1, seq: 2, type: 'FAIRWAY', distance: 140, penaltyStrokes: 0 },
        { holeNumber: 1, seq: 3, type: 'PUTTS', distance: 10, penaltyStrokes: 0 },
        { holeNumber: 1, seq: 4, type: 'PUTTS', distance: 2, penaltyStrokes: 0 },
      ],
      ...rating,
    })
    assert.equal(stats.holes[1].score, null)
    assert.equal(stats.score, 4)
    assert.equal(stats.greens.chances, 1)
  })

  it('does not close the strokes-gained identity on an unfinished hole', () => {
    const shots: SgShot[] = [
      { type: 'TEE', distance: 400, penaltyStrokes: 0 },
      { type: 'ROUGH', distance: 160, penaltyStrokes: 0 },
    ]
    const gained = holeStrokesGained(shots, 4, false)
    assert.equal(gained[1].rawSG, null)
    assert.notEqual(
      gained[0].rawSG,
      expectedStrokes('TEE', 400) - holeScore(shots)
    )
    const stats = buildRoundStats({
      holes: [{ holeNumber: 1, par: 4, yards: 400, holedOut: false }],
      shots: shots.map((shot, index) => ({ ...shot, holeNumber: 1, seq: index + 1 })),
      ...rating,
    })
    assert.equal(stats.score, 2)
    assert.equal(stats.holes[0].kind, null)
  })

  it('accepts a starting distance longer than the hole', () => {
    const shots = [
      { holeNumber: 1, seq: 1, type: 'TEE' as const, distance: 450, penaltyStrokes: 0 },
      { holeNumber: 1, seq: 2, type: 'FAIRWAY' as const, distance: 140, penaltyStrokes: 0 },
      { holeNumber: 1, seq: 3, type: 'PUTTS' as const, distance: 8, penaltyStrokes: 0 },
      { holeNumber: 1, seq: 4, type: 'PUTTS' as const, distance: 2, penaltyStrokes: 0 },
    ]
    assert.ok(shots[0].distance > hole.yards)
    const gained = holeStrokesGained(shots, hole.par, true)
    const raw = gained.reduce((sum, shot) => sum + (shot.rawSG ?? 0), 0)
    assert.ok(near(raw, expectedStrokes('TEE', 450) - holeScore(shots)))
    const travel = shotTravel(shots, 0, true)
    assert.equal(travel?.kind, 'yards')
    assert.ok((travel?.distance ?? 0) > 0)
    const past = shotTravel(
      [
        { type: 'FAIRWAY', distance: 20, penaltyStrokes: 0 },
        { type: 'ROUGH', distance: 35, penaltyStrokes: 0 },
      ],
      0,
      false
    )
    assert.equal(past?.distance, -15)
    assert.match(formatShotLine({ seq: 2, type: 'FAIRWAY', distance: 20 }, past), /past/)
  })

  it('holes out from off the green', () => {
    const shots = [
      { holeNumber: 1, seq: 1, type: 'TEE' as const, distance: 380, penaltyStrokes: 0 },
      { holeNumber: 1, seq: 2, type: 'ROUGH' as const, distance: 18, penaltyStrokes: 0 },
    ]
    const gained = holeStrokesGained(shots, 4, true)
    const raw = gained.reduce((sum, shot) => sum + (shot.rawSG ?? 0), 0)
    assert.equal(gained.at(-1)?.rawSG != null, true)
    assert.ok(near(raw, expectedStrokes('TEE', 380) - 2))
    const stats = buildRoundStats({
      holes: [hole],
      shots,
      ...rating,
    })
    assert.equal(stats.holes[0].kind, 'eagle')
    assert.equal(stats.holes[0].putts, 0)
  })

  it('scores only the front nine and halves the expected differential', () => {
    const front = seed.rounds[0]
    const shots = seed.shots.filter((shot) => shot.roundId === front.id)
    const stats = buildRoundStats({
      holes: front.holes,
      shots,
      courseRating: front.courseRating,
      slopeRating: front.slopeRating,
      nineHoles: true,
      referenceHandicap: SEED_REFERENCE_HANDICAP,
      sgMode: 'handicap',
    })
    const frontScore = front.holes
      .filter((hole) => hole.holeNumber <= 9)
      .reduce((sum, hole) => sum + holeScore(shotsOn(front.id, hole.holeNumber)), 0)
    assert.equal(stats.score, frontScore)
    assert.ok(stats.score < 80)
    assert.equal(stats.holes.length, 9)
    const expected = expectedHandicapDifferential(SEED_REFERENCE_HANDICAP, true)
    const full = expectedHandicapDifferential(SEED_REFERENCE_HANDICAP, false)
    assert.ok(near(expected, full / 2))
    const differential = handicapDifferential(frontScore, front.courseRating, front.slopeRating)
    assert.ok(near(stats.differential, differential))
    assert.ok(near(stats.sgTotal, expected - differential))
    assert.ok(stats.holes.every((hole) => hole.holeNumber <= 9))
  })

  it('recalculates adjusted strokes gained when the reference handicap changes', () => {
    const round = seed.rounds[0]
    const shots = seed.shots.filter((shot) => shot.roundId === round.id)
    const before = JSON.stringify(shots)
    const at28 = buildRoundStats({
      holes: round.holes,
      shots,
      courseRating: round.courseRating,
      slopeRating: round.slopeRating,
      referenceHandicap: 28,
      sgMode: 'handicap',
    })
    const plusTwo = buildRoundStats({
      holes: round.holes,
      shots,
      courseRating: round.courseRating,
      slopeRating: round.slopeRating,
      referenceHandicap: -2,
      sgMode: 'handicap',
    })
    assert.equal(JSON.stringify(shots), before)
    assert.equal(shots.some((shot) => 'rawSG' in shot || 'adjustedSG' in shot), false)
    assert.ok(near(at28.rawTotal, plusTwo.rawTotal))
    assert.notEqual(Number(at28.sgTotal.toFixed(4)), Number(plusTwo.sgTotal.toFixed(4)))
    assert.ok(
      expectedHandicapDifferential(-2, false) < expectedHandicapDifferential(28, false)
    )
    assert.ok(near(plusTwo.sgTotal, expectedHandicapDifferential(-2, false) - plusTwo.differential))
    assert.ok(near(at28.sgTotal, expectedHandicapDifferential(28, false) - at28.differential))
  })
})

function hasDuffedChip(shots: SeedShot[]) {
  const holes = new Set(shots.map((shot) => shot.holeNumber))
  for (const holeNumber of holes) {
    const ordered = shots.filter((shot) => shot.holeNumber === holeNumber).sort((a, b) => a.seq - b.seq)
    for (let index = 0; index < ordered.length; index += 1) {
      const shot = ordered[index]
      if (shot.type === 'PUTTS' || shot.type === 'PENALTY' || shot.type === 'TEE') continue
      if ((shot.distance ?? 99) > 49) continue
      const next = ordered.slice(index + 1).find((item) => item.type !== 'PENALTY')
      if (next && next.type !== 'PUTTS') return true
    }
  }
  return false
}

function hasThreePutts(shots: SeedShot[]) {
  const holes = new Set(shots.map((shot) => shot.holeNumber))
  for (const holeNumber of holes) {
    const putts = shots.filter((shot) => shot.holeNumber === holeNumber && shot.type === 'PUTTS').length
    if (putts >= 3) return true
  }
  return false
}
