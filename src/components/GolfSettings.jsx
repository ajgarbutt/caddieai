import { useEffect, useRef, useState } from 'react'
import { Target } from 'lucide-react'
import Card from './Card'
import { useApp } from '../context/AppContext'
import { parseReferenceHandicap } from '../golf/schema.js'
import { formatReferenceHandicap } from '../golf/roundFormat.js'

export default function GolfSettings() {
  const { profile, updateProfile } = useApp()
  const reference = profile.referenceHandicap ?? 18
  const [draft, setDraft] = useState(() => formatReferenceHandicap(reference))
  const [error, setError] = useState('')
  const focused = useRef(false)
  const rawMode = profile.sgMode === 'raw'

  useEffect(() => {
    if (!focused.current) setDraft(formatReferenceHandicap(reference))
  }, [reference])

  const commitHandicap = (value, showError) => {
    try {
      const next = parseReferenceHandicap(value)
      updateProfile({ referenceHandicap: next })
      if (!focused.current) setDraft(formatReferenceHandicap(next))
      setError('')
    } catch (err) {
      if (showError) setError(err?.message || 'Enter a handicap from +10 to 54.')
    }
  }

  return (
    <Card className="mb-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-light-grey">
          <Target className="h-6 w-6 text-dark-green" strokeWidth={2} />
        </div>
        <div>
          <p className="font-semibold text-dark-green">Golf settings</p>
          <p className="text-sm text-gray-600">How strokes gained is compared</p>
        </div>
      </div>

      <div className={['mb-4', rawMode ? 'opacity-60' : ''].join(' ')}>
        <label
          htmlFor="reference-handicap"
          className="mb-2 block text-sm font-semibold text-dark-green"
        >
          Reference handicap
        </label>
        <input
          id="reference-handicap"
          type="text"
          inputMode="decimal"
          value={draft}
          disabled={rawMode}
          onFocus={() => {
            focused.current = true
          }}
          onChange={(event) => {
            const value = event.target.value
            setDraft(value)
            setError('')
            commitHandicap(value, false)
          }}
          onBlur={(event) => {
            focused.current = false
            commitHandicap(event.target.value, true)
          }}
          placeholder="e.g. 18 or +2"
          className={[
            'w-full min-h-[52px] rounded-xl border-2 px-4 text-base placeholder:text-gray-400 focus:outline-none',
            rawMode
              ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500'
              : error
                ? 'border-danger bg-white text-dark-green focus:border-danger'
                : 'border-gray-200 bg-white text-dark-green focus:border-dark-green',
          ].join(' ')}
        />
        <p className="mt-2 text-sm text-gray-600">
          {rawMode
            ? 'Raw strokes gained compares you with the PGA Tour baseline, so this handicap is not used.'
            : 'Strokes gained will show how you compare with an average golfer of this handicap. 0 = scratch.'}
        </p>
        {error && (
          <p className="mt-2 text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        )}
      </div>

      <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-4">
        <span className="text-base font-medium text-dark-green">
          Raw strokes gained (vs PGA Tour)
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={rawMode}
          aria-label="Raw strokes gained (vs PGA Tour)"
          onClick={() => updateProfile({ sgMode: rawMode ? 'handicap' : 'raw' })}
          className={[
            'relative h-8 w-14 shrink-0 rounded-full transition-colors',
            rawMode ? 'bg-dark-green' : 'bg-gray-300',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform',
              rawMode ? 'translate-x-6' : '',
            ].join(' ')}
          />
        </button>
      </label>
    </Card>
  )
}
