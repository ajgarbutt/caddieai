import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import Header from '../components/Header'
import Button from '../components/Button'
import Modal from '../components/Modal'
import { useApp } from '../context/AppContext'
import { holesInPlay } from '../golf/roundPlay'
import { buildRoundStats } from '../golf/roundStats.ts'
import { DEFAULT_REFERENCE_HANDICAP, DEFAULT_SG_MODE } from '../golf/schema.js'
import { formatDifferential, formatPlayedAt, formatSg } from '../golf/roundFormat.js'

export default function RoundsList() {
  const navigate = useNavigate()
  const { rounds = [], courses = [], golfShots = [], profile, updateRound, deleteRound } = useApp()
  const [pendingDelete, setPendingDelete] = useState(null)
  const referenceHandicap = profile.referenceHandicap ?? DEFAULT_REFERENCE_HANDICAP
  const sgMode = profile.sgMode ?? DEFAULT_SG_MODE

  const rows = useMemo(() => {
    return [...rounds]
      .sort(
        (a, b) => b.playedAt.localeCompare(a.playedAt) || b.createdAt.localeCompare(a.createdAt)
      )
      .map((round) => {
        const course = courses.find((item) => item.id === round.courseId)
        const stats = buildRoundStats({
          holes: holesInPlay(round),
          shots: golfShots.filter((shot) => shot.roundId === round.id),
          courseRating: round.courseRating,
          slopeRating: round.slopeRating,
          nineHoles: round.nineHoles,
          handicapScoreOverride: round.handicapScoreOverride,
          referenceHandicap,
          sgMode,
        })
        return { round, course, stats }
      })
  }, [rounds, courses, golfShots, referenceHandicap, sgMode])

  return (
    <>
      <Header title="My rounds" subtitle="Scores and strokes gained" showBack backTo="/rounds/new" />
      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <Button fullWidth variant="outline" onClick={() => navigate('/stats')}>
          Where am I losing strokes?
        </Button>
        {rows.length === 0 ? (
          <div className="flex flex-1 flex-col">
            <p className="mb-4 text-sm text-gray-600">You have not saved a round yet.</p>
            <Button fullWidth onClick={() => navigate('/rounds/new')}>
              Start a round
            </Button>
          </div>
        ) : (
          rows.map(({ round, course, stats }) => (
            <article key={round.id} className="rounded-2xl bg-light-grey p-4">
              <button
                type="button"
                onClick={() => navigate(`/rounds/${round.id}/summary`)}
                className="w-full text-left"
              >
                <p className="text-sm text-gray-600">{formatPlayedAt(round.playedAt)}</p>
                <p className="text-base font-semibold text-dark-green">
                  {course?.name ?? 'Course'}
                </p>
                <p className="mt-1 text-sm text-dark-green">
                  <span className="text-lg font-bold">{stats.score}</span>
                  <span className="mx-2 text-gray-400">·</span>
                  {formatDifferential(stats.differential)}
                  <span className="mx-2 text-gray-400">·</span>
                  SG {formatSg(stats.sgTotal)}
                </p>
              </button>
              <div className="mt-3 flex items-center justify-between gap-3">
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={round.includeInAnalysis !== false}
                    onChange={(event) =>
                      updateRound(round.id, { includeInAnalysis: event.target.checked })
                    }
                    className="h-6 w-6 accent-dark-green"
                  />
                  <span className="text-sm font-medium text-dark-green">Include in analysis</span>
                </label>
                <Button
                  variant="danger"
                  size="icon"
                  aria-label={`Delete ${course?.name ?? 'round'} on ${formatPlayedAt(round.playedAt)}`}
                  onClick={() => setPendingDelete({ round, course })}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </article>
          ))
        )}
      </div>

      <Modal
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete this round?"
        actions={
          <>
            <Button
              variant="danger"
              fullWidth
              onClick={() => {
                if (!pendingDelete) return
                deleteRound(pendingDelete.round.id)
                setPendingDelete(null)
              }}
            >
              Delete round
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          This removes {pendingDelete?.course?.name ?? 'this round'} and its shots. This cannot be
          undone.
        </p>
      </Modal>
    </>
  )
}
