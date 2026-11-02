import { useState } from 'react'
import { User, Volume2, AlertTriangle, Drama } from 'lucide-react'
import Header from '../components/Header'
import Card from '../components/Card'
import Button from '../components/Button'
import Modal from '../components/Modal'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import GolfSettings from '../components/GolfSettings'
import Clubs from './Clubs'

export default function Profile() {
  const {
    profile,
    voiceSettings,
    updateProfile,
    updateVoiceSettings,
    resetAllData,
  } = useApp()
  const { status, user, signOut, openAccount } = useAuth()
  const guest = status === 'guest'

  const [showResetModal, setShowResetModal] = useState(false)

  const handleNameChange = (value) => {
    updateProfile({ name: value })
  }

  const handleHandicapChange = (value) => {
    if (value === '') {
      updateProfile({ handicap: null })
      return
    }

    const parsed = parseFloat(value)
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 54) {
      updateProfile({ handicap: parsed })
    }
  }

  const handleUnitsChange = (units) => {
    updateProfile({ units })
  }

  const handleReset = () => {
    resetAllData()
    setShowResetModal(false)
  }

  const handicapValue =
    profile.handicap !== null ? String(profile.handicap) : ''

  return (
    <>
      <Header title="Profile" subtitle="Your setup" />

      <div className="flex flex-1 flex-col px-4 py-6">
        <Card className="mb-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-dark-green">
              <User className="h-6 w-6 text-gold" strokeWidth={2} />
            </div>
            <div>
              <p className="font-semibold text-dark-green">Player details</p>
              <p className="text-sm text-gray-600">
                Used to personalise recommendations
              </p>
            </div>
          </div>

          <div className="mb-4">
            <label
              htmlFor="player-name"
              className="mb-2 block text-sm font-semibold text-dark-green"
            >
              First name
            </label>
            <input
              id="player-name"
              type="text"
              value={profile.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Your first name"
              className="w-full min-h-[52px] rounded-xl border-2 border-gray-200 bg-white px-4 text-base text-dark-green placeholder:text-gray-400 focus:border-dark-green focus:outline-none"
              autoComplete="given-name"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="handicap"
              className="mb-2 block text-sm font-semibold text-dark-green"
            >
              Handicap
            </label>
            <input
              id="handicap"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              max="54"
              value={handicapValue}
              onChange={(e) => handleHandicapChange(e.target.value)}
              placeholder="e.g. 24"
              className="w-full min-h-[52px] rounded-xl border-2 border-gray-200 bg-white px-4 text-base text-dark-green placeholder:text-gray-400 focus:border-dark-green focus:outline-none"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-dark-green">
              Preferred units
            </p>
            <div className="flex gap-3">
              {['yards', 'metres'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleUnitsChange(option)}
                  className={[
                    'flex-1 min-h-[52px] rounded-xl text-base font-semibold capitalize transition-colors',
                    profile.units === option
                      ? 'bg-dark-green text-white'
                      : 'bg-white border-2 border-gray-200 text-dark-green hover:border-dark-green/30',
                  ].join(' ')}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <GolfSettings />
        <Clubs embedded />

        <Card className="mb-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-light-grey">
              <Volume2 className="h-6 w-6 text-dark-green" strokeWidth={2} />
            </div>
            <div>
              <p className="font-semibold text-dark-green">Voice settings</p>
              <p className="text-sm text-gray-600">
                Control how CaddieAI speaks to you
              </p>
            </div>
          </div>

          <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-4">
            <span className="text-base font-medium text-dark-green">
              Read advice aloud automatically
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={voiceSettings.autoReadResponses}
              aria-label="Read advice aloud automatically"
              onClick={() =>
                updateVoiceSettings({
                  autoReadResponses: !voiceSettings.autoReadResponses,
                })
              }
              className={[
                'relative h-8 w-14 shrink-0 rounded-full transition-colors',
                voiceSettings.autoReadResponses ? 'bg-dark-green' : 'bg-gray-300',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform',
                  voiceSettings.autoReadResponses ? 'translate-x-6' : '',
                ].join(' ')}
              />
            </button>
          </label>
        </Card>

        <Card className="mb-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-light-grey">
              <Drama className="h-6 w-6 text-dark-green" strokeWidth={2} />
            </div>
            <div>
              <p className="font-semibold text-dark-green">Caddie personality</p>
              <p className="text-sm text-gray-600">
                Choose how your caddie talks to you
              </p>
            </div>
          </div>

          <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-4">
            <span className="text-base font-medium text-dark-green">
              Roast mode
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={!!profile.sassMode}
              aria-label="Roast mode"
              onClick={() => updateProfile({ sassMode: !profile.sassMode })}
              className={[
                'relative h-8 w-14 shrink-0 rounded-full transition-colors',
                profile.sassMode ? 'bg-dark-green' : 'bg-gray-300',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform',
                  profile.sassMode ? 'translate-x-6' : '',
                ].join(' ')}
              />
            </button>
          </label>
        </Card>

        <div className="mt-auto flex flex-col gap-3 pb-4">
          {guest ? (
            <p className="text-center text-sm text-gray-600">Saved on this device only.</p>
          ) : (
            user?.email && (
              <p className="text-center text-sm text-gray-600">{user.email}</p>
            )
          )}
          {guest ? (
            <Button variant="secondary" fullWidth onClick={openAccount}>
              Create an account
            </Button>
          ) : (
            <Button variant="secondary" fullWidth onClick={() => signOut()}>
              Sign out
            </Button>
          )}
          <Button
            variant="danger"
            fullWidth
            onClick={() => setShowResetModal(true)}
          >
            Reset my data
          </Button>
        </div>
      </div>

      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset all data?"
        actions={
          <>
            <Button variant="danger" fullWidth onClick={handleReset}>
              Yes, reset everything
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowResetModal(false)}
            >
              Cancel
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <p className="text-sm text-gray-600">
            This will erase your clubs, rounds, and preferences on this account.
            You will need to complete onboarding again. This cannot be undone.
          </p>
        </div>
      </Modal>
    </>
  )
}
