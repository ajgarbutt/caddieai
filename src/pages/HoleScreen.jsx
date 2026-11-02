import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import Button from '../components/Button'
import Modal from '../components/Modal'
import ShotForm from '../components/ShotForm'
import { useApp } from '../context/AppContext'
import { holesInPlay, scoreThru } from '../golf/roundPlay'
import {
  formatHoleScore,
  formatShotLine,
  holeScore,
  isReplayShot,
  removalEnd,
  shotTravel,
} from '../golf/shotMath'

function holeState(hole, currentNumber) {
  if (hole.holeNumber === currentNumber) return 'current'
  if (hole.holedOut) return 'done'
  return 'to play'
}

export default function HoleScreen() {
  const navigate = useNavigate()
  const { roundId, holeNumber: holeParam } = useParams()
  const {
    rounds = [],
    golfShots = [],
    ensureTeeShot,
    createGolfShot,
    updateGolfShot,
    deleteGolfShot,
    setHoleHoledOut,
    updateRound,
  } = useApp()
  const currentRef = useRef(null)
  const skipTee = useRef(new Set())
  const advanceTimer = useRef(null)
  const [panel, setPanel] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const round = rounds.find((item) => item.id === roundId)
  const holeNumber = Number(holeParam)
  const holes = round ? holesInPlay(round) : []
  const hole = holes.find((item) => item.holeNumber === holeNumber)
  const index = holes.findIndex((item) => item.holeNumber === holeNumber)
  const shots =
    round && hole
      ? golfShots
          .filter((shot) => shot.roundId === round.id && shot.holeNumber === hole.holeNumber)
          .sort((a, b) => a.seq - b.seq)
      : []
  const roundShots = round ? golfShots.filter((shot) => shot.roundId === round.id) : []

  useEffect(() => {
    currentRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [holeNumber])

  useEffect(() => {
    setPanel(null)
  }, [round?.id, holeNumber])

  useEffect(() => {
    if (!round || !hole || shots.length > 0) return
    const key = `${round.id}:${hole.holeNumber}`
    if (skipTee.current.has(key)) return
    ensureTeeShot(round.id, hole.holeNumber)
  }, [round, hole, shots.length, ensureTeeShot])

  useEffect(() => () => clearTimeout(advanceTimer.current), [holeNumber])

  if (!round) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-sm text-gray-600">That round is not on this account.</p>
        <Button onClick={() => navigate('/rounds/new')}>Back to round</Button>
      </div>
    )
  }

  if (!hole) {
    const fallback = holes[0]?.holeNumber ?? 1
    return <Navigate to={`/rounds/${round.id}/holes/${fallback}`} replace />
  }

  const previous = holes[index - 1]
  const next = holes[index + 1]
  const editing = panel?.shotId ? shots.find((shot) => shot.id === panel.shotId) : null

  const openHole = (number) => {
    navigate(`/rounds/${round.id}/holes/${number}`, { replace: true })
  }

  const removeShot = (shot) => {
    const shotIndex = shots.findIndex((item) => item.id === shot.id)
    const end = removalEnd(shots, shotIndex)
    if (shotIndex === 0 && end === shots.length) {
      skipTee.current.add(`${round.id}:${hole.holeNumber}`)
    }
    deleteGolfShot(shot.id)
    setPanel(null)
    setPendingDelete(null)
  }

  const askDelete = (shot) => {
    const shotIndex = shots.findIndex((item) => item.id === shot.id)
    const removesReplay = shots
      .slice(shotIndex, removalEnd(shots, shotIndex))
      .some((item, offset) => offset > 0 && item.type !== 'PENALTY')
    if (removesReplay) {
      setPendingDelete(shot)
      return
    }
    removeShot(shot)
  }

  const saveShot = (input) => {
    if (editing) {
      updateGolfShot(editing.id, input)
      setPanel(null)
      return
    }
    skipTee.current.delete(`${round.id}:${hole.holeNumber}`)
    if (input.type === 'PENALTY') {
      const cause = shots.at(-1)
      if (!cause || cause.type === 'PENALTY') {
        throw new Error('A penalty has to follow the shot that caused it.')
      }
      createGolfShot({ ...input, roundId: round.id, holeNumber: hole.holeNumber })
      if (input.penaltyKind === 'replay') {
        createGolfShot({
          roundId: round.id,
          holeNumber: hole.holeNumber,
          type: cause.type,
          distance: cause.distance,
          penaltyStrokes: 0,
          penaltyKind: null,
        })
        setPanel({ shotId: null, mode: 'next', formKey: Date.now() })
      } else {
        setPanel({ shotId: null, mode: 'drop' })
      }
      return
    }
    createGolfShot({ ...input, roundId: round.id, holeNumber: hole.holeNumber })
    setPanel(null)
  }

  const holeOut = () => {
    if (shots.length === 0 || hole.holedOut) return
    setHoleHoledOut(round.id, hole.holeNumber, true)
    const finished = holes.every((item) => item.holeNumber === hole.holeNumber || item.holedOut)
    if (finished) updateRound(round.id, { status: 'complete' })
    clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => {
      if (next) openHole(next.holeNumber)
      else navigate(`/rounds/${round.id}/summary`)
    }, 800)
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Header
        dense
        showBack
        backTo="/rounds/new"
        title={`Hole ${hole.holeNumber} · Par ${hole.par} · ${hole.yards.toLocaleString()} yds`}
        subtitle={scoreThru(round, hole.holeNumber, roundShots)}
      />

      <div className="flex-1 px-4 py-4">
        {hole.holedOut && (
          <p
            className="mb-3 rounded-xl bg-dark-green px-4 py-3 text-center text-lg font-bold text-white"
            role="status"
          >
            {formatHoleScore(holeScore(shots), hole.par)}
          </p>
        )}

        <section aria-label="Shots">
          <h2 className="text-sm font-semibold text-dark-green">Shots</h2>
          {shots.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">No shots on this hole yet.</p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2">
              {shots.map((shot, shotIndex) => (
                <li key={shot.id}>
                  <button
                    type="button"
                    onClick={() => setPanel({ shotId: shot.id })}
                    className={
                      shot.type === 'PENALTY'
                        ? 'min-h-[52px] w-full rounded-xl bg-red-50 px-3 py-2 text-left text-sm font-semibold text-danger ring-1 ring-danger/30'
                        : 'min-h-[52px] w-full rounded-xl bg-light-grey px-3 py-2 text-left text-sm font-medium text-dark-green'
                    }
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>{formatShotLine(shot, shotTravel(shots, shotIndex, hole.holedOut))}</span>
                      {isReplayShot(shots, shotIndex) && (
                        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-dark-green">
                          re-tee
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        {panel && (
          <div className="mt-4">
            <ShotForm
              key={`${panel.mode ?? 'add'}-${panel.formKey ?? '0'}-${editing?.id ?? 'new'}`}
              shot={editing}
              heading={panel.mode === 'drop' ? 'Where did you drop?' : undefined}
              allowPenalty={
                panel.mode !== 'drop' &&
                shots.some((item) => item.type !== 'PENALTY' && (!editing || item.seq < editing.seq))
              }
              onSave={saveShot}
              onDelete={askDelete}
              onCancel={() => setPanel(null)}
            />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-gray-200 bg-off-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {!panel && (
          <div className="mb-3 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" disabled={shots.length === 0} onClick={() => askDelete(shots.at(-1))}>
                Undo last
              </Button>
              <Button onClick={() => setPanel({ shotId: null, mode: 'add' })}>Add shot</Button>
            </div>
            {!hole.holedOut && (
              <Button fullWidth size="lg" variant="gold" disabled={shots.length === 0} onClick={holeOut}>
                Holed
              </Button>
            )}
          </div>
        )}
        <div className="mb-3 flex gap-1 overflow-x-auto" role="group" aria-label="Holes">
          {holes.map((item) => {
            const state = holeState(item, hole.holeNumber)
            return (
              <button
                key={item.holeNumber}
                ref={state === 'current' ? currentRef : undefined}
                type="button"
                aria-current={state === 'current' ? 'true' : undefined}
                aria-label={`Hole ${item.holeNumber}, ${state}`}
                onClick={() => openHole(item.holeNumber)}
                className={[
                  'h-11 w-11 shrink-0 rounded-full text-sm font-semibold',
                  state === 'done' ? 'bg-dark-green text-white' : '',
                  state === 'current' ? 'bg-gold text-dark-green' : '',
                  state === 'to play' ? 'bg-white text-dark-green ring-1 ring-gray-300' : '',
                ].join(' ')}
              >
                {item.holeNumber}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            variant="secondary"
            disabled={!previous}
            onClick={() => previous && openHole(previous.holeNumber)}
          >
            Previous
          </Button>
          <Button size="lg" disabled={!next} onClick={() => next && openHole(next.holeNumber)}>
            Next
          </Button>
        </div>
      </div>
      <Modal
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete penalty?"
        actions={
          <>
            <Button fullWidth variant="danger" onClick={() => pendingDelete && removeShot(pendingDelete)}>
              Delete penalty and re-tee
            </Button>
            <Button fullWidth variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-gray-600">
          {pendingDelete?.type === 'PENALTY'
            ? 'Delete this penalty and the re-tee that was added with it?'
            : 'Delete this shot, its penalty, and the re-tee that was added with it?'}
        </p>
      </Modal>
    </div>
  )
}
