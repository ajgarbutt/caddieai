import { useEffect, useRef, useState } from 'react'
import Button from './Button'
import { SHOT_TYPES } from '../golf/schema'
import { distanceWarning } from '../golf/shotMath'

const RECOVERY_HELP =
  'Use RECOVERY when you have to hit much shorter than usual from this distance to get out of trouble (punch out from trees, etc.).'

const OB_DROP_HELP = 'Only if your club uses the OB drop local rule. Otherwise use Re-tee.'

const LIE_OPTIONS = SHOT_TYPES.filter((option) => option !== 'TEE')

const PENALTY_OPTIONS = [
  { strokes: 1, kind: 'replay', label: '+1  Re-tee / replay (OB or lost ball)' },
  { strokes: 1, kind: 'drop', label: '+1  Drop (water / unplayable)' },
  { strokes: 2, kind: 'drop', label: '+2  Drop (OB local rule, drop near where it went out)' },
]

/**
 * @param {string} type
 * @param {string} raw
 * @param {number | null} penaltyStrokes
 */
function enteredDistance(type, raw, penaltyChoice) {
  if (type === 'PENALTY') {
    if (!penaltyChoice) return { error: 'Choose the penalty.' }
    return {
      distance: null,
      penaltyStrokes: penaltyChoice.strokes,
      penaltyKind: penaltyChoice.kind,
    }
  }
  const text = raw.trim()
  const distance = Number(text)
  if (text === '' || !Number.isFinite(distance) || distance <= 0) {
    return { error: 'Enter a distance greater than 0.' }
  }
  return { distance, penaltyStrokes: 0, penaltyKind: null }
}

export default function ShotForm({
  shot,
  allowPenalty = true,
  heading,
  onSave,
  onDelete,
  onCancel,
}) {
  const editing = Boolean(shot)
  const [type, setType] = useState(shot?.type ?? '')
  const [penaltyChoice, setPenaltyChoice] = useState(() => {
    if (shot?.type !== 'PENALTY') return null
    return (
      PENALTY_OPTIONS.find(
        (option) => option.strokes === shot.penaltyStrokes && option.kind === shot.penaltyKind
      ) ?? null
    )
  })
  const [distance, setDistance] = useState(
    shot && shot.type !== 'PENALTY' && shot.distance != null ? String(shot.distance) : ''
  )
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const needsDistance = type !== '' && type !== 'PENALTY'
  const warning = needsDistance ? distanceWarning(type, distance) : null

  useEffect(() => {
    if (needsDistance) inputRef.current?.focus()
  }, [needsDistance, type])

  const save = () => {
    if (!type) {
      setError('Choose a lie.')
      return
    }
    const parsed = enteredDistance(type, distance, penaltyChoice)
    if (parsed.error) {
      setError(parsed.error)
      return
    }
    setError('')
    try {
      onSave({
        type,
        distance: parsed.distance,
        penaltyStrokes: parsed.penaltyStrokes,
        penaltyKind: parsed.penaltyKind,
      })
    } catch (err) {
      setError(err?.message || 'Could not save that shot.')
    }
  }

  return (
    <form
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <h2 className="text-base font-semibold text-dark-green">
        {heading || (editing ? 'Edit shot' : 'Add shot')}
      </h2>
      {type === 'TEE' ? (
        <p className="mt-2 text-sm text-gray-600">
          The tee shot is the hole length. Change the yards if the card is wrong.
        </p>
      ) : (
      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Shot type">
        {LIE_OPTIONS.map((option) => {
          const selected = option === type
          const blocked = option === 'PENALTY' && !allowPenalty
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              disabled={blocked}
              onClick={() => {
                setType(option)
                setError('')
              }}
              className={[
                'min-h-[48px] rounded-xl px-3 text-sm font-semibold disabled:opacity-40',
                selected ? 'bg-dark-green text-white' : 'bg-light-grey text-dark-green',
              ].join(' ')}
            >
              {option}
            </button>
          )
        })}
      </div>
      )}
      {type === 'RECOVERY' && <p className="mt-2 text-xs leading-5 text-gray-600">{RECOVERY_HELP}</p>}
      {type === 'PENALTY' && (
        <div className="mt-3">
          <div className="flex flex-col gap-2" role="group" aria-label="Penalty">
            {PENALTY_OPTIONS.map((option) => {
              const selected = penaltyChoice === option
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setPenaltyChoice(option)
                    setError('')
                    try {
                      onSave({
                        type: 'PENALTY',
                        distance: null,
                        penaltyStrokes: option.strokes,
                        penaltyKind: option.kind,
                      })
                    } catch (err) {
                      setError(err?.message || 'Could not save that shot.')
                    }
                  }}
                  className={[
                    'min-h-[56px] rounded-xl px-4 text-left text-base font-semibold',
                    selected ? 'bg-dark-green text-white' : 'bg-light-grey text-dark-green',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs leading-5 text-gray-600">{OB_DROP_HELP}</p>
        </div>
      )}

      {needsDistance && (
        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-semibold text-dark-green">
            {type === 'PUTTS' ? 'Feet to hole' : 'Yards to hole'}
          </span>
          <input
            ref={inputRef}
            value={distance}
            onChange={(event) => {
              setDistance(event.target.value)
              setError('')
            }}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            className="w-full min-h-[52px] rounded-xl border-2 border-gray-200 px-4 text-base text-dark-green focus:border-dark-green focus:outline-none"
          />
        </label>
      )}

      {warning && (
        <p className="mt-2 text-sm font-medium text-[#8a5a00]" role="status">
          {warning}
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {type !== 'PENALTY' && (
          <Button fullWidth size="lg" type="submit">
            Save
          </Button>
        )}
        {editing && (
          <Button fullWidth variant="danger" onClick={() => onDelete(shot)}>
            Delete shot
          </Button>
        )}
        <Button fullWidth variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
