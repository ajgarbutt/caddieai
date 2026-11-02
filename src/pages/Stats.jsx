import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Header from '../components/Header'
import Card from '../components/Card'
import { useApp } from '../context/AppContext'
import { holesInPlay } from '../golf/roundPlay'
import {
  buildDashboard,
  heatColor,
  peakMagnitude,
  trendSeries,
} from '../golf/dashboard.ts'
import { DEFAULT_REFERENCE_HANDICAP, DEFAULT_SG_MODE } from '../golf/schema.js'
import {
  EXTRA_NEAR_GREEN_HINT,
  EXTRA_ONTO_GREEN_HINT,
  formatDifferential,
  formatDrive,
  formatPlayedAt,
  formatReferenceHandicap,
  formatSg,
} from '../golf/roundFormat.js'

const WINDOWS = [
  ['career', 'Career'],
  ['season', 'This season'],
  ['last', 'Last'],
]

const YARD_VIEWS = [
  ['sgPerRound', 'SG / round'],
  ['shotsPerRound', 'Shots / round'],
  ['sgPerShot', 'SG / shot'],
]

const TRENDS = [
  ['sgTotal', 'Strokes gained'],
  ['OTT', 'Off the tee'],
  ['APP', 'Approach'],
  ['ARG', 'Around the green'],
  ['PUTT', 'Putting'],
  ['score', 'Score'],
  ['scoreToPar', 'Score to par'],
  ['putts', 'Putts'],
  ['penalties', 'Penalty strokes'],
  ['differential', 'Differential'],
  ['fairways', 'Fairways hit'],
  ['greens', 'Greens in regulation'],
  ['driving', 'Driving distance'],
]

function formatCount(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function formatRate(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value * 100)}%`
}

function formatSigned(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10
  if (rounded === 0) return '0'
  const text = Number.isInteger(rounded) ? String(Math.abs(rounded)) : Math.abs(rounded).toFixed(1)
  return rounded > 0 ? `+${text}` : `−${text}`
}

function handicapPhrase(text) {
  const article = /^(8|11|18)/.test(text) ? 'an' : 'a'
  return `${article} ${text} handicap`
}

function cellText(cell, view) {
  if (!cell || cell[view] == null) return '—'
  if (view === 'shotsPerRound') return formatCount(cell[view])
  return formatSg(cell[view])
}

function colourValue(cell, view) {
  if (!cell) return null
  if (view === 'shotsPerRound') return cell.sgPerRound
  return cell[view]
}

function TrendChart({ points, formatValue }) {
  const width = 320
  const height = 148
  const pad = 18
  const numbers = points.flatMap((point) =>
    [point.value, point.average].filter((value) => value != null)
  )
  if (numbers.length === 0) {
    return <p className="text-sm text-gray-600">No values in this window.</p>
  }
  const low = Math.min(...numbers)
  const high = Math.max(...numbers)
  const span = high - low || 1
  const xAt = (index) => {
    if (points.length <= 1) return width / 2
    return pad + (index / (points.length - 1)) * (width - pad * 2)
  }
  const yAt = (value) => pad + (1 - (value - low) / span) * (height - pad * 2)
  const pathFor = (key) => {
    let started = false
    const parts = []
    points.forEach((point, index) => {
      if (point[key] == null) {
        started = false
        return
      }
      parts.push(`${started ? 'L' : 'M'}${xAt(index)} ${yAt(point[key])}`)
      started = true
    })
    return parts.join(' ')
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="Trend">
      <text x={pad} y={12} fill="#6b7280" fontSize="10">
        {formatValue(high)}
      </text>
      <text x={pad} y={height - 4} fill="#6b7280" fontSize="10">
        {formatValue(low)}
      </text>
      <path d={pathFor('value')} fill="none" stroke="#1a3a2a" strokeWidth="2" />
      <path d={pathFor('average')} fill="none" stroke="#c9a84c" strokeWidth="2" strokeDasharray="4 3" />
      {points.map((point, index) =>
        point.value == null ? null : (
          <circle key={point.playedAt + index} cx={xAt(index)} cy={yAt(point.value)} r="3" fill="#1a3a2a" />
        )
      )}
    </svg>
  )
}

export default function Stats() {
  const { rounds = [], courses = [], golfShots = [], profile } = useApp()
  const [params] = useSearchParams()
  const seedRequested = import.meta.env.DEV && params.get('seed') === '1'
  const [seedPack, setSeedPack] = useState(null)
  const referenceHandicap = seedPack
    ? seedPack.referenceHandicap
    : (profile.referenceHandicap ?? DEFAULT_REFERENCE_HANDICAP)
  const sgMode = seedPack ? 'handicap' : (profile.sgMode ?? DEFAULT_SG_MODE)
  const sourceRounds = seedPack ? seedPack.rounds : rounds
  const sourceShots = seedPack ? seedPack.shots : golfShots
  const sourceCourses = seedPack
    ? [{ id: seedPack.course.id, name: seedPack.course.name, deletedAt: null }]
    : courses

  const [window, setWindow] = useState('career')
  const [lastN, setLastN] = useState(5)
  const [courseId, setCourseId] = useState('')
  const [yardView, setYardView] = useState('sgPerRound')
  const [trendKey, setTrendKey] = useState('sgTotal')
  const [runningOn, setRunningOn] = useState(false)
  const [runningN, setRunningN] = useState(5)

  useEffect(() => {
    if (!seedRequested) return undefined
    let cancelled = false
    import('../golf/seedRounds.ts').then((mod) => {
      if (cancelled) return
      const data = mod.buildSeed()
      setSeedPack({ ...data, referenceHandicap: mod.SEED_REFERENCE_HANDICAP })
      setCourseId(data.course.id)
    })
    return () => {
      cancelled = true
    }
  }, [seedRequested])

  const view = useMemo(() => {
    const inputs = sourceRounds.map((round) => ({
      id: round.id,
      playedAt: round.playedAt,
      createdAt: round.createdAt,
      courseId: round.courseId,
      status: round.status === 'complete' ? 'complete' : 'in_progress',
      includeInAnalysis: round.includeInAnalysis !== false,
      nineHoles: round.nineHoles,
      courseRating: round.courseRating,
      slopeRating: round.slopeRating,
      handicapScoreOverride: round.handicapScoreOverride,
      holes: holesInPlay(round),
      shots: sourceShots.filter((shot) => shot.roundId === round.id),
    }))
    return buildDashboard(inputs, {
      window,
      lastN: Number(lastN) || 1,
      seasonYear: new Date().getFullYear(),
      courseId: courseId || null,
      referenceHandicap,
      sgMode,
    })
  }, [sourceRounds, sourceShots, window, lastN, courseId, referenceHandicap, sgMode])

  const trend = trendSeries(view.rounds, trendKey, runningOn ? Number(runningN) || 1 : null)
  const referenceText = formatReferenceHandicap(referenceHandicap)
  const versus =
    sgMode === 'raw' ? 'vs PGA Tour' : `vs ${handicapPhrase(referenceText)}`
  const yardPeak = peakMagnitude(view.yardCells.flat().map((cell) => colourValue(cell, yardView)))
  const puttPeak = peakMagnitude(view.puttCells.map((cell) => colourValue(cell, yardView)))
  const activeCourses = sourceCourses.filter((course) => !course.deletedAt)

  const averages = view.averages
  const statRows = averages
    ? [
        ['Score', formatCount(averages.score)],
        ['To par', formatSigned(averages.scoreToPar)],
        ['Differential', formatDifferential(averages.differential)],
        ['Strokes gained', formatSg(averages.sgTotal)],
        ['Fairways', `${formatCount(averages.fairwayHits)} / ${formatCount(averages.fairwayChances)}`],
        ['Greens', `${formatCount(averages.greenHits)} / ${formatCount(averages.greenChances)}`],
        ['Putts', formatCount(averages.putts)],
        [
          'Scrambling',
          `${formatCount(averages.scrambleSuccess)} / ${formatCount(averages.scrambleChances)}`,
        ],
        ['Extra onto the green', formatSigned(averages.extraOntoGreen), EXTRA_ONTO_GREEN_HINT],
        ['Extra near the green', formatSigned(averages.extraNearGreen), EXTRA_NEAR_GREEN_HINT],
        ['Penalty strokes', formatCount(averages.penaltyStrokes)],
        ['Driving distance', formatDrive(averages.drivingDistance)],
        ['Eagles or better', formatCount(averages.eagles)],
        ['Birdies', formatCount(averages.birdies)],
        ['Pars', formatCount(averages.pars)],
        ['Bogeys', formatCount(averages.bogeys)],
        ['Doubles or worse', formatCount(averages.doubles)],
      ]
    : []

  const trendFormat =
    trendKey === 'fairways' || trendKey === 'greens'
      ? formatRate
      : trendKey === 'score' || trendKey === 'putts' || trendKey === 'penalties' || trendKey === 'driving'
        ? formatCount
        : trendKey === 'scoreToPar'
          ? formatSigned
          : trendKey === 'differential'
            ? formatDifferential
            : formatSg

  if (seedRequested && !seedPack) {
    return (
      <>
        <Header title="Stats" subtitle="Sample rounds" />
        <p className="px-4 py-4 text-sm text-gray-600">Loading sample rounds…</p>
      </>
    )
  }

  return (
    <>
      <Header title="Stats" subtitle="Where am I losing strokes?" />
      <div className="flex flex-col gap-4 px-4 py-4">
        {seedPack && (
          <p className="rounded-xl bg-gold/20 px-3 py-2 text-sm text-dark-green">
            Sample rounds at Meadow Park, compared with a 28 handicap. Nothing here is saved to your account.
          </p>
        )}
        <div className="grid grid-cols-3 gap-2">
          {WINDOWS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setWindow(id)}
              className={[
                'min-h-11 rounded-xl px-3 text-sm font-semibold',
                window === id ? 'bg-dark-green text-white' : 'bg-light-grey text-dark-green',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {window === 'last' && (
          <label className="flex items-center justify-between gap-3 text-sm font-medium text-dark-green">
            Last rounds
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={lastN}
              onChange={(event) => setLastN(event.target.value)}
              className="h-11 w-20 rounded-xl border border-gray-200 bg-white px-3 text-base text-dark-green"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium text-dark-green">
          Course
          <select
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-base"
          >
            <option value="">All courses</option>
            {activeCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>

        {view.roundCount === 0 ? (
          <p className="text-sm text-gray-600">No finished rounds in this window.</p>
        ) : (
          <>
            {view.headline && (
              <Card>
                <p className="text-lg font-bold leading-snug text-dark-green">
                  {view.headline.negative
                    ? `Your biggest leak: ${view.headline.label}`
                    : view.headline.perRound > 0
                      ? `Your smallest gain: ${view.headline.label}`
                      : `Level: ${view.headline.label}`}{' '}
                  — {formatSg(view.headline.perRound)} strokes per round {versus}
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  {sgMode === 'raw'
                    ? 'Compared with the PGA Tour baseline.'
                    : `Reference handicap ${referenceText}.`}{' '}
                  <Link to="/profile" className="font-semibold text-dark-green underline">
                    Change
                  </Link>
                </p>
              </Card>
            )}

            <section>
              <h2 className="mb-2 text-sm font-semibold text-dark-green">Strokes gained by category</h2>
              <div className="flex flex-col gap-3">
                {view.bars.map((bar) => (
                  <div key={bar.category}>
                    <div className="mb-1 flex items-center justify-between text-sm text-dark-green">
                      <span className={bar.worst ? 'font-bold' : 'font-medium'}>{bar.label}</span>
                    </div>
                    <div
                      className={[
                        'relative h-8 overflow-hidden rounded-lg bg-white',
                        bar.worst ? 'ring-2 ring-gold' : '',
                      ].join(' ')}
                    >
                      <div
                        className={[
                          'absolute inset-y-0 left-0 rounded-lg',
                          bar.perRound < 0 ? 'bg-danger' : 'bg-[#167846]',
                        ].join(' ')}
                        style={{ width: `${bar.width * 100}%` }}
                      />
                      <span
                        className={[
                          'absolute inset-y-0 flex items-center px-2 text-sm font-semibold',
                          bar.width > 0.45 ? 'text-white' : 'text-dark-green',
                        ].join(' ')}
                        style={{ left: bar.width > 0.45 ? 0 : `${bar.width * 100}%` }}
                      >
                        {formatSg(bar.perRound)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-600">
                      includes {formatSg(bar.penaltyPerRound)} from penalties
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-semibold text-dark-green">Per round</h2>
              <Card padding="sm">
                <dl className="divide-y divide-gray-200">
                  {statRows.map(([label, value, hint]) => (
                    <div key={label} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <dt className="min-w-0 text-gray-600">
                        <span className="block">{label}</span>
                        {hint ? (
                          <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">{hint}</span>
                        ) : null}
                      </dt>
                      <dd className="shrink-0 font-semibold text-dark-green">{value}</dd>
                    </div>
                  ))}
                  {averages?.handicapIndex != null && (
                    <div className="flex items-center justify-between gap-3 py-2 text-sm">
                      <dt className="text-gray-600">Handicap Index</dt>
                      <dd className="font-semibold text-dark-green">
                        {formatDifferential(averages.handicapIndex)}
                      </dd>
                    </div>
                  )}
                </dl>
              </Card>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-dark-green">By distance and lie</h2>
              </div>
              <div className="mb-2 grid grid-cols-3 gap-1">
                {YARD_VIEWS.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setYardView(id)}
                    className={[
                      'min-h-11 rounded-lg px-1 text-xs font-semibold',
                      yardView === id ? 'bg-dark-green text-white' : 'bg-light-grey text-dark-green',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-max border-separate border-spacing-1 text-center text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-off-white px-2 text-left font-semibold text-gray-500" />
                      {view.yardLies.map((lie) => (
                        <th key={lie.key} className="px-2 font-semibold text-gray-500">
                          {lie.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {view.yardBins.map((bin, row) => (
                      <tr key={bin.label}>
                        <th className="sticky left-0 bg-off-white pr-2 text-left font-semibold text-dark-green">
                          {bin.label}
                        </th>
                        {view.yardCells[row].map((cell, column) => (
                          <td
                            key={view.yardLies[column].key}
                            className="min-w-16 rounded-md px-2 py-2 text-dark-green"
                            style={{ backgroundColor: heatColor(colourValue(cell, yardView), yardPeak) }}
                          >
                            {cellText(cell, yardView)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-semibold text-dark-green">Putts</h2>
              <div className="overflow-x-auto">
                <table className="min-w-max border-separate border-spacing-1 text-center text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-off-white px-2 text-left font-semibold text-gray-500" />
                      <th className="px-2 font-semibold text-gray-500">
                        {YARD_VIEWS.find(([id]) => id === yardView)?.[1]}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.puttBins.map((bin, index) => (
                      <tr key={bin.label}>
                        <th className="sticky left-0 bg-off-white pr-2 text-left font-semibold text-dark-green">
                          {bin.label}
                        </th>
                        <td
                          className="min-w-20 rounded-md px-2 py-2 text-dark-green"
                          style={{
                            backgroundColor: heatColor(
                              colourValue(view.puttCells[index], yardView),
                              puttPeak
                            ),
                          }}
                        >
                          {cellText(view.puttCells[index], yardView)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-xs text-gray-600">Putts under 3 ft are left out.</p>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-semibold text-dark-green">Trend</h2>
              <label className="mb-2 flex flex-col gap-1 text-sm font-medium text-dark-green">
                Stat
                <select
                  value={trendKey}
                  onChange={(event) => setTrendKey(event.target.value)}
                  className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-base"
                >
                  {TRENDS.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mb-2 flex min-h-11 items-center justify-between gap-3 text-sm font-medium text-dark-green">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={runningOn}
                    onChange={(event) => setRunningOn(event.target.checked)}
                    className="h-5 w-5 accent-dark-green"
                  />
                  Running average
                </span>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={runningN}
                  disabled={!runningOn}
                  onChange={(event) => setRunningN(event.target.value)}
                  className="h-11 w-20 rounded-xl border border-gray-200 bg-white px-3 text-base disabled:opacity-50"
                />
              </label>
              <TrendChart points={trend} formatValue={trendFormat} />
              <div className="mt-1 flex justify-between text-xs text-gray-500">
                <span>{trend[0] ? formatPlayedAt(trend[0].playedAt) : ''}</span>
                <span>{trend.length > 1 ? formatPlayedAt(trend[trend.length - 1].playedAt) : ''}</span>
              </div>
            </section>

            {courseId && (
              <section>
                <h2 className="mb-2 text-sm font-semibold text-dark-green">Hole by hole</h2>
                {view.holes?.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-max border-separate border-spacing-1 text-center text-xs">
                      <thead>
                        <tr>
                          <th className="sticky left-0 bg-off-white px-2 text-left font-semibold text-gray-500" />
                          {view.holes.map((hole) => (
                            <th key={hole.holeNumber} className="min-w-10 px-1 font-semibold text-gray-500">
                              {hole.holeNumber}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th className="sticky left-0 bg-off-white pr-2 text-left font-semibold text-dark-green">
                            Score
                          </th>
                          {view.holes.map((hole) => (
                            <td key={hole.holeNumber} className="px-1 py-2 text-dark-green">
                              {formatCount(hole.score)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <th className="sticky left-0 bg-off-white pr-2 text-left font-semibold text-dark-green">
                            SG
                          </th>
                          {view.holes.map((hole) => (
                            <td key={hole.holeNumber} className="px-1 py-2 text-dark-green">
                              {formatSg(hole.adjustedSg)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No scored holes at this course in the window.</p>
                )}
              </section>
            )}

            {view.practice && view.headline?.negative && (
              <Card>
                <h2 className="mb-1 text-sm font-semibold text-dark-green">Practice focus</h2>
                <p className="text-sm leading-relaxed text-dark-green">{view.practice}</p>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  )
}
