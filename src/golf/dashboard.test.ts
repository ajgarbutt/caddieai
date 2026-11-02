import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildDashboard,
  categoryBars,
  handicapIndex,
  heatColor,
  holeAverages,
  practiceFocus,
  puttTable,
  selectRounds,
  trendSeries,
  yardTable,
  type AnalysisRound,
} from './dashboard.ts'
import type { RoundStats, StatHole, StatSgShot, StatShot } from './roundStats.ts'

function zeroCategories() {
  return { OTT: 0, APP: 0, ARG: 0, PUTT: 0 }
}

function stats(overrides: Partial<RoundStats> = {}): RoundStats {
  const categories = zeroCategories()
  return {
    holes: [
      {
        holeNumber: 1,
        par: 4,
        yards: 400,
        holedOut: true,
        score: 4,
        scoreToPar: 0,
        kind: 'par',
        putts: 0,
        penalties: 0,
        adjustedSg: 0,
        gir: true,
        fairway: true,
      },
    ],
    out: { par: 4, yards: 400, score: 4, putts: 0, penalties: 0, adjustedSg: 0 },
    in: { par: 0, yards: 0, score: null, putts: 0, penalties: 0, adjustedSg: null },
    total: { par: 4, yards: 400, score: 4, putts: 0, penalties: 0, adjustedSg: 0 },
    score: 4,
    scoreToPar: 0,
    par: 4,
    differential: 0,
    handicapScore: 4,
    fairways: { hit: 0, chances: 0 },
    greens: { hit: 0, chances: 0 },
    putts: 0,
    scrambling: { success: 0, chances: 0 },
    extraOntoGreen: 0,
    extraNearGreen: 0,
    penaltyStrokes: 0,
    drivingDistance: null,
    eagles: 0,
    birdies: 0,
    pars: 1,
    bogeys: 0,
    doubles: 0,
    adjustedByCategory: categories,
    rawByCategory: { ...categories },
    sgTotal: 0,
    rawTotal: 0,
    penaltySgByCategory: { ...categories },
    worstCategory: null,
    sgShots: [],
    ...overrides,
  }
}

function played(partial: Partial<AnalysisRound> = {}): AnalysisRound {
  return {
    id: partial.id ?? 'round',
    playedAt: partial.playedAt ?? '2026-06-01',
    createdAt: partial.createdAt ?? `${partial.playedAt ?? '2026-06-01'}T00:00:00.000Z`,
    courseId: partial.courseId ?? 'north',
    status: partial.status ?? 'complete',
    includeInAnalysis: partial.includeInAnalysis ?? true,
    stats: partial.stats ?? stats(),
  }
}

function sg(
  partial: Partial<StatSgShot> & Pick<StatSgShot, 'type' | 'distance' | 'category' | 'adjustedSG'>
): StatSgShot {
  return { holeNumber: 1, penaltySG: 0, ...partial }
}

const windowOptions = { window: 'career' as const, lastN: 5, seasonYear: 2026, courseId: null }

describe('selectRounds', () => {
  const rounds = [
    played({ id: 'old', playedAt: '2025-08-01', courseId: 'north' }),
    played({ id: 'a', playedAt: '2026-01-01', courseId: 'north', includeInAnalysis: false }),
    played({ id: 'b', playedAt: '2026-03-01', courseId: 'south' }),
    played({ id: 'c', playedAt: '2026-05-01', courseId: 'north' }),
    played({ id: 'open', playedAt: '2026-08-01', courseId: 'north', status: 'in_progress' }),
    played({
      id: 'empty',
      playedAt: '2026-07-01',
      stats: stats({
        holes: [
          {
            holeNumber: 1,
            par: 4,
            yards: 400,
            holedOut: false,
            score: null,
            scoreToPar: null,
            kind: null,
            putts: 0,
            penalties: 0,
            adjustedSg: null,
          },
        ],
        score: 0,
      }),
    }),
  ]

  it('leaves unfinished and unchecked rounds out of career, this season, the latest rounds, and one course', () => {
    assert.deepEqual(
      selectRounds(rounds, windowOptions).map((round) => round.id),
      ['c', 'b', 'old']
    )
    assert.deepEqual(
      selectRounds(rounds, { ...windowOptions, window: 'season' }).map((round) => round.id),
      ['c', 'b']
    )
    assert.deepEqual(
      selectRounds(rounds, { ...windowOptions, window: 'last', lastN: 2 }).map((round) => round.id),
      ['c', 'b']
    )
    assert.deepEqual(
      selectRounds(rounds, { ...windowOptions, window: 'last', lastN: 1, courseId: 'north' }).map(
        (round) => round.id
      ),
      ['c']
    )
  })
})

describe('handicapIndex', () => {
  it('averages the lowest 8 differentials in the most recent 20 rounds', () => {
    const recent = Array.from({ length: 20 }, (_, index) =>
      played({
        id: `r${index}`,
        playedAt: `2026-06-${String(index + 1).padStart(2, '0')}`,
        stats: stats({ differential: index + 1 }),
      })
    )
    const older = [
      played({ id: 'ancient', playedAt: '2020-01-01', stats: stats({ differential: -20 }) }),
      played({ id: 'older', playedAt: '2020-01-02', stats: stats({ differential: -20 }) }),
    ]
    assert.equal(handicapIndex(recent.slice(0, 7)), null)
    assert.equal(handicapIndex([...older, ...recent]), (1 + 2 + 3 + 4 + 5 + 6 + 7 + 8) / 8)
  })
})

describe('category and bins', () => {
  const rounds = [
    played({
      id: 'one',
      playedAt: '2026-04-01',
      stats: stats({
        score: 80,
        scoreToPar: 8,
        differential: 10,
        putts: 30,
        adjustedByCategory: { OTT: -1, APP: -4, ARG: 0.5, PUTT: -0.5 },
        penaltySgByCategory: { OTT: 0, APP: -2, ARG: 0, PUTT: 0 },
        sgShots: [
          sg({ type: 'FAIRWAY', distance: 160, category: 'APP', adjustedSG: -3 }),
          sg({ type: 'FAIRWAY', distance: 174, category: 'APP', adjustedSG: -1 }),
          sg({ type: 'FAIRWAY', distance: 9, category: 'ARG', adjustedSG: -5 }),
          sg({ type: 'ROUGH', distance: 175, category: 'APP', adjustedSG: -0.5 }),
          sg({ type: 'PUTTS', distance: 2, category: 'PUTT', adjustedSG: -1 }),
          sg({ type: 'PUTTS', distance: 3, category: 'PUTT', adjustedSG: -0.25 }),
          sg({ type: 'PUTTS', distance: 12, category: 'PUTT', adjustedSG: -0.25 }),
        ],
        holes: [
          {
            holeNumber: 1,
            par: 4,
            yards: 400,
            holedOut: true,
            score: 5,
            scoreToPar: 1,
            kind: 'bogey',
            putts: 2,
            penalties: 0,
            adjustedSg: -1,
          },
        ],
      }),
    }),
    played({
      id: 'two',
      playedAt: '2026-05-01',
      stats: stats({
        score: 90,
        scoreToPar: 18,
        differential: 18,
        putts: 36,
        adjustedByCategory: { OTT: -1, APP: -4.6, ARG: -0.5, PUTT: -0.5 },
        penaltySgByCategory: { OTT: 0, APP: 0, ARG: 0, PUTT: 0 },
        holes: [
          {
            holeNumber: 1,
            par: 4,
            yards: 400,
            holedOut: true,
            score: 6,
            scoreToPar: 2,
            kind: 'double',
            putts: 2,
            penalties: 0,
            adjustedSg: -2,
          },
        ],
      }),
    }),
  ]

  it('sorts categories worst first and averages the penalty portion', () => {
    const bars = categoryBars(rounds)
    assert.equal(bars[0].label, 'Approach')
    assert.equal(bars[0].perRound, -4.3)
    assert.equal(bars[0].penaltyPerRound, -1)
    assert.equal(bars[0].worst, true)
    assert.ok(bars[0].width >= bars[1].width)
  })

  it('bins yardages by lie and leaves shots outside the table', () => {
    const table = yardTable(rounds)
    const fairway = 1
    const rough = 2
    const total = 5
    const approach = 6
    const next = 7
    assert.equal(table.cells[approach][fairway].shotsPerRound, 1)
    assert.equal(table.cells[approach][fairway].sgPerRound, -2)
    assert.equal(table.cells[approach][fairway].sgPerShot, -2)
    assert.equal(table.cells[approach][total].shotsPerRound, 1)
    assert.equal(table.cells[next][rough].sgPerShot, -0.5)
    assert.equal(table.cells[0][fairway].sgPerRound, null)
  })

  it('leaves putts under 3 feet out of the putt bins', () => {
    const cells = puttTable(rounds)
    assert.equal(cells[0].shotsPerRound, 0.5)
    assert.equal(cells[0].sgPerShot, -0.25)
    assert.equal(cells[2].sgPerShot, -0.25)
    assert.equal(
      cells.reduce((sum, cell) => sum + (cell.shotsPerRound ?? 0), 0),
      1
    )
  })

  it('averages a hole and names the worst approach bin', () => {
    assert.equal(holeAverages(rounds)[0].score, 5.5)
    assert.equal(
      practiceFocus(rounds),
      'Most of your lost strokes are approach shots from 150–174 yds in the fairway. Practise advancing the ball to a comfortable wedge distance instead.'
    )
  })

  it('adds a running average over the last N rounds', () => {
    const series = trendSeries(rounds, 'score', 2)
    assert.deepEqual(
      series.map((point) => point.value),
      [80, 90]
    )
    assert.deepEqual(
      series.map((point) => point.average),
      [80, 85]
    )
  })
})

describe('buildDashboard', () => {
  it('places a real tee shot in the baseline yard bin', () => {
    const hole: StatHole = { holeNumber: 1, par: 4, yards: 380, holedOut: true }
    const shots: StatShot[] = [
      { holeNumber: 1, seq: 1, type: 'TEE', distance: 380, penaltyStrokes: 0 },
      { holeNumber: 1, seq: 2, type: 'FAIRWAY', distance: 160, penaltyStrokes: 0 },
      { holeNumber: 1, seq: 3, type: 'PUTTS', distance: 2, penaltyStrokes: 0 },
      { holeNumber: 1, seq: 4, type: 'PUTTS', distance: 12, penaltyStrokes: 0 },
    ]
    const view = buildDashboard(
      [
        {
          id: 'live',
          playedAt: '2026-06-01',
          createdAt: '2026-06-01T00:00:00.000Z',
          courseId: 'north',
          status: 'complete',
          includeInAnalysis: true,
          courseRating: 4,
          slopeRating: 113,
          holes: [hole],
          shots,
        },
      ],
      {
        window: 'career',
        lastN: 5,
        seasonYear: 2026,
        courseId: 'north',
        referenceHandicap: 18,
        sgMode: 'raw',
      }
    )
    const teeBin = view.yardBins.findIndex((bin) => bin.label === '300–399 yds')
    const approachBin = view.yardBins.findIndex((bin) => bin.label === '150–174 yds')
    assert.equal(view.yardCells[teeBin][0].shotsPerRound, 1)
    assert.equal(view.yardCells[approachBin][1].shotsPerRound, 1)
    assert.equal(
      view.puttCells.reduce((sum, cell) => sum + (cell.shotsPerRound ?? 0), 0),
      1
    )
    assert.equal(view.headline?.category, 'PUTT')
    assert.equal(view.holes?.[0].holeNumber, 1)
    assert.ok(heatColor(-1, 1).startsWith('rgba(220, 38, 38'))
    assert.ok(heatColor(1, 1).startsWith('rgba(22, 120, 70'))
  })
})
