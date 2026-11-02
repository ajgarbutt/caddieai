import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  distanceWarning,
  formatHoleScore,
  formatShotLine,
  holeScore,
  isReplayShot,
  penaltiesAfter,
  shotTravel,
  travelled,
} from './shotMath.js'

function shot(seq, type, distance, penaltyStrokes = 0, penaltyKind = null) {
  return { seq, type, distance, penaltyStrokes, penaltyKind }
}

describe('holeScore', () => {
  it('counts each non-penalty shot as one stroke', () => {
    const shots = [
      shot(1, 'TEE', 380),
      shot(2, 'FAIRWAY', 150),
      shot(3, 'PUTTS', 20),
      shot(4, 'PUTTS', 4),
    ]
    assert.equal(holeScore(shots), 4)
  })

  it('adds penalty strokes instead of counting the penalty row as one', () => {
    const shots = [
      shot(1, 'TEE', 180),
      shot(2, 'PENALTY', null, 2),
      shot(3, 'TEE', 180),
      shot(4, 'PENALTY', null, 1),
      shot(5, 'PUTTS', 8),
    ]
    assert.equal(holeScore(shots), 6)
  })

  it('names a score against par', () => {
    assert.equal(formatHoleScore(6, 4), '6 · Double bogey')
    assert.equal(formatHoleScore(4, 4), '4 · Par')
    assert.equal(formatHoleScore(3, 4), '3 · Birdie')
    assert.equal(formatHoleScore(2, 5), '2 · Albatross')
    assert.equal(formatHoleScore(3, 5), '3 · Eagle')
    assert.equal(formatHoleScore(5, 4), '5 · Bogey')
    assert.equal(formatHoleScore(7, 4), '7 · Triple bogey')
    assert.equal(formatHoleScore(9, 4), '9 · 5 over')
  })
})

describe('shotTravel unit conversions', () => {
  it('subtracts yards from yards', () => {
    const shots = [shot(1, 'TEE', 400), shot(2, 'ROUGH', 160), shot(3, 'FAIRWAY', 30)]
    const travel = shotTravel(shots, 1, false)
    assert.deepEqual(travel, { kind: 'yards', distance: 130 })
    assert.equal(formatShotLine(shots[1], travel), '#2 · ROUGH · 160 yds → went 130 yds')
  })

  it('converts a following putt from feet into yards', () => {
    const shots = [shot(1, 'FAIRWAY', 20), shot(2, 'PUTTS', 15)]
    const travel = shotTravel(shots, 0, false)
    assert.deepEqual(travel, { kind: 'yards', distance: 15 })
    assert.equal(formatShotLine(shots[0], travel), '#1 · FAIRWAY · 20 yds → went 15 yds')
  })

  it('subtracts feet from feet', () => {
    const shots = [shot(1, 'PUTTS', 12), shot(2, 'PUTTS', 2)]
    const travel = shotTravel(shots, 0, false)
    assert.deepEqual(travel, { kind: 'feet', distance: 10 })
    assert.equal(formatShotLine(shots[0], travel), '#1 · PUTTS · 12 ft → went 10 ft')
  })

  it('converts a following yardage into feet when the shot was a putt', () => {
    const shots = [shot(1, 'PUTTS', 30), shot(2, 'ROUGH', 8)]
    const travel = shotTravel(shots, 0, false)
    assert.deepEqual(travel, { kind: 'feet', distance: 6 })
    assert.equal(formatShotLine(shots[0], travel), '#1 · PUTTS · 30 ft → went 6 ft')
  })

  it('shows a negative result as past the hole', () => {
    const shots = [shot(1, 'FAIRWAY', 100), shot(2, 'ROUGH', 115)]
    const travel = shotTravel(shots, 0, false)
    assert.deepEqual(travel, { kind: 'yards', distance: -15 })
    assert.equal(formatShotLine(shots[0], travel), '#1 · FAIRWAY · 100 yds → went 15 yds past')
  })

  it('shows a putt that went past in feet', () => {
    const shots = [shot(1, 'PUTTS', 8), shot(2, 'PUTTS', 14)]
    const travel = shotTravel(shots, 0, false)
    assert.deepEqual(travel, { kind: 'feet', distance: -6 })
    assert.equal(formatShotLine(shots[0], travel), '#1 · PUTTS · 8 ft → went 6 ft past')
  })

  it('gives the last shot its full start distance once the hole is holed out', () => {
    const yards = [shot(1, 'TEE', 160), shot(2, 'PUTTS', 12)]
    assert.deepEqual(shotTravel(yards, 0, true), { kind: 'yards', distance: 156 })
    assert.equal(formatShotLine(yards[0], shotTravel(yards, 0, true)), '#1 · TEE · 160 yds → went 156 yds')
    assert.deepEqual(shotTravel(yards, 1, true), { kind: 'feet', distance: 12 })
    assert.equal(formatShotLine(yards[1], shotTravel(yards, 1, true)), '#2 · PUTTS · 12 ft → went 12 ft')

    const onlyTee = [shot(1, 'TEE', 320)]
    assert.deepEqual(shotTravel(onlyTee, 0, true), { kind: 'yards', distance: 320 })
    assert.deepEqual(shotTravel(onlyTee, 0, false), { kind: 'pending' })
    assert.equal(formatShotLine(onlyTee[0], shotTravel(onlyTee, 0, false)), '#1 · TEE · 320 yds')
  })

  it('drops travel when the next penalty is a lost ball', () => {
    const shots = [shot(1, 'TEE', 180), shot(2, 'PENALTY', null, 1, 'replay'), shot(3, 'TEE', 170)]
    assert.deepEqual(shotTravel(shots, 0, false), { kind: 'ob' })
    assert.equal(formatShotLine(shots[0], shotTravel(shots, 0, false)), '#1 · TEE · 180 yds → OB / lost')
    assert.equal(formatShotLine(shots[1], shotTravel(shots, 1, false)), 'Penalty +1 (OB, re-tee)')
    assert.equal(travelled(shots, 0), null)
    assert.deepEqual(shotTravel(shots, 2, false), { kind: 'pending' })
  })

  it('still measures travel across a one-stroke penalty', () => {
    const shots = [shot(1, 'TEE', 200), shot(2, 'PENALTY', null, 1, 'drop'), shot(3, 'ROUGH', 80)]
    assert.deepEqual(shotTravel(shots, 0, false), { kind: 'yards', distance: 120 })
  })

  it('keeps an earlier shot measured when a later shot is lost', () => {
    const shots = [shot(1, 'TEE', 400), shot(2, 'ROUGH', 160), shot(3, 'PENALTY', null, 1, 'replay')]
    assert.deepEqual(shotTravel(shots, 0, true), { kind: 'yards', distance: 240 })
    assert.deepEqual(shotTravel(shots, 1, true), { kind: 'ob' })
  })
})

describe('distanceWarning', () => {
  it('warns outside the soft ranges and stays quiet inside them', () => {
    assert.equal(distanceWarning('TEE', '100'), null)
    assert.equal(distanceWarning('TEE', '660'), null)
    assert.equal(distanceWarning('TEE', '99'), 'Tee shots are usually 100–660 yards.')
    assert.equal(distanceWarning('TEE', '661'), 'Tee shots are usually 100–660 yards.')

    assert.equal(distanceWarning('FAIRWAY', '10'), null)
    assert.equal(distanceWarning('ROUGH', '600'), null)
    assert.equal(distanceWarning('SAND', '9'), 'For a chip under 10 yards, enter 10.')
    assert.equal(distanceWarning('RECOVERY', '601'), 'Shots are usually 10–600 yards.')

    assert.equal(distanceWarning('PUTTS', '1'), null)
    assert.equal(distanceWarning('PUTTS', '110'), null)
    assert.equal(distanceWarning('PUTTS', '0.5'), 'Putts are usually 1–110 feet.')
    assert.equal(distanceWarning('PUTTS', '111'), 'Putts are usually 1–110 feet.')

    assert.equal(distanceWarning('PENALTY', ''), null)
    assert.equal(distanceWarning('FAIRWAY', ''), null)
  })
})

describe('penalties', () => {
  it('scores a re-tee and leaves the lost ball with no travelled distance', () => {
    const shots = [
      shot(1, 'TEE', 400),
      shot(2, 'PENALTY', null, 1, 'replay'),
      shot(3, 'TEE', 400),
      shot(4, 'FAIRWAY', 160),
      shot(5, 'PUTTS', 20),
      shot(6, 'PUTTS', 3),
    ]
    assert.equal(holeScore(shots), 6)
    assert.equal(penaltiesAfter(shots, 0), 1)
    assert.equal(travelled(shots, 0, true), null)
    assert.equal(travelled(shots, 2, true), 240)
    assert.equal(formatShotLine(shots[0], shotTravel(shots, 0, true)), '#1 · TEE · 400 yds → OB / lost')
    assert.equal(formatShotLine(shots[1], null), 'Penalty +1 (OB, re-tee)')
    assert.equal(formatShotLine(shots[3], shotTravel(shots, 3, true)), '#4 · FAIRWAY · 160 yds → went 153.33 yds')
    assert.equal(formatShotLine(shots[4], shotTravel(shots, 4, true)), '#5 · PUTTS · 20 ft → went 17 ft')
    assert.equal(formatShotLine(shots[5], shotTravel(shots, 5, true)), '#6 · PUTTS · 3 ft → went 3 ft')
  })

  it('measures a one-stroke drop from the next lie', () => {
    const shots = [
      shot(1, 'TEE', 400),
      shot(2, 'PENALTY', null, 1, 'drop'),
      shot(3, 'ROUGH', 180),
    ]
    assert.equal(penaltiesAfter(shots, 0), 1)
    assert.equal(travelled(shots, 0), 220)
    assert.equal(formatShotLine(shots[1], null), 'Penalty +1 (water drop)')
    assert.equal(holeScore(shots), 3)
  })

  it('includes two penalty strokes for an out-of-bounds drop', () => {
    const shots = [
      shot(1, 'TEE', 400),
      shot(2, 'PENALTY', null, 2, 'drop'),
      shot(3, 'FAIRWAY', 180),
    ]
    assert.equal(penaltiesAfter(shots, 0), 2)
    assert.equal(travelled(shots, 0), 220)
    assert.equal(formatShotLine(shots[1], null), 'Penalty +2 (OB drop)')
    assert.equal(holeScore(shots), 4)
  })

  it('allows two re-tees in a row', () => {
    const shots = [
      shot(1, 'TEE', 400),
      shot(2, 'PENALTY', null, 1, 'replay'),
      shot(3, 'TEE', 400),
      shot(4, 'PENALTY', null, 1, 'replay'),
      shot(5, 'TEE', 400),
      shot(6, 'FAIRWAY', 200),
    ]
    assert.equal(travelled(shots, 0), null)
    assert.equal(travelled(shots, 2), null)
    assert.equal(travelled(shots, 4), 200)
    assert.equal(penaltiesAfter(shots, 0), 1)
    assert.equal(penaltiesAfter(shots, 2), 1)
    assert.equal(holeScore(shots), 6)
    assert.equal(isReplayShot(shots, 2), true)
    assert.equal(isReplayShot(shots, 4), true)
    assert.equal(isReplayShot(shots, 5), false)
  })
})
