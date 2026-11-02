import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Pencil } from 'lucide-react'
import GolfDriverIcon from '../components/GolfDriverIcon'
import Header from '../components/Header'
import Card from '../components/Card'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { useApp } from '../context/AppContext'
import {
  formatUnitLong,
  formatUnitShort,
  sortClubs,
  validateClubDistance,
} from '../constants/clubs'

export default function Clubs({ embedded = false }) {
  const navigate = useNavigate()
  const { clubs, profile, deleteClub, updateClub } = useApp()
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editDistance, setEditDistance] = useState('')
  const [editError, setEditError] = useState('')

  const sortedClubs = sortClubs(clubs)
  const unitShort = formatUnitShort(profile.units)

  const openEditModal = (club) => {
    setEditTarget(club)
    setEditDistance(club.distance !== null ? String(club.distance) : '')
    setEditError('')
  }

  const closeEditModal = () => {
    setEditTarget(null)
    setEditDistance('')
    setEditError('')
  }

  const handleSaveEdit = () => {
    if (!editTarget) return
    setEditError('')

    const result = validateClubDistance(
      editDistance,
      editTarget.name,
      profile.units
    )
    if (!result.valid) {
      setEditError(result.error)
      return
    }

    updateClub(editTarget.id, {
      distance: result.value,
      unit: profile.units,
    })
    closeEditModal()
  }

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteClub(deleteTarget.id)
      setDeleteTarget(null)
    }
  }

  const bagLabel = `${clubs.length} club${clubs.length !== 1 ? 's' : ''}`

  return (
    <>
      {embedded ? (
        <div className="mb-4">
          <p className="font-semibold text-dark-green">My bag</p>
          <p className="text-sm text-gray-600">{bagLabel}</p>
        </div>
      ) : (
        <Header title="My Bag" subtitle={bagLabel} />
      )}

      <div className={embedded ? 'mb-6' : 'flex flex-1 flex-col px-4 py-4'}>
        {clubs.length === 0 ? (
          <EmptyState
            icon={GolfDriverIcon}
            title="Your bag is empty"
            description="Add your clubs to get personalised advice"
            action={
              <Button fullWidth onClick={() => navigate('/clubs/add')}>
                <Plus className="h-5 w-5" />
                Add Club
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {sortedClubs.map((club) => (
              <li key={club.id}>
                <Card className="flex items-center gap-2 px-3 py-3">
                  <p className="w-[30%] shrink-0 truncate text-sm font-semibold text-dark-green">
                    {club.name}
                  </p>
                  <p className="flex-1 text-center text-base font-semibold text-dark-green">
                    {club.distance !== null ? club.distance : '—'}
                  </p>
                  <p className="w-10 shrink-0 text-sm text-gray-600">
                    {unitShort}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(club)}
                      aria-label={`Edit ${club.name}`}
                      className="!min-h-[44px] !min-w-[44px]"
                    >
                      <Pencil className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="danger"
                      size="icon"
                      onClick={() => setDeleteTarget(club)}
                      aria-label={`Delete ${club.name}`}
                      className="!min-h-[44px] !min-w-[44px]"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {clubs.length > 0 && (
          <div className={embedded ? 'mt-4' : 'mt-auto pt-4 pb-2'}>
            <Button fullWidth size="lg" onClick={() => navigate('/clubs/add')}>
              <Plus className="h-5 w-5" />
              Add Club
            </Button>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove club?"
        actions={
          <>
            <Button variant="danger" fullWidth onClick={handleConfirmDelete}>
              Remove {deleteTarget?.name}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          This will remove <strong>{deleteTarget?.name}</strong> from your bag.
          You can add it back anytime.
        </p>
      </Modal>

      <Modal
        isOpen={!!editTarget}
        onClose={closeEditModal}
        title={`Edit ${editTarget?.name} carry distance`}
        actions={
          <>
            <Button fullWidth size="lg" onClick={handleSaveEdit}>
              Save
            </Button>
            <Button variant="secondary" fullWidth onClick={closeEditModal}>
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
            value={editDistance}
            onChange={(e) => {
              setEditDistance(e.target.value)
              setEditError('')
            }}
            placeholder={
              profile.units === 'metres' ? 'e.g. 140' : 'e.g. 150'
            }
            className="w-full min-h-[52px] rounded-xl border-2 border-gray-200 bg-white px-4 text-base text-dark-green placeholder:text-gray-400 focus:border-dark-green focus:outline-none"
            autoFocus
          />
          <span className="shrink-0 text-sm font-semibold text-gray-600">
            {formatUnitLong(profile.units)}
          </span>
        </div>
        {editTarget?.name === 'Putter' && (
          <p className="mt-2 text-xs text-gray-500">
            Distance is optional for your putter.
          </p>
        )}
        {editError && (
          <p className="mt-3 text-sm font-medium text-danger" role="alert">
            {editError}
          </p>
        )}
      </Modal>
    </>
  )
}
