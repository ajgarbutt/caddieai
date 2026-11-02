import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import {
  createCourse as insertCourse,
  createCourseHole as insertCourseHole,
  createRound as insertRound,
  createShot as insertShot,
  deleteCourse as removeCourse,
  saveCourseWithHoles as persistCourse,
  deleteCourseHole as removeCourseHole,
  deleteRound as removeRound,
  deleteShot as removeShot,
  ensureTeeShot as seedTeeShot,
  setHoleHoledOut as markHoleHoledOut,
  updateCourse as patchCourse,
  updateCourseHole as patchCourseHole,
  updateRound as patchRound,
  updateRoundHole as patchRoundHole,
  updateShot as patchShot,
} from '../golf/repository.js'
import { withGolfProfile } from '../golf/schema.js'
import { fetchPlayerState, savePlayerState } from '../services/playerStateApi'
import {
  clearStoredData,
  createEmptyStore,
  normalizeStoredDocument,
  readLegacyStore,
  saveStoredData,
} from '../utils/localStorage'
import { createEmptyShot } from '../utils/shot'
import { convertDistanceUnits } from '../utils/shotDetailsNormalize.js'

const AppContext = createContext(null)

export function AppProvider({ children, userId, guest = false }) {
  const [data, setData] = useState(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const dataRef = useRef(null)
  const writePending = useRef(false)
  const skipSave = useRef(true)

  if (!writePending.current && data) {
    dataRef.current = data
  }

  useEffect(() => {
    let cancelled = false
    skipSave.current = true
    setReady(false)
    setLoadError('')

    async function load() {
      if (guest) {
        const legacy = readLegacyStore()
        if (!legacy) return createEmptyStore(userId)
        return normalizeStoredDocument(legacy, userId)
      }

      const remote = await fetchPlayerState()
      if (remote) return normalizeStoredDocument(remote, userId)

      const legacy = readLegacyStore()
      if (!legacy) return createEmptyStore(userId)

      const imported = normalizeStoredDocument(legacy, userId)
      await savePlayerState(imported)
      clearStoredData()
      return imported
    }

    load()
      .then((document) => {
        if (cancelled) return
        dataRef.current = document
        setData(document)
        setReady(true)
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(error?.message || 'Could not load your saved data.')
        setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [userId, guest, loadAttempt])

  useEffect(() => {
    if (!ready || !data) return
    if (skipSave.current) {
      skipSave.current = false
      writePending.current = false
      dataRef.current = data
      return
    }

    writePending.current = false
    dataRef.current = data
    const timer = setTimeout(() => {
      if (guest) {
        const saved = saveStoredData(dataRef.current)
        setSyncError(saved ? '' : 'Could not save your latest changes.')
        return
      }
      savePlayerState(dataRef.current)
        .then(() => setSyncError(''))
        .catch(() => setSyncError('Could not save your latest changes.'))
    }, 400)

    return () => clearTimeout(timer)
  }, [data, ready, guest])

  const write = useCallback((recipe) => {
    const next = recipe(dataRef.current)
    dataRef.current = next
    writePending.current = true
    setData(next)
    return next
  }, [])

  const saveGolf = useCallback((run, ...args) => {
    let record
    write((prev) => {
      const result = run(prev, ...args)
      record = result.record
      return result.store
    })
    return record
  }, [write])

  const updateProfile = useCallback((updates) => {
    write((prev) => {
      const nextProfile = withGolfProfile({ ...prev.profile, ...updates }, updates)
      let nextClubs = prev.clubs

      if (updates.units && updates.units !== prev.profile.units) {
        nextClubs = prev.clubs.map((club) => {
          if (typeof club.distance !== 'number' || club.distance <= 0) {
            return { ...club, unit: updates.units }
          }
          return {
            ...club,
            unit: updates.units,
            distance: convertDistanceUnits(
              club.distance,
              club.unit ?? prev.profile.units,
              updates.units
            ),
          }
        })
      }

      return {
        ...prev,
        profile: nextProfile,
        clubs: nextClubs,
      }
    })
  }, [write])

  const addClub = useCallback((club) => {
    write((prev) => ({
      ...prev,
      clubs: [...prev.clubs, club],
    }))
  }, [write])

  const updateClub = useCallback((id, updates) => {
    write((prev) => ({
      ...prev,
      clubs: prev.clubs.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }))
  }, [write])

  const deleteClub = useCallback((id) => {
    write((prev) => ({
      ...prev,
      clubs: prev.clubs.filter((c) => c.id !== id),
    }))
  }, [write])

  const setCurrentShot = useCallback((shot) => {
    write((prev) => ({ ...prev, currentShot: shot }))
  }, [write])

  const clearCurrentShot = useCallback(() => {
    write((prev) => ({ ...prev, currentShot: null }))
  }, [write])

  const addShotMessage = useCallback((role, text) => {
    write((prev) => {
      const shot =
        prev.currentShot ?? createEmptyShot(prev.profile.units)
      const message = {
        role,
        text,
        createdAt: new Date().toISOString(),
      }
      return {
        ...prev,
        currentShot: {
          ...shot,
          messages: [...shot.messages, message],
        },
      }
    })
  }, [write])

  const removeLastShotMessage = useCallback(() => {
    write((prev) => {
      if (!prev.currentShot?.messages?.length) return prev
      return {
        ...prev,
        currentShot: {
          ...prev.currentShot,
          messages: prev.currentShot.messages.slice(0, -1),
        },
      }
    })
  }, [write])

  const updateLastAssistantMessage = useCallback((text) => {
    write((prev) => {
      if (!prev.currentShot?.messages?.length) return prev
      const messages = [...prev.currentShot.messages]
      const lastIndex = messages.length - 1
      if (messages[lastIndex]?.role !== 'assistant') return prev
      messages[lastIndex] = {
        ...messages[lastIndex],
        text,
      }
      return {
        ...prev,
        currentShot: {
          ...prev.currentShot,
          messages,
        },
      }
    })
  }, [write])

  const addSgMessage = useCallback((role, text) => {
    write((prev) => {
      const chat = prev.sgChat ?? { messages: [], scope: null }
      return {
        ...prev,
        sgChat: {
          ...chat,
          messages: [
            ...chat.messages,
            { role, text, createdAt: new Date().toISOString() },
          ].slice(-40),
        },
      }
    })
  }, [write])

  const removeLastSgMessage = useCallback(() => {
    write((prev) => {
      if (!prev.sgChat?.messages?.length) return prev
      return {
        ...prev,
        sgChat: { ...prev.sgChat, messages: prev.sgChat.messages.slice(0, -1) },
      }
    })
  }, [write])

  const updateLastSgMessage = useCallback((text) => {
    write((prev) => {
      if (!prev.sgChat?.messages?.length) return prev
      const messages = [...prev.sgChat.messages]
      const lastIndex = messages.length - 1
      if (messages[lastIndex]?.role !== 'assistant') return prev
      messages[lastIndex] = { ...messages[lastIndex], text }
      return { ...prev, sgChat: { ...prev.sgChat, messages } }
    })
  }, [write])

  const clearSgChat = useCallback(() => {
    write((prev) => ({ ...prev, sgChat: { messages: [], scope: null } }))
  }, [write])

  const setSgScope = useCallback((scope) => {
    write((prev) => ({
      ...prev,
      sgChat: { messages: prev.sgChat?.messages ?? [], scope },
    }))
  }, [write])

  const updateShotDetails = useCallback((updates) => {
    write((prev) => {
      if (!prev.currentShot) return prev
      return {
        ...prev,
        currentShot: {
          ...prev.currentShot,
          details: {
            ...prev.currentShot.details,
            ...updates,
            units:
              updates.units ??
              prev.currentShot.details.units ??
              prev.profile.units,
          },
        },
      }
    })
  }, [write])

  const addFeedback = useCallback((entry) => {
    write((prev) => ({
      ...prev,
      feedback: [...prev.feedback, entry],
    }))
  }, [write])

  const updateVoiceSettings = useCallback((updates) => {
    write((prev) => ({
      ...prev,
      voiceSettings: { ...prev.voiceSettings, ...updates },
    }))
  }, [write])

  const resetAllData = useCallback(() => {
    const userId = dataRef.current.userId
    clearStoredData()
    write(() => createEmptyStore(userId))
  }, [write])

  const createCourse = useCallback((input) => saveGolf(insertCourse, input), [saveGolf])
  const updateCourse = useCallback((id, updates) => saveGolf(patchCourse, id, updates), [saveGolf])
  const deleteCourse = useCallback((id) => saveGolf(removeCourse, id), [saveGolf])
  const saveCourse = useCallback((input) => saveGolf(persistCourse, input), [saveGolf])

  const createCourseHole = useCallback(
    (input) => saveGolf(insertCourseHole, input),
    [saveGolf]
  )
  const updateCourseHole = useCallback(
    (id, updates) => saveGolf(patchCourseHole, id, updates),
    [saveGolf]
  )
  const deleteCourseHole = useCallback((id) => saveGolf(removeCourseHole, id), [saveGolf])

  const createRound = useCallback((input) => saveGolf(insertRound, input), [saveGolf])
  const updateRound = useCallback((id, updates) => saveGolf(patchRound, id, updates), [saveGolf])
  const deleteRound = useCallback((id) => saveGolf(removeRound, id), [saveGolf])
  const updateRoundHole = useCallback(
    (roundId, holeNumber, updates) => saveGolf(patchRoundHole, roundId, holeNumber, updates),
    [saveGolf]
  )
  const setHoleHoledOut = useCallback(
    (roundId, holeNumber, holedOut) => saveGolf(markHoleHoledOut, roundId, holeNumber, holedOut),
    [saveGolf]
  )

  const createGolfShot = useCallback((input) => saveGolf(insertShot, input), [saveGolf])
  const ensureTeeShot = useCallback(
    (roundId, holeNumber) => saveGolf(seedTeeShot, roundId, holeNumber),
    [saveGolf]
  )
  const updateGolfShot = useCallback(
    (id, updates) => saveGolf(patchShot, id, updates),
    [saveGolf]
  )
  const deleteGolfShot = useCallback((id) => saveGolf(removeShot, id), [saveGolf])

  const value = {
    ...(data ?? {
      profile: {
        name: '',
        handicap: null,
        units: 'yards',
        sassMode: false,
        onboardingComplete: false,
      },
      clubs: [],
    }),
    ready,
    loadError,
    syncError,
    retryLoad: () => setLoadAttempt((attempt) => attempt + 1),
    updateProfile,
    addClub,
    updateClub,
    deleteClub,
    setCurrentShot,
    clearCurrentShot,
    addShotMessage,
    removeLastShotMessage,
    updateLastAssistantMessage,
    updateShotDetails,
    addSgMessage,
    removeLastSgMessage,
    updateLastSgMessage,
    clearSgChat,
    setSgScope,
    addFeedback,
    updateVoiceSettings,
    resetAllData,
    createCourse,
    updateCourse,
    deleteCourse,
    saveCourse,
    createCourseHole,
    updateCourseHole,
    deleteCourseHole,
    createRound,
    updateRound,
    deleteRound,
    updateRoundHole,
    setHoleHoledOut,
    createGolfShot,
    ensureTeeShot,
    updateGolfShot,
    deleteGolfShot,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
