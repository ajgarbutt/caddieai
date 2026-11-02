import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import GolfDriverIcon from '../components/GolfDriverIcon'
import Button from '../components/Button'
import Modal from '../components/Modal'
import { useApp } from '../context/AppContext'
import {
  CLUB_TYPES,
  formatUnitLong,
  isClubInBag,
  validateClubDistance,
} from '../constants/clubs'

const STEPS = 3

export default function Onboarding() {
  const { profile, clubs, updateProfile, addClub } = useApp()

  const [step, setStep] = useState(1)
  const [name, setName] = useState(profile.name)
  const [handicap, setHandicap] = useState(
    profile.handicap !== null ? String(profile.handicap) : ''
  )
  const [units, setUnits] = useState(profile.units)
  const [selectedClub, setSelectedClub] = useState(null)
  const [clubDistance, setClubDistance] = useState('')
  const [clubError, setClubError] = useState('')

  const completeOnboarding = (profileUpdates = {}) => {
    updateProfile({
      name: name.trim(),
      handicap:
        handicap === ''
          ? null
          : (() => {
              const parsed = parseFloat(handicap)
              return !isNaN(parsed) && parsed >= 0 && parsed <= 54 ? parsed : null
            })(),
      units,
      onboardingComplete: true,
      ...profileUpdates,
    })
  }

  const handleStep1Continue = () => {
    updateProfile({ name: name.trim() })
    setStep(2)
  }

  const handleStep1Skip = () => {
    updateProfile({ name: '' })
    setStep(2)
  }

  const handleStep2Continue = () => {
    const parsed = handicap === '' ? null : parseFloat(handicap)
    updateProfile({
      handicap:
        parsed !== null && !isNaN(parsed) && parsed >= 0 && parsed <= 54
          ? parsed
          : null,
    })
    setStep(3)
  }

  const handleStep2Skip = () => {
    updateProfile({ handicap: null })
    setStep(3)
  }

  const handleSaveClub = () => {
    if (!selectedClub) return
    setClubError('')

    const result = validateClubDistance(clubDistance, selectedClub, units)
    if (!result.valid) {
      setClubError(result.error)
      return
    }

    addClub({
      id: crypto.randomUUID(),
      name: selectedClub,
      distance: result.value,
      unit: units,
    })

    setSelectedClub(null)
    setClubDistance('')
    setClubError('')
  }

  const handleFinish = () => {
    updateProfile({ units })
    completeOnboarding()
  }

  const openClubModal = (clubName) => {
    if (isClubInBag(clubs, clubName)) return
    setSelectedClub(clubName)
    setClubDistance('')
    setClubError('')
  }

  const goBack = () => {
    if (step > 1) setStep((s) => s - 1)
  }

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <div className="mb-8">
        {step > 1 && (
          <button
            type="button"
            onClick={goBack}
            className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-dark-green"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
        )}
        <p className="mb-2 text-sm font-medium text-gold">
          Step {step} of {STEPS}
        </p>
        <div className="flex gap-2">
          {Array.from({ length: STEPS }, (_, i) => (
            <div
              key={i}
              className={[
                'h-1 flex-1 rounded-full transition-colors',
                i < step ? 'bg-dark-green' : 'bg-gray-200',
              ].join(' ')}
            />
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="flex flex-1 flex-col">
          <h2 className="mb-2 text-2xl font-bold text-dark-green">
            What&apos;s your first name?
          </h2>
          <p className="mb-6 text-sm text-gray-600">
            Optional — we&apos;ll use it to greet you on the course.
          </p>

          <label htmlFor="onboarding-name" className="sr-only">
            First name
          </label>
          <input
            id="onboarding-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name"
            className="mb-6 w-full min-h-[52px] rounded-xl border-2 border-gray-200 bg-white px-4 text-base text-dark-green placeholder:text-gray-400 focus:border-dark-green focus:outline-none"
            autoComplete="given-name"
          />

          <div className="mt-auto flex flex-col gap-3 pb-4">
            <Button fullWidth size="lg" onClick={handleStep1Continue}>
              Continue
            </Button>
            <Button variant="ghost" fullWidth onClick={handleStep1Skip}>
              Skip
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-1 flex-col">
          <h2 className="mb-2 text-2xl font-bold text-dark-green">
            What&apos;s your handicap?
          </h2>
          <p className="mb-6 text-sm text-gray-600">
            Optional — helps tailor advice for high-handicap golfers.
          </p>

          <label htmlFor="onboarding-handicap" className="sr-only">
            Handicap
          </label>
          <input
            id="onboarding-handicap"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            max="54"
            value={handicap}
            onChange={(e) => setHandicap(e.target.value)}
            placeholder="e.g. 24"
            className="mb-6 w-full min-h-[52px] rounded-xl border-2 border-gray-200 bg-white px-4 text-base text-dark-green placeholder:text-gray-400 focus:border-dark-green focus:outline-none"
          />

          <div className="mt-auto flex flex-col gap-3 pb-4">
            <Button fullWidth size="lg" onClick={handleStep2Continue}>
              Continue
            </Button>
            <Button variant="ghost" fullWidth onClick={handleStep2Skip}>
              Skip
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-1 flex-col">
          <h2 className="mb-2 text-2xl font-bold text-dark-green">
            Preferred distance units
          </h2>
          <p className="mb-6 text-sm text-gray-600">
            You can change this later in your profile.
          </p>

          <fieldset>
            <legend className="sr-only">Preferred distance units</legend>
            <div className="mb-8 flex gap-3">
              {['yards', 'metres'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setUnits(option)}
                  aria-pressed={units === option}
                  className={[
                    'flex-1 min-h-[52px] rounded-xl text-base font-semibold capitalize transition-colors',
                    units === option
                      ? 'bg-dark-green text-white'
                      : 'bg-white border-2 border-gray-200 text-dark-green hover:border-dark-green/30',
                  ].join(' ')}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mb-4">
            <div className="mb-3 flex items-center gap-2">
              <GolfDriverIcon className="h-5 w-5 text-dark-green" strokeWidth={2} />
              <p className="text-sm font-semibold text-dark-green">
                Add your first club (optional)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CLUB_TYPES.map((club) => {
                const inBag = isClubInBag(clubs, club)
                return (
                  <button
                    key={club}
                    type="button"
                    disabled={inBag}
                    onClick={() => openClubModal(club)}
                    className={[
                      'min-h-[48px] rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      inBag
                        ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                        : 'bg-light-grey text-dark-green hover:bg-[#ebebeb] active:bg-[#e0e0e0]',
                    ].join(' ')}
                  >
                    {club}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-auto pb-4">
            <Button fullWidth size="lg" onClick={handleFinish}>
              Get started
            </Button>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!selectedClub}
        onClose={() => {
          setSelectedClub(null)
          setClubDistance('')
          setClubError('')
        }}
        title={`How far do you normally carry your ${selectedClub}?`}
        actions={
          <>
            <Button fullWidth size="lg" onClick={handleSaveClub}>
              Save to Bag
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setSelectedClub(null)
                setClubDistance('')
                setClubError('')
              }}
            >
              Cancel
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-gray-600">A rough estimate is fine.</p>
        <label htmlFor="onboarding-club-distance" className="sr-only">
          Carry distance for {selectedClub}
        </label>
        <div className="flex items-center gap-3">
          <input
            id="onboarding-club-distance"
            type="number"
            inputMode="numeric"
            min="1"
            value={clubDistance}
            onChange={(e) => {
              setClubDistance(e.target.value)
              setClubError('')
            }}
            placeholder={units === 'metres' ? 'e.g. 140' : 'e.g. 150'}
            className="w-full min-h-[52px] rounded-xl border-2 border-gray-200 bg-white px-4 text-base text-dark-green placeholder:text-gray-400 focus:border-dark-green focus:outline-none"
            autoFocus
          />
          <span className="shrink-0 text-sm font-semibold text-gray-600">
            {formatUnitLong(units)}
          </span>
        </div>
        {selectedClub === 'Putter' && (
          <p className="mt-2 text-xs text-gray-500">
            Distance is optional for your putter.
          </p>
        )}
        {clubError && (
          <p className="mt-3 text-sm font-medium text-danger" role="alert">
            {clubError}
          </p>
        )}
      </Modal>
    </div>
  )
}
