import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { holeScore } from './shotMath.js'
import baseline from './sg-baseline.json' with { type: 'json' }
import {
  expectedHandicapDifferential,
  expectedStrokes,
  handicapDifferential,
  holeStrokesGained,
  roundStrokesGained,
  scoreForHandicap,
  shotCategory,
  type SgCategory,
  type SgLie,
  type RoundSgShot,
  type SgShot,
} from './strokesGained.ts'

function lie(type: SgLie, distance: number): SgShot {
  return { type, distance, penaltyStrokes: 0 }
}

function penalty(strokes: number, kind: 'replay' | 'drop'): SgShot {
  return { type: 'PENALTY', distance: null, penaltyStrokes: strokes, penaltyKind: kind }
}

/** Compare a computed SG value with the two-decimal figure from the baseline. */
function assertSg(actual: number | null, expected: number) {
  assert.equal(actual == null ? null : Number(actual.toFixed(2)), expected)
}

function assertIdentity(shots: SgShot[], par: number) {
  const gained = holeStrokesGained(shots, par, true)
  const total = gained.reduce((sum, shot) => sum + (shot.rawSG ?? 0), 0)
  const start = expectedStrokes(shots[0].type as SgLie, shots[0].distance as number)
  assert.ok(
    Math.abs(total - (start - holeScore(shots))) < 1e-9,
    `sum ${total} should equal ${start} − ${holeScore(shots)}`
  )
}

describe('expectedStrokes', () => {
  it('reads exact rows from the baseline', () => {
    assert.equal(expectedStrokes('TEE', 380), 3.96)
    assert.equal(expectedStrokes('ROUGH', 160), 3.23)
    assert.equal(expectedStrokes('FAIRWAY', 30), 2.5)
    assert.equal(expectedStrokes('PUTTS', 12), 1.69)
    assert.equal(expectedStrokes('PUTTS', 2), 1)
  })

  it('floors to the greatest row at or below the distance', () => {
    assert.equal(expectedStrokes('FAIRWAY', 147), 2.93)
    assert.equal(expectedStrokes('PUTTS', 19), 1.85)
    assert.equal(expectedStrokes('SAND', 12), 2.41)
    assert.equal(expectedStrokes('RECOVERY', 12), 3.35)
  })

  it('uses the first row below the table and the last row above it', () => {
    for (const lieName of ['TEE', 'FAIRWAY', 'ROUGH', 'SAND', 'RECOVERY'] as const) {
      const rows = baseline.yards[lieName]
      const [firstDistance, firstExpected] = rows[0]
      const [lastDistance, lastExpected] = rows[rows.length - 1]
      assert.equal(expectedStrokes(lieName, firstDistance - 1), firstExpected)
      assert.equal(expectedStrokes(lieName, lastDistance + 50), lastExpected)
    }
    const [firstPutt, firstPuttExpected] = baseline.puttsFeet[0]
    const [lastPutt, lastPuttExpected] = baseline.puttsFeet[baseline.puttsFeet.length - 1]
    assert.equal(expectedStrokes('PUTTS', firstPutt - 1), firstPuttExpected)
    assert.equal(expectedStrokes('PUTTS', lastPutt + 50), lastPuttExpected)
  })
})

describe('shotCategory', () => {
  it('sends par-4 and par-5 tee shots off the tee, including inside the short-game distance', () => {
    assert.equal(shotCategory('TEE', 380, 4), 'OTT')
    assert.equal(shotCategory('TEE', 520, 5), 'OTT')
    assert.equal(shotCategory('TEE', baseline.shortGameMaxYards, 4), 'OTT')
  })

  it('splits other lies at the baseline short-game distance, with par-3 tees in approach', () => {
    const edge = baseline.shortGameMaxYards
    assert.equal(shotCategory('FAIRWAY', edge, 4), 'ARG')
    assert.equal(shotCategory('FAIRWAY', edge + 1, 4), 'APP')
    assert.equal(shotCategory('ROUGH', edge, 3), 'ARG')
    assert.equal(shotCategory('TEE', 160, 3), 'APP')
    assert.equal(shotCategory('PUTTS', 40, 4), 'PUTT')
  })
})

describe('holeStrokesGained', () => {
  it('splits a par 4 and matches expected strokes minus the score', () => {
    const shots = [
      lie('TEE', 380),
      lie('ROUGH', 160),
      lie('FAIRWAY', 30),
      lie('PUTTS', 12),
      lie('PUTTS', 2),
    ]
    const gained = holeStrokesGained(shots, 4, true)
    assert.deepEqual(
      gained.map((shot) => shot.category),
      ['OTT', 'APP', 'ARG', 'PUTT', 'PUTT']
    )
    assertSg(gained[0].rawSG, -0.27)
    assertSg(gained[1].rawSG, -0.27)
    assertSg(gained[2].rawSG, -0.19)
    assertSg(gained[3].rawSG, -0.31)
    assertSg(gained[4].rawSG, 0)
    assert.equal(gained[4].penaltySG, 0)
    assert.equal(holeScore(shots), 5)
    assertIdentity(shots, 4)
    assertSg(
      gained.reduce((sum, shot) => sum + (shot.rawSG ?? 0), 0),
      -1.04
    )
  })

  it('charges a lost ball to the tee shot and counts the re-tee as its own off-the-tee shot', () => {
    const shots = [
      lie('TEE', 520),
      penalty(1, 'replay'),
      lie('TEE', 520),
      lie('FAIRWAY', 270),
    ]
    const gained = holeStrokesGained(shots, 5, false)
    assert.equal(gained.length, 3)
    assert.equal(gained.filter((shot) => shot.category === 'OTT').length, 2)
    assertSg(gained[0].rawSG, -2)
    assert.equal(gained[0].penaltySG, -1)
    assert.equal(gained[0].category, 'OTT')
    assertSg(gained[1].rawSG, -0.09)
    assert.equal(gained[1].penaltySG, 0)
    assert.equal(gained[1].category, 'OTT')
    assert.equal(gained[2].rawSG, null)
    assert.equal(gained[2].category, 'APP')
  })

  it('charges a one-stroke drop to the tee shot', () => {
    const shots = [lie('TEE', 400), penalty(1, 'drop'), lie('ROUGH', 180)]
    const [tee] = holeStrokesGained(shots, 4, false)
    assertSg(tee.rawSG, -1.32)
    assert.equal(tee.penaltySG, -1)
    assert.equal(tee.category, 'OTT')
  })

  it('charges two penalty strokes for an out-of-bounds drop', () => {
    const shots = [lie('TEE', 400), penalty(2, 'drop'), lie('FAIRWAY', 180)]
    const [tee] = holeStrokesGained(shots, 4, false)
    assertSg(tee.rawSG, -2.09)
    assert.equal(tee.penaltySG, -2)
    assert.equal(tee.category, 'OTT')
  })

  it('keeps the completed-hole identity when penalty strokes are in the score', () => {
    const dropped = [
      lie('TEE', 400),
      penalty(1, 'drop'),
      lie('ROUGH', 180),
      lie('PUTTS', 10),
    ]
    assertIdentity(dropped, 4)

    const replayed = [
      lie('TEE', 520),
      penalty(1, 'replay'),
      lie('TEE', 520),
      lie('FAIRWAY', 270),
      lie('PUTTS', 8),
    ]
    const gained = holeStrokesGained(replayed, 5, true)
    assert.equal(gained.filter((shot) => shot.category === 'OTT').length, 2)
    assertIdentity(replayed, 5)
  })
})

function shotsForCategory(category: SgCategory, count: number, rawTotal: number): RoundSgShot[] {
  const rawSG = rawTotal / count
  return Array.from({ length: count }, () => ({ category, rawSG, penaltySG: 0 }))
}

/** The synthetic round from the handicap-adjustment check. */
function syntheticRound(sgMode: 'handicap' | 'raw') {
  const shots = [
    ...shotsForCategory('OTT', 14, -4),
    ...shotsForCategory('APP', 30, -9),
    ...shotsForCategory('ARG', 20, -3.5),
    ...shotsForCategory('PUTT', 36, -3.5),
  ]
  shots[0] = { ...shots[0], penaltySG: -1 }
  return roundStrokesGained({
    shots,
    score: 100,
    courseRating: 70,
    slopeRating: 125,
    nineHoles: false,
    referenceHandicap: 18,
    sgMode,
  })
}

describe('handicap adjustment', () => {
  it('expects scratch to average the baseline differential and a 50 handicap to double it', () => {
    assert.equal(expectedHandicapDifferential(0), baseline.scratchAverageDifferential)
    assert.equal(expectedHandicapDifferential(baseline.doublingHandicap), 56)
    assert.equal(
      expectedHandicapDifferential(18, true),
      expectedHandicapDifferential(18) / 2
    )
  })

  it('uses the handicap override instead of the gross score', () => {
    assert.equal(scoreForHandicap(100, null), 100)
    assert.equal(scoreForHandicap(100, 90), 90)
    assert.equal(handicapDifferential(90, 70, 125), ((90 - 70) * 113) / 125)
  })

  it('adjusts the synthetic round to the reference handicap', () => {
    const round = syntheticRound('handicap')
    assert.equal(Number(round.differential.toFixed(2)), 27.12)
    assert.equal(Number(round.expectedDifferential.toFixed(2)), 22.08)
    assert.equal(Number(round.adjustment.toFixed(2)), 14.96)
    assert.equal(Number(round.denom.toFixed(2)), 108.6)
    assert.equal(Number(round.rawTotal.toFixed(2)), -20)
    assert.equal(Number(round.rawByCategory.OTT.toFixed(2)), -4)
    assert.equal(Number(round.rawByCategory.APP.toFixed(2)), -9)
    assert.equal(Number(round.rawByCategory.ARG.toFixed(2)), -3.5)
    assert.equal(Number(round.rawByCategory.PUTT.toFixed(2)), -3.5)

    assert.equal(Number(round.adjustedByCategory.OTT.toFixed(2)), -0.43)
    assert.equal(Number(round.adjustedByCategory.APP.toFixed(2)), -3.01)
    assert.equal(Number(round.adjustedByCategory.ARG.toFixed(2)), -0.33)
    assert.equal(Number(round.adjustedByCategory.PUTT.toFixed(2)), -1.27)
    assert.equal(Number(round.total.toFixed(2)), -5.04)
    assert.equal(round.shots[0].penaltySG, -1)

    const share = round.shots[0].adjustedSG - round.shots[0].rawSG
    assert.ok(Math.abs(share - (round.adjustment * baseline.categoryWeights.OTT) / round.denom) < 1e-9)
    const categorySum = (Object.values(round.adjustedByCategory) as number[]).reduce(
      (sum, value) => sum + value,
      0
    )
    assert.ok(Math.abs(categorySum - round.total) < 1e-9)
    assert.ok(Math.abs(round.total - (round.expectedDifferential - round.differential)) < 1e-9)
  })

  it('leaves raw mode unchanged', () => {
    const round = syntheticRound('raw')
    assert.equal(round.adjustment, 0)
    assert.equal(round.total, round.rawTotal)
    for (const shot of round.shots) assert.equal(shot.adjustedSG, shot.rawSG)
    assert.deepEqual(round.adjustedByCategory, round.rawByCategory)
    assert.equal(Number(round.adjustedByCategory.OTT.toFixed(2)), -4)
    assert.equal(Number(round.adjustedByCategory.APP.toFixed(2)), -9)
    assert.equal(Number(round.adjustedByCategory.ARG.toFixed(2)), -3.5)
    assert.equal(Number(round.adjustedByCategory.PUTT.toFixed(2)), -3.5)
    assert.equal(Number(round.total.toFixed(2)), -20)
  })

  it('gives every shot in a category the same share of the adjustment', () => {
    const round = roundStrokesGained({
      shots: [
        { category: 'OTT', rawSG: -1, penaltySG: 0 },
        { category: 'OTT', rawSG: -3, penaltySG: -2 },
      ],
      score: 80,
      courseRating: 71,
      slopeRating: 130,
      referenceHandicap: 10,
      sgMode: 'handicap',
    })
    const firstShare = round.shots[0].adjustedSG - round.shots[0].rawSG
    const secondShare = round.shots[1].adjustedSG - round.shots[1].rawSG
    assert.equal(firstShare, secondShare)
    assert.equal(round.shots[1].penaltySG, -2)
    assert.equal(round.shots[1].category, 'OTT')
  })
})
