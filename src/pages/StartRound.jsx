import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Button from '../components/Button'
import { useApp } from '../context/AppContext'
import { firstUnfinishedHole, latestInProgressRound, todayPlayedAt } from '../golf/roundPlay'

const fieldClass =
  'w-full min-h-[52px] rounded-xl border-2 border-gray-200 bg-white px-4 text-base text-dark-green focus:border-dark-green focus:outline-none'

export default function StartRound() {
  const navigate = useNavigate()
  const { courses = [], rounds = [], createRound } = useApp()
  const inProgress = latestInProgressRound(rounds)
  const savedCourses = courses.filter((course) => !course.deletedAt)
  const [courseId, setCourseId] = useState(savedCourses[0]?.id ?? '')
  const [playedAt, setPlayedAt] = useState(todayPlayedAt)
  const [nineHoles, setNineHoles] = useState(false)
  const [error, setError] = useState('')

  const start = () => {
    setError('')
    if (!courseId) {
      setError('Choose a course.')
      return
    }
    if (!playedAt) {
      setError('Choose a date.')
      return
    }
    try {
      const round = createRound({ courseId, playedAt, nineHoles })
      navigate(`/rounds/${round.id}/holes/1`)
    } catch (err) {
      setError(err?.message || 'Could not start the round.')
    }
  }

  return (
    <>
      <Header title="Round" subtitle="Resume a round or start a new one" />
      <div className="flex flex-1 flex-col px-4 py-6">
        {inProgress && (
          <Button
            fullWidth
            className="mb-3"
            onClick={() =>
              navigate(`/rounds/${inProgress.id}/holes/${firstUnfinishedHole(inProgress)}`)
            }
          >
            Resume round
          </Button>
        )}
        <Button
          fullWidth
          variant="secondary"
          className="mb-5"
          onClick={() => navigate('/rounds')}
        >
          My rounds
        </Button>
        {savedCourses.length === 0 ? (
          <div className="flex flex-1 flex-col">
            <p className="mb-4 text-sm text-gray-600">
              Save a course before you start a round.
            </p>
            <Button fullWidth onClick={() => navigate('/courses')}>
              Go to courses
            </Button>
          </div>
        ) : (
          <>
            <p className="mb-2 text-sm font-semibold text-dark-green">Start round</p>
            <p className="mb-2 text-sm font-semibold text-dark-green">Course</p>
            <div className="mb-5 flex flex-col gap-2" role="listbox" aria-label="Saved courses">
              {savedCourses.map((course) => {
                const selected = course.id === courseId
                return (
                  <button
                    key={course.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => setCourseId(course.id)}
                    className={[
                      'min-h-[64px] rounded-xl px-4 py-3 text-left',
                      selected
                        ? 'bg-dark-green text-white'
                        : 'bg-light-grey text-dark-green',
                    ].join(' ')}
                  >
                    <span className="block text-base font-semibold">{course.name}</span>
                    <span className={selected ? 'text-sm text-white/80' : 'text-sm text-gray-600'}>
                      {course.teeName ? `${course.teeName} · ` : ''}
                      {Number(course.courseRating).toFixed(1)} / {course.slopeRating}
                    </span>
                  </button>
                )
              })}
            </div>

            <label htmlFor="round-date" className="mb-2 block text-sm font-semibold text-dark-green">
              Date
            </label>
            <input
              id="round-date"
              type="date"
              value={playedAt}
              onChange={(event) => setPlayedAt(event.target.value)}
              className={`mb-5 ${fieldClass}`}
            />

            <label className="mb-6 flex min-h-[52px] cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={nineHoles}
                onChange={(event) => setNineHoles(event.target.checked)}
                className="h-6 w-6 accent-dark-green"
              />
              <span className="text-base font-medium text-dark-green">9 holes only</span>
            </label>

            {error && (
              <p className="mb-3 text-sm font-medium text-danger" role="alert">
                {error}
              </p>
            )}
            <Button fullWidth size="lg" onClick={start}>
              Start hole 1
            </Button>
          </>
        )}
      </div>
    </>
  )
}
