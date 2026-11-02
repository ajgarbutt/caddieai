import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { AnalysisRoundInput } from './dashboard.ts'
import { buildSgExpertBrief } from './sgExpertBrief.ts'

function round(partial: {
  id: string
  status: 'in_progress' | 'complete'
  holes: AnalysisRoundInput['holes']
  shots: AnalysisRoundInput['shots']
}): AnalysisRoundInput {
  return {
    id: partial.id,
    playedAt: '2026-10-08',
    createdAt: '2026-10-08T00:00:00.000Z',
    courseId: 'north',
    status: partial.status,
    includeInAnalysis: true,
    courseRating: 72,
    slopeRating: 113,
    holes: partial.holes,
    shots: partial.shots,
  }
}

describe('buildSgExpertBrief', () => {
  it('explains finished rounds only, with putt distance and par-5 yards left', () => {
    const brief = buildSgExpertBrief(
      [
        round({
          id: 'open',
          status: 'in_progress',
          holes: [{ holeNumber: 1, par: 4, yards: 400, holedOut: true }],
          shots: [
            { holeNumber: 1, seq: 1, type: 'TEE', distance: 400, penaltyStrokes: 0 },
            { holeNumber: 1, seq: 2, type: 'PUTTS', distance: 8, penaltyStrokes: 0 },
            { holeNumber: 1, seq: 3, type: 'PUTTS', distance: 2, penaltyStrokes: 0 },
          ],
        }),
        round({
          id: 'done',
          status: 'complete',
          holes: [
            { holeNumber: 1, par: 4, yards: 400, holedOut: true },
            { holeNumber: 2, par: 5, yards: 500, holedOut: true },
          ],
          shots: [
            { holeNumber: 1, seq: 1, type: 'TEE', distance: 400, penaltyStrokes: 0 },
            { holeNumber: 1, seq: 2, type: 'FAIRWAY', distance: 150, penaltyStrokes: 0 },
            { holeNumber: 1, seq: 3, type: 'PUTTS', distance: 20, penaltyStrokes: 0 },
            { holeNumber: 1, seq: 4, type: 'PUTTS', distance: 4, penaltyStrokes: 0 },
            { holeNumber: 2, seq: 1, type: 'TEE', distance: 500, penaltyStrokes: 0 },
            { holeNumber: 2, seq: 2, type: 'FAIRWAY', distance: 280, penaltyStrokes: 0 },
            { holeNumber: 2, seq: 3, type: 'FAIRWAY', distance: 40, penaltyStrokes: 0 },
            { holeNumber: 2, seq: 4, type: 'PUTTS', distance: 30, penaltyStrokes: 0 },
            { holeNumber: 2, seq: 5, type: 'PUTTS', distance: 8, penaltyStrokes: 0 },
            { holeNumber: 2, seq: 6, type: 'PUTTS', distance: 2, penaltyStrokes: 0 },
          ],
        }),
      ],
      { referenceHandicap: 24, sgMode: 'handicap' }
    )

    assert.equal(brief.roundCount, 1)
    assert.match(brief.text, /Scope: average across 1 finished round/)
    assert.match(brief.text, /compared with a 24 handicap/)
    assert.match(brief.text, /Putts: 5/)
    assert.match(brief.text, /Holes with 3 or more putts: 1 per round/)
    assert.match(brief.text, /Par 5 tee shots travelled: 220 yards/)
    assert.match(brief.text, /Par 5 yards left for the next shot: 280 yards/)
    assert.doesNotMatch(brief.text, /Putts: 7/)
    assert.match(brief.text, /Scope: average across 1 finished round/)
  })

  it('limits the brief to the named round', () => {
    const inputs = [
      round({
        id: 'done',
        status: 'complete',
        holes: [{ holeNumber: 1, par: 4, yards: 400, holedOut: true }],
        shots: [
          { holeNumber: 1, seq: 1, type: 'TEE', distance: 400, penaltyStrokes: 0 },
          { holeNumber: 1, seq: 2, type: 'PUTTS', distance: 12, penaltyStrokes: 0 },
        ],
      }),
      round({
        id: 'other',
        status: 'complete',
        holes: [{ holeNumber: 1, par: 4, yards: 380, holedOut: true }],
        shots: [
          { holeNumber: 1, seq: 1, type: 'TEE', distance: 380, penaltyStrokes: 0 },
          { holeNumber: 1, seq: 2, type: 'PUTTS', distance: 20, penaltyStrokes: 0 },
          { holeNumber: 1, seq: 3, type: 'PUTTS', distance: 4, penaltyStrokes: 0 },
        ],
      }),
    ]
    const brief = buildSgExpertBrief(inputs, { referenceHandicap: 18, sgMode: 'raw' }, {
      kind: 'round',
      roundId: 'done',
      label: 'Saltford on 7 Oct 2026',
    })
    assert.equal(brief.roundCount, 1)
    assert.match(brief.text, /Scope: one round, Saltford on 7 Oct 2026/)
    assert.match(brief.text, /Putts: 1\n/)
  })
})
