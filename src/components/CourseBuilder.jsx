import { useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import Card from './Card'
import Button from './Button'
import Header from './Header'
import Modal from './Modal'
import { useApp } from '../context/AppContext'

const inputClass =
  'w-full min-h-[52px] rounded-xl border-2 border-gray-200 bg-white px-4 text-base text-dark-green placeholder:text-gray-400 focus:border-dark-green focus:outline-none'

function emptyHoles() {
  return Array.from({ length: 18 }, (_, index) => ({
    holeNumber: index + 1,
    par: 4,
    yards: '',
  }))
}

function holesForCourse(courseHoles, courseId) {
  const saved = courseHoles.filter((hole) => hole.courseId === courseId)
  return emptyHoles().map((blank) => {
    const hole = saved.find((item) => item.holeNumber === blank.holeNumber)
    return hole
      ? { holeNumber: hole.holeNumber, par: hole.par, yards: String(hole.yards), id: hole.id }
      : blank
  })
}

function sumRange(holes, key, start, end) {
  return holes.slice(start, end).reduce((total, hole) => {
    const value = Number(hole[key])
    return Number.isFinite(value) && String(hole[key]).trim() !== '' ? total + value : total
  }, 0)
}

function ratingError(value) {
  const trimmed = value.trim()
  if (trimmed === '') return 'Course rating is required.'
  if (!/^\d+(\.\d)?$/.test(trimmed)) return 'Use at most one decimal place, like 71.2.'
  const rating = Number(trimmed)
  if (rating < 50 || rating > 85) return 'Course rating must be from 50.0 to 85.0.'
  return ''
}

function slopeError(value) {
  const trimmed = value.trim()
  if (trimmed === '') return 'Slope is required.'
  if (!/^\d+$/.test(trimmed)) return 'Slope must be a whole number.'
  const slope = Number(trimmed)
  if (slope < 55 || slope > 155) return 'Slope must be from 55 to 155.'
  return ''
}

function yardsError(value) {
  const trimmed = String(value).trim()
  if (trimmed === '') return 'Yards are required.'
  if (!/^\d+$/.test(trimmed)) return 'Yards must be a whole number.'
  const yards = Number(trimmed)
  if (yards < 50 || yards > 700) return 'Yards must be from 50 to 700.'
  return ''
}

function Totals({ holes }) {
  const rows = [
    ['Out', 0, 9],
    ['In', 9, 18],
    ['Total', 0, 18],
  ]
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {rows.map(([label, start, end]) => (
        <div key={label} className="rounded-xl bg-white px-2 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="text-sm font-semibold text-dark-green">
            Par {sumRange(holes, 'par', start, end)}
          </p>
          <p className="text-sm text-dark-green">
            {sumRange(holes, 'yards', start, end).toLocaleString()} yds
          </p>
        </div>
      ))}
    </div>
  )
}

export function CourseForm({ courseId, onClose }) {
  const { courses, courseHoles, saveCourse } = useApp()
  const existing = courseId ? courses.find((course) => course.id === courseId) : null
  const [name, setName] = useState(existing?.name ?? '')
  const [teeName, setTeeName] = useState(existing?.teeName ?? '')
  const [courseRating, setCourseRating] = useState(
    existing ? Number(existing.courseRating).toFixed(1) : ''
  )
  const [slopeRating, setSlopeRating] = useState(
    existing ? String(existing.slopeRating) : ''
  )
  const [holes, setHoles] = useState(() =>
    existing ? holesForCourse(courseHoles, existing.id) : emptyHoles()
  )
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState('')

  const nameError = name.trim() ? '' : 'Course name is required.'
  const ratingMessage = ratingError(courseRating)
  const slopeMessage = slopeError(slopeRating)
  const rowErrors = holes.map((hole) => yardsError(hole.yards))
  const invalid =
    Boolean(nameError || ratingMessage || slopeMessage || rowErrors.some(Boolean))

  const updateHole = (holeNumber, updates) => {
    setHoles((current) =>
      current.map((hole) => (hole.holeNumber === holeNumber ? { ...hole, ...updates } : hole))
    )
  }

  const handleSave = () => {
    setSubmitted(true)
    setFormError('')
    if (invalid) return
    try {
      saveCourse({
        id: existing?.id,
        name,
        teeName,
        courseRating,
        slopeRating,
        holes: holes.map((hole) => ({
          holeNumber: hole.holeNumber,
          par: hole.par,
          yards: hole.yards,
          id: hole.id,
        })),
      })
      onClose()
    } catch (error) {
      setFormError(error?.message || 'Could not save this course.')
    }
  }

  return (
    <>
      <Header
        title={existing ? 'Edit course' : 'New course'}
        subtitle="18 holes, rating, and slope"
        showBack
        onBack={onClose}
      />
      <div className="flex flex-1 flex-col px-4 py-6">
        <div className="mb-4">
          <label htmlFor="course-name" className="mb-2 block text-sm font-semibold text-dark-green">
            Course name
          </label>
          <input
            id="course-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
            autoComplete="off"
          />
          {submitted && nameError && (
            <p className="mt-2 text-sm font-medium text-danger" role="alert">
              {nameError}
            </p>
          )}
        </div>

        <div className="mb-4">
          <label htmlFor="tee-name" className="mb-2 block text-sm font-semibold text-dark-green">
            Tee name
          </label>
          <input
            id="tee-name"
            value={teeName}
            onChange={(event) => setTeeName(event.target.value)}
            placeholder="e.g. White"
            className={inputClass}
          />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="course-rating" className="mb-2 block text-sm font-semibold text-dark-green">
              Course rating
            </label>
            <input
              id="course-rating"
              inputMode="decimal"
              value={courseRating}
              onChange={(event) => setCourseRating(event.target.value)}
              placeholder="71.2"
              className={[
                inputClass,
                submitted && ratingMessage ? 'border-danger focus:border-danger' : '',
              ].join(' ')}
            />
          </div>
          <div>
            <label htmlFor="slope-rating" className="mb-2 block text-sm font-semibold text-dark-green">
              Slope
            </label>
            <input
              id="slope-rating"
              inputMode="numeric"
              value={slopeRating}
              onChange={(event) => setSlopeRating(event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
              placeholder="128"
              className={[
                inputClass,
                submitted && slopeMessage ? 'border-danger focus:border-danger' : '',
              ].join(' ')}
            />
          </div>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Find these on the scorecard or your club&apos;s website. Needed to compare you with your
          reference handicap.
        </p>
        {submitted && (ratingMessage || slopeMessage) && (
          <p className="mb-4 text-sm font-medium text-danger" role="alert">
            {ratingMessage || slopeMessage}
          </p>
        )}

        <div className="mb-4">
          <Totals holes={holes} />
        </div>

        <div className="mb-2 grid grid-cols-[2rem_1fr_5.5rem] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Hole</span>
          <span>Par</span>
          <span>Yards</span>
        </div>
        <div className="mb-4 flex flex-col gap-2">
          {holes.map((hole, index) => {
            const message = rowErrors[index]
            const showInvalid = Boolean(message) && (submitted || String(hole.yards).trim() !== '')
            return (
              <div
                key={hole.holeNumber}
                className={[
                  'grid grid-cols-[2rem_1fr_5.5rem] items-center gap-2 rounded-xl px-1 py-1',
                  showInvalid ? 'bg-red-50 ring-2 ring-danger' : '',
                ].join(' ')}
              >
                <span className="text-sm font-semibold text-dark-green">{hole.holeNumber}</span>
                <div
                  className="grid grid-cols-3 gap-1"
                  role="group"
                  aria-label={`Par for hole ${hole.holeNumber}`}
                >
                  {[3, 4, 5].map((par) => (
                    <button
                      key={par}
                      type="button"
                      aria-pressed={hole.par === par}
                      onClick={() => updateHole(hole.holeNumber, { par })}
                      className={[
                        'min-h-[44px] rounded-lg text-sm font-semibold',
                        hole.par === par
                          ? 'bg-dark-green text-white'
                          : 'bg-white text-dark-green ring-1 ring-gray-200',
                      ].join(' ')}
                    >
                      {par}
                    </button>
                  ))}
                </div>
                <input
                  aria-label={`Yards for hole ${hole.holeNumber}`}
                  inputMode="numeric"
                  value={hole.yards}
                  onChange={(event) =>
                    updateHole(hole.holeNumber, {
                      yards: event.target.value.replace(/[^\d]/g, '').slice(0, 3),
                    })
                  }
                  className={[
                    'min-h-[44px] rounded-lg border-2 bg-white px-2 text-center text-base text-dark-green focus:outline-none',
                    showInvalid ? 'border-danger' : 'border-gray-200 focus:border-dark-green',
                  ].join(' ')}
                />
              </div>
            )
          })}
        </div>

        {formError && (
          <p className="mb-3 text-sm font-medium text-danger" role="alert">
            {formError}
          </p>
        )}
        <Button fullWidth onClick={handleSave}>
          Save course
        </Button>
      </div>
    </>
  )
}

export default function CourseBuilder({ onCreate, onEdit }) {
  const { courses = [], courseHoles = [], rounds = [], deleteCourse } = useApp()
  const [pendingDelete, setPendingDelete] = useState(null)

  const rows = useMemo(
    () =>
      courses
        .filter((course) => !course.deletedAt)
        .map((course) => {
        const holes = courseHoles.filter((hole) => hole.courseId === course.id)
        const par = holes.reduce((total, hole) => total + hole.par, 0)
        const yards = holes.reduce((total, hole) => total + hole.yards, 0)
        const hasRounds = rounds.some((round) => round.courseId === course.id)
        return { course, par, yards, hasRounds, holeCount: holes.length }
      }),
    [courses, courseHoles, rounds]
  )

  const confirmDelete = () => {
    if (!pendingDelete) return
    deleteCourse(pendingDelete.course.id)
    setPendingDelete(null)
  }

  return (
    <>
      <Card className="mb-6">
        {rows.length === 0 ? (
          <p className="mb-4 text-sm text-gray-600">No courses saved yet.</p>
        ) : (
          <ul className="mb-4 flex flex-col gap-3">
            {rows.map(({ course, par, yards, holeCount, hasRounds }) => (
              <li key={course.id} className="rounded-xl bg-white p-3">
                <p className="font-semibold text-dark-green">{course.name}</p>
                {course.teeName && <p className="text-sm text-gray-600">{course.teeName}</p>}
                <p className="mt-1 text-sm text-dark-green">
                  {holeCount ? `Par ${par} · ${yards.toLocaleString()} yds` : 'Holes not set'}
                  {' · '}
                  {Number(course.courseRating).toFixed(1)} / {course.slopeRating}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onEdit(course.id)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setPendingDelete({ course, hasRounds })}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button fullWidth onClick={onCreate}>
          New course
        </Button>
      </Card>

      <Modal
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title={pendingDelete?.hasRounds ? 'Hide this course?' : 'Delete this course?'}
        actions={
          <>
            <Button variant="danger" fullWidth onClick={confirmDelete}>
              {pendingDelete?.hasRounds ? 'Hide course' : 'Delete course'}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          {pendingDelete?.hasRounds
            ? 'This course has rounds. It will disappear from your list, and those rounds stay saved.'
            : 'This removes the course and its holes. This cannot be undone.'}
        </p>
      </Modal>
    </>
  )
}
