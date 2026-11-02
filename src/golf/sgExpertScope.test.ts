import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { courseMatchScore, resolveSgScope, sgScopeReply, type ExpertRound } from './sgExpertScope.ts'

const today = new Date(2026, 9, 8)

function round(partial: Partial<ExpertRound> & Pick<ExpertRound, 'id' | 'playedAt' | 'courseName'>): ExpertRound {
  return {
    createdAt: `${partial.playedAt}T12:00:00.000Z`,
    finished: true,
    ...partial,
  }
}

const rounds = [
  round({ id: 'saltford-oct', playedAt: '2026-10-07', courseName: 'Saltford' }),
  round({ id: 'saltford-sep', playedAt: '2026-09-14', courseName: 'Saltford' }),
  round({ id: 'open', playedAt: '2026-10-08', courseName: 'Saltford', finished: false }),
  round({ id: 'meadow', playedAt: '2026-08-02', courseName: 'Meadow Park' }),
]

describe('resolveSgScope', () => {
  it('asks when the question does not name a round or the average', () => {
    const choice = resolveSgScope(
      'How am I losing strokes on putting when I only had 34 putts',
      rounds,
      null,
      today
    )
    assert.equal(choice.kind, 'ask')
    assert.equal(
      sgScopeReply(choice, rounds),
      'Do you want data from a specific round or your average stats?'
    )
  })

  it('uses the average when asked, then keeps that for a follow-up', () => {
    assert.equal(resolveSgScope('my average stats', rounds, null, today).kind, 'career')
    assert.equal(resolveSgScope('what about off the tee?', rounds, 'career', today).kind, 'career')
  })

  it('fuzzy-matches a course and a date, and keeps that round for the next question', () => {
    const choice = resolveSgScope('How did saltfrd go on 7 October?', rounds, null, today)
    assert.equal(choice.kind, 'round')
    if (choice.kind === 'round') assert.equal(choice.round.id, 'saltford-oct')
    const followUp = resolveSgScope('Should I be hitting it further on the par 5s?', rounds, 'saltford-oct', today)
    assert.equal(followUp.kind, 'round')
    if (followUp.kind === 'round') assert.equal(followUp.round.id, 'saltford-oct')
  })

  it('asks which date when the course has more than one finished round', () => {
    const choice = resolveSgScope('Tell me about Saltford', rounds, null, today)
    assert.equal(choice.kind, 'ambiguous')
    if (choice.kind === 'ambiguous') {
      assert.deepEqual(
        choice.options.map((round) => round.id),
        ['saltford-oct', 'saltford-sep']
      )
    }
  })

  it('leaves an in-progress round out even when the date matches', () => {
    const choice = resolveSgScope('Saltford today', rounds, null, today)
    assert.equal(choice.kind, 'unfinished')
  })

  it('matches a course when one word is close', () => {
    assert.ok(courseMatchScore('meadow', 'Meadow Park') >= 60)
  })
})
