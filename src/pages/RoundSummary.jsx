import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import Button from '../components/Button'
import { useApp } from '../context/AppContext'
import { holesInPlay } from '../golf/roundPlay'
import { buildRoundStats } from '../golf/roundStats.ts'
import { DEFAULT_REFERENCE_HANDICAP, DEFAULT_SG_MODE } from '../golf/schema.js'
import {
  formatDifferential,
  formatDrive,
  formatPlayedAt,
  formatRatio,
  formatSg,
  formatToPar,
} from '../golf/roundFormat.js'

const CATEGORY_ROWS = [
  ['OTT', 'Off the tee'],
  ['APP', 'Approach'],
  ['ARG', 'Around the green'],
  ['PUTT', 'Putting'],
]

const KIND_CLASS = {
  eagle: 'bg-gold font-bold text-dark-green',
  birdie: 'bg-[#b42318] font-bold text-white',
  par: 'font-semibold text-dark-green',
  bogey: 'font-semibold text-dark-green ring-1 ring-dark-green',
  double: 'bg-dark-green font-bold text-white',
}

function cell(value) {
  return value == null ? '—' : value
}

function formatExtra(value) {
  if (value > 0) return `+${value}`
  if (value < 0) return `−${Math.abs(value)}`
  return '0'
}

function ScoreTable({ holes, sideLabel, side }) {
  if (holes.length === 0) return null
  const columns = holes.map((hole) => ({
    key: hole.holeNumber,
    head: hole.holeNumber,
    par: hole.par,
    yards: hole.yards,
    score: hole.score,
    kind: hole.kind,
    putts: hole.putts,
    penalties: hole.penalties,
    sg: formatSg(hole.adjustedSg),
  }))
  columns.push({
    key: sideLabel,
    head: sideLabel,
    par: side.par,
    yards: side.yards,
    score: side.score,
    kind: null,
    putts: side.putts,
    penalties: side.penalties,
    sg: formatSg(side.adjustedSg),
    total: true,
  })

  const rows = [
    ['Par', (column) => column.par],
    ['Yards', (column) => column.yards],
    ['Score', (column) => column.score],
    ['Putts', (column) => column.putts],
    ['Pen', (column) => column.penalties],
    ['SG', (column) => column.sg],
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-center text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-off-white px-1 text-left font-semibold text-gray-500" />
            {columns.map((column) => (
              <th
                key={column.key}
                className={[
                  'min-w-8 px-1 font-semibold',
                  column.total ? 'text-dark-green' : 'text-gray-500',
                ].join(' ')}
              >
                {column.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th className="sticky left-0 bg-off-white pr-2 text-left font-semibold text-dark-green">
                {label}
              </th>
              {columns.map((column) => {
                const shown = value(column)
                const scoreCell = label === 'Score' && column.kind
                return (
                  <td key={column.key} className="px-0.5 py-0.5">
                    <span
                      className={[
                        'inline-flex min-h-7 min-w-7 items-center justify-center rounded-md px-1',
                        scoreCell ? KIND_CLASS[column.kind] : column.total ? 'font-bold text-dark-green' : 'text-dark-green',
                      ].join(' ')}
                    >
                      {cell(shown)}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatLine({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-gray-200 py-2 last:border-0">
      <dt className="text-sm text-gray-600">{label}</dt>
      <dd className="text-sm font-semibold text-dark-green">{value}</dd>
    </div>
  )
}

export default function RoundSummary() {
  const navigate = useNavigate()
  const { roundId } = useParams()
  const { rounds = [], courses = [], golfShots = [], profile } = useApp()
  const round = rounds.find((item) => item.id === roundId)

  if (!round) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-sm text-gray-600">That round is not on this account.</p>
        <Button onClick={() => navigate('/rounds')}>My rounds</Button>
      </div>
    )
  }

  const course = courses.find((item) => item.id === round.courseId)
  const holes = holesInPlay(round)
  const shots = golfShots.filter((shot) => shot.roundId === round.id)
  const stats = buildRoundStats({
    holes,
    shots,
    courseRating: round.courseRating,
    slopeRating: round.slopeRating,
    nineHoles: round.nineHoles,
    handicapScoreOverride: round.handicapScoreOverride,
    referenceHandicap: profile.referenceHandicap ?? DEFAULT_REFERENCE_HANDICAP,
    sgMode: profile.sgMode ?? DEFAULT_SG_MODE,
  })
  const lastHole = holes.at(-1)?.holeNumber ?? 1
  const front = stats.holes.filter((hole) => hole.holeNumber <= 9)
  const back = stats.holes.filter((hole) => hole.holeNumber > 9)

  return (
    <>
      <Header
        title="Round summary"
        subtitle={
          course
            ? `${course.name} · ${formatPlayedAt(round.playedAt)}`
            : formatPlayedAt(round.playedAt)
        }
        showBack
        backTo={`/rounds/${round.id}/holes/${lastHole}`}
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <section className="rounded-2xl bg-dark-green px-4 py-4 text-white">
          <p className="text-sm text-white/75">
            {round.status === 'complete' ? 'Finished' : 'In progress'}
          </p>
          <p className="mt-1 text-4xl font-bold">{stats.score}</p>
          <p className="mt-1 text-sm text-white/85">
            {formatToPar(stats.scoreToPar)} · differential {formatDifferential(stats.differential)}
          </p>
          {stats.handicapScore !== stats.score && (
            <p className="mt-1 text-xs text-white/75">Handicap score {stats.handicapScore}</p>
          )}
        </section>

        <section className="rounded-2xl bg-light-grey p-3" aria-label="Scorecard">
          <h2 className="px-1 text-sm font-semibold text-dark-green">Scorecard</h2>
          <ScoreTable holes={front} sideLabel="Out" side={stats.out} />
          <ScoreTable holes={back} sideLabel="In" side={stats.in} />
          <div className="mt-2 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
            <span className="font-semibold text-dark-green">Total</span>
            <span className="font-bold text-dark-green">
              {cell(stats.total.score)} · {formatToPar(stats.scoreToPar)} · {formatSg(stats.sgTotal)} SG
            </span>
          </div>
          <p className="mt-2 flex flex-wrap gap-2 px-1 text-[11px] text-gray-600">
            <span className="rounded bg-gold px-1.5 py-0.5 text-dark-green">Eagle</span>
            <span className="rounded bg-[#b42318] px-1.5 py-0.5 text-white">Birdie</span>
            <span className="rounded px-1.5 py-0.5 ring-1 ring-gray-300">Par</span>
            <span className="rounded px-1.5 py-0.5 ring-1 ring-dark-green">Bogey</span>
            <span className="rounded bg-dark-green px-1.5 py-0.5 text-white">Double+</span>
          </p>
        </section>

        <section className="rounded-2xl bg-light-grey p-3" aria-label="Strokes gained">
          <h2 className="px-1 pb-2 text-sm font-semibold text-dark-green">Strokes gained</h2>
          <div className="flex flex-col gap-2">
            {CATEGORY_ROWS.map(([category, label]) => {
              const worst = stats.worstCategory === category
              return (
                <div
                  key={category}
                  className={[
                    'rounded-xl px-3 py-2',
                    worst ? 'bg-red-50 ring-1 ring-danger/40' : 'bg-white',
                  ].join(' ')}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-dark-green">
                      {category}{' '}
                      <span className="font-medium text-gray-500">{label}</span>
                    </p>
                    <p className="text-lg font-bold text-dark-green">
                      {formatSg(stats.adjustedByCategory[category])}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">Raw {formatSg(stats.rawByCategory[category])}</p>
                  {worst && (
                    <p className="mt-1 text-xs font-medium text-danger">
                      of which penalties: {formatSg(stats.penaltySgByCategory[category])}
                    </p>
                  )}
                </div>
              )
            })}
            <div className="rounded-xl bg-dark-green px-3 py-2 text-white">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold">TOTAL</p>
                <p className="text-lg font-bold">{formatSg(stats.sgTotal)}</p>
              </div>
              <p className="text-xs text-white/75">Raw {formatSg(stats.rawTotal)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-light-grey px-4 py-2" aria-label="Traditional stats">
          <h2 className="py-2 text-sm font-semibold text-dark-green">Traditional stats</h2>
          <dl>
            <StatLine label="Fairways" value={formatRatio(stats.fairways.hit, stats.fairways.chances)} />
            <StatLine label="Greens" value={formatRatio(stats.greens.hit, stats.greens.chances)} />
            <StatLine label="Putts" value={String(stats.putts)} />
            <StatLine
              label="Scrambling"
              value={formatRatio(stats.scrambling.success, stats.scrambling.chances)}
            />
            <StatLine label="Extra shots onto green" value={formatExtra(stats.extraOntoGreen)} />
            <StatLine label="Extra shots near green" value={formatExtra(stats.extraNearGreen)} />
            <StatLine label="Penalty strokes" value={String(stats.penaltyStrokes)} />
            <StatLine label="Driving distance" value={formatDrive(stats.drivingDistance)} />
            <StatLine label="Eagles" value={String(stats.eagles)} />
            <StatLine label="Birdies" value={String(stats.birdies)} />
            <StatLine label="Pars" value={String(stats.pars)} />
            <StatLine label="Bogeys" value={String(stats.bogeys)} />
            <StatLine label="Doubles+" value={String(stats.doubles)} />
            <StatLine label="Score" value={String(stats.score)} />
            <StatLine label="Score to par" value={formatToPar(stats.scoreToPar)} />
            <StatLine label="Differential" value={formatDifferential(stats.differential)} />
          </dl>
        </section>

        <Button fullWidth variant="secondary" onClick={() => navigate('/rounds')}>
          My rounds
        </Button>
      </div>
    </>
  )
}
