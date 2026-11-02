import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import baseline from './sg-baseline.json' with { type: 'json' }
import {
  buildRoundStats,
  drivingDistance,
  extraShotsNearGreen,
  extraShotsOntoGreen,
  fairwayHit,
  greenInRegulation,
  scoreKind,
  scrambleResult,
  type StatHole,
  type StatShot,
} from './roundStats.ts'

function hole(partial: Partial<StatHole> & Pick<StatHole, 'par'>): StatHole {
  return {
    holeNumber: 1,
    yards: 400,
    holedOut: true,
    ...partial,
  }
}

function shot(
  seq: number,
  type: StatShot['type'],
  distance: number | null,
  penaltyStrokes = 0,
  penaltyKind: StatShot['penaltyKind'] = null
): StatShot {
  return { holeNumber: 1, seq, type, distance, penaltyStrokes, penaltyKind }
}

describe('scoreKind', () => {
  it('groups eagle or better, birdie, par, bogey, and double or worse', () => {
    assert.equal(scoreKind(2, 5), 'eagle')
    assert.equal(scoreKind(3, 5), 'eagle')
    assert.equal(scoreKind(3, 4), 'birdie')
    assert.equal(scoreKind(4, 4), 'par')
    assert.equal(scoreKind(5, 4), 'bogey')
    assert.equal(scoreKind(6, 4), 'double')
    assert.equal(scoreKind(8, 4), 'double')
  })
})

describe('fairways and driving', () => {
  const par4 = hole({ par: 4, yards: 400 })

  it('counts a fairway, and a drive that reaches the green', () => {
    const found = [shot(1, 'TEE', 400), shot(2, 'FAIRWAY', 160)]
    assert.equal(fairwayHit(par4, found), true)
    assert.equal(drivingDistance(par4, found, 0), 240)

    const green = [shot(1, 'TEE', 380), shot(2, 'PUTTS', 20)]
    assert.equal(fairwayHit(par4, green), true)
    assert.equal(drivingDistance(par4, green, 0), null)
  })

  it('misses the fairway when the tee shot took a penalty, and still measures the re-tee', () => {
    const shots = [
      shot(1, 'TEE', 400),
      shot(2, 'PENALTY', null, 1, 'replay'),
      shot(3, 'TEE', 400),
      shot(4, 'FAIRWAY', 200),
    ]
    assert.equal(fairwayHit(par4, shots), false)
    assert.equal(drivingDistance(par4, shots, 0), null)
    assert.equal(drivingDistance(par4, shots, 2), 200)
  })

  it('ignores par 3s', () => {
    const par3 = hole({ par: 3, yards: 160 })
    const shots = [shot(1, 'TEE', 160), shot(2, 'FAIRWAY', 20)]
    assert.equal(fairwayHit(par3, shots), false)
    assert.equal(drivingDistance(par3, shots, 0), null)
  })
})

describe('greens and extra shots', () => {
  const par4 = hole({ par: 4 })

  it('is in regulation at par − 2, one under at −1, and a chip-on at 0', () => {
    const gir = [shot(1, 'TEE', 400), shot(2, 'FAIRWAY', 150), shot(3, 'PUTTS', 20)]
    assert.equal(greenInRegulation(par4, gir), true)
    assert.equal(extraShotsOntoGreen(par4, gir), 0)
    assert.equal(extraShotsNearGreen(par4, gir), 0)

    const under = [shot(1, 'TEE', 380), shot(2, 'PUTTS', 15)]
    assert.equal(greenInRegulation(par4, under), true)
    assert.equal(extraShotsOntoGreen(par4, under), -1)

    const chip = [
      shot(1, 'TEE', 400),
      shot(2, 'ROUGH', 100),
      shot(3, 'FAIRWAY', 20),
      shot(4, 'PUTTS', 8),
    ]
    assert.equal(greenInRegulation(par4, chip), false)
    assert.equal(extraShotsOntoGreen(par4, chip), 0)
  })

  it('adds a penalty stroke before the green and before the short game', () => {
    const shots = [
      shot(1, 'TEE', 400),
      shot(2, 'PENALTY', null, 1, 'drop'),
      shot(3, 'ROUGH', 180),
      shot(4, 'FAIRWAY', 30),
      shot(5, 'PUTTS', 10),
    ]
    assert.equal(greenInRegulation(par4, shots), false)
    assert.equal(extraShotsOntoGreen(par4, shots), 1)
    assert.equal(extraShotsNearGreen(par4, shots), 1)
  })
})

describe('scrambling', () => {
  const par4 = hole({ par: 4, holedOut: true })

  it('succeeds with one putt or a holed chip, and fails with two putts', () => {
    const upAndDown = [shot(1, 'TEE', 400), shot(2, 'FAIRWAY', 30), shot(3, 'PUTTS', 6)]
    assert.equal(scrambleResult(par4, upAndDown), 'success')

    const holedChip = [shot(1, 'TEE', 400), shot(2, 'FAIRWAY', baseline.shortGameMaxYards)]
    assert.equal(scrambleResult(par4, holedChip), 'success')

    const twoPutts = [
      shot(1, 'TEE', 400),
      shot(2, 'FAIRWAY', 30),
      shot(3, 'PUTTS', 20),
      shot(4, 'PUTTS', 3),
    ]
    assert.equal(scrambleResult(par4, twoPutts), 'fail')
  })

  it('uses the short-game distance from the baseline, and not a par-4 tee shot', () => {
    const approach = [shot(1, 'TEE', 400), shot(2, 'FAIRWAY', baseline.shortGameMaxYards + 1)]
    assert.equal(scrambleResult(par4, approach), 'none')

    const shortTee = [shot(1, 'TEE', baseline.shortGameMaxYards)]
    assert.equal(scrambleResult(par4, shortTee), 'none')
  })

  it('does not count an unfinished chip as a save', () => {
    const open = hole({ par: 4, holedOut: false })
    assert.equal(scrambleResult(open, [shot(1, 'FAIRWAY', 20)]), 'fail')
  })
})

describe('buildRoundStats', () => {
  it('totals the scorecard, traditional stats, and strokes gained', () => {
    const holes: StatHole[] = [
      hole({ holeNumber: 1, par: 4, yards: 400 }),
      hole({ holeNumber: 2, par: 4, yards: 400 }),
      hole({ holeNumber: 3, par: 3, yards: 160 }),
      hole({ holeNumber: 9, par: 5, yards: 520 }),
      hole({ holeNumber: 10, par: 4, yards: 380, holedOut: false }),
    ]
    const shots: StatShot[] = [
      shot(1, 'TEE', 400),
      shot(2, 'FAIRWAY', 160),
      shot(3, 'PUTTS', 12),
      shot(4, 'PUTTS', 2),
      { ...shot(1, 'TEE', 400), holeNumber: 2 },
      { ...shot(2, 'PENALTY', null, 1, 'drop'), holeNumber: 2 },
      { ...shot(3, 'ROUGH', 180), holeNumber: 2 },
      { ...shot(4, 'FAIRWAY', 30), holeNumber: 2 },
      { ...shot(5, 'PUTTS', 8), holeNumber: 2 },
      { ...shot(6, 'PUTTS', 2), holeNumber: 2 },
      { ...shot(1, 'TEE', 160), holeNumber: 3 },
      { ...shot(2, 'PUTTS', 10), holeNumber: 3 },
      { ...shot(1, 'TEE', 520), holeNumber: 9 },
      { ...shot(2, 'FAIRWAY', 200), holeNumber: 9 },
      { ...shot(3, 'FAIRWAY', 40), holeNumber: 9 },
    ]

    const stats = buildRoundStats({
      holes,
      shots,
      courseRating: 16,
      slopeRating: 113,
      handicapScoreOverride: null,
      referenceHandicap: 18,
      sgMode: 'handicap',
    })

    assert.equal(stats.holes[0].kind, 'par')
    assert.equal(stats.holes[0].gir, true)
    assert.equal(stats.holes[0].fairway, true)
    assert.equal(stats.holes[1].score, 6)
    assert.equal(stats.holes[1].kind, 'double')
    assert.equal(stats.holes[1].gir, false)
    assert.equal(stats.holes[1].fairway, false)
    assert.equal(stats.holes[2].kind, 'birdie')
    assert.equal(stats.holes[2].gir, true)
    assert.equal(stats.holes[2].fairway, 'na')
    assert.equal(stats.holes[3].kind, 'eagle')
    assert.equal(stats.holes[3].gir, false)
    assert.equal(stats.holes[3].fairway, true)
    assert.equal(stats.holes[4].score, null)
    assert.equal(stats.holes[4].gir, null)
    assert.equal(stats.holes[4].fairway, null)

    assert.equal(stats.out.score, 4 + 6 + 2 + 3)
    assert.equal(stats.in.score, null)
    assert.equal(stats.total.score, 15)
    assert.equal(stats.score, 15)
    assert.equal(stats.scoreToPar, -1)
    assert.equal(stats.differential, -1)

    assert.deepEqual(stats.fairways, { hit: 2, chances: 3 })
    assert.deepEqual(stats.greens, { hit: 2, chances: 4 })
    assert.equal(stats.putts, 5)
    assert.deepEqual(stats.scrambling, { success: 1, chances: 2 })
    assert.equal(stats.extraOntoGreen, 0)
    assert.equal(stats.extraNearGreen, 0)
    assert.equal(stats.penaltyStrokes, 1)
    assert.equal(stats.drivingDistance, (240 + 320) / 2)
    assert.equal(stats.eagles, 1)
    assert.equal(stats.birdies, 1)
    assert.equal(stats.pars, 1)
    assert.equal(stats.bogeys, 0)
    assert.equal(stats.doubles, 1)

    const holeSg = stats.holes
      .map((item) => item.adjustedSg)
      .filter((value): value is number => value != null)
      .reduce((sum, value) => sum + value, 0)
    assert.ok(Math.abs(holeSg - stats.sgTotal) < 1e-9)
    assert.equal(stats.penaltySgByCategory.OTT, -1)
    assert.ok(stats.worstCategory)
  })

  it('uses a handicap score override for the differential only', () => {
    const stats = buildRoundStats({
      holes: [hole({ par: 4 })],
      shots: [shot(1, 'TEE', 400), shot(2, 'PUTTS', 10)],
      courseRating: 4,
      slopeRating: 113,
      handicapScoreOverride: 8,
      referenceHandicap: 0,
      sgMode: 'raw',
    })
    assert.equal(stats.score, 2)
    assert.equal(stats.handicapScore, 8)
    assert.equal(stats.differential, 4)
    assert.equal(stats.sgTotal, stats.rawTotal)
    for (const category of ['OTT', 'APP', 'ARG', 'PUTT'] as const) {
      assert.equal(stats.adjustedByCategory[category], stats.rawByCategory[category])
    }
  })
})
