import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Button from '../components/Button'
import Modal from '../components/Modal'
import { useApp } from '../context/AppContext'
import {
  CLUB_TYPES,
  formatUnitLong,
  isClubInBag,
  validateClubDistance,
} from '../constants/clubs'

export default function AddClub() {
  const navigate = useNavigate()
  const { profile, clubs, addClub } = useApp()
  const [selectedClub, setSelectedClub] = useState(null)
  const [distance, setDistance] = useState('')
  const [error, setError] = useState('')

  const units = profile.units

  const handleSave = () => {
    if (!selectedClub) return
    setError('')

    const result = validateClubDistance(distance, selectedClub, units)
    if (!result.valid) {
      setError(result.error)
      return
    }

    addClub({
      id: crypto.randomUUID(),
      name: selectedClub,
      distance: result.value,
      unit: units,
    })

    navigate('/profile')
  }

  const openModal = (clubName) => {
    if (isClubInBag(clubs, clubName)) return
    setSelectedClub(clubName)
    setDistance('')
    setError('')
  }

  const closeModal = () => {
    setSelectedClub(null)
    setDistance('')
    setError('')
  }

  return (
    <>
      <Header
        title="Add a club"
        showBack
        backTo="/profile"
      />

      <div className="flex flex-1 flex-col px-4 py-6">
        <div className="grid grid-cols-2 gap-3">
          {CLUB_TYPES.map((club) => {
            const inBag = isClubInBag(clubs, club)
            return (
              <button
                key={club}
                type="button"
                disabled={inBag}
                onClick={() => openModal(club)}
                className={[
                  'min-h-[56px] rounded-xl px-3 py-3 text-sm font-semibold transition-colors',
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

      <Modal
        isOpen={!!selectedClub}
        onClose={closeModal}
        title={`How far do you normally carry your ${selectedClub}?`}
        actions={
          <>
            <Button fullWidth size="lg" onClick={handleSave}>
              Save to Bag
            </Button>
            <Button variant="secondary" fullWidth onClick={closeModal}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-gray-600">A rough estimate is fine.</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={distance}
            onChange={(e) => {
              setDistance(e.target.value)
              setError('')
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
        {error && (
          <p className="mt-3 text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        )}
      </Modal>
    </>
  )
}
