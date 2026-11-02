import { holeScore } from './shotMath.js'

/** @param {import('./schema.js').Round} round */
export function holesInPlay(round) {
  const limit = round.nineHoles ? 9 : 18
  return [...round.holes]
    .filter((hole) => hole.holeNumber <= limit)
    .sort((a, b) => a.holeNumber - b.holeNumber)
}

/** @param {import('./schema.js').Round[]} rounds */
export function latestInProgressRound(rounds) {
  return (
    [...rounds]
      .filter((round) => round.status === 'in_progress')
      .sort(
        (a, b) =>
          b.playedAt.localeCompare(a.playedAt) || b.createdAt.localeCompare(a.createdAt)
      )[0] ?? null
  )
}

/** First hole that is not holed out. Falls back to the last hole in the round. */
export function firstUnfinishedHole(round) {
  const holes = holesInPlay(round)
  return holes.find((hole) => !hole.holedOut)?.holeNumber ?? holes.at(-1)?.holeNumber ?? 1
}

/** @param {import('./schema.js').GolfShot[]} shots */
export function holeStrokes(shots) {
  return holeScore(shots)
}

/**
 * Score relative to par for holed-out holes before this one.
 * @param {import('./schema.js').Round} round
 * @param {number} holeNumber
 * @param {import('./schema.js').GolfShot[]} shots
 */
export function scoreThru(round, holeNumber, shots) {
  const previous = holesInPlay(round).filter(
    (hole) => hole.holeNumber < holeNumber && hole.holedOut
  )
  const diff = previous.reduce((total, hole) => {
    const taken = holeStrokes(shots.filter((shot) => shot.holeNumber === hole.holeNumber))
    return total + taken - hole.par
  }, 0)
  const label = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : String(diff)
  return `${label} thru ${previous.length}`
}

export function todayPlayedAt() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
