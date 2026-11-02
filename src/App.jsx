import { Navigate, Routes, Route } from 'react-router-dom'
import AppShell from './components/AppShell'
import ErrorBoundary from './components/ErrorBoundary'
import { AppProvider, useApp } from './context/AppContext'
import { guestUserId } from './utils/localStorage'
import { useAuth } from './context/AuthContext'
import Button from './components/Button'
import Dashboard from './pages/Dashboard'
import Courses from './pages/Courses'
import AddClub from './pages/AddClub'
import Profile from './pages/Profile'
import StartRound from './pages/StartRound'
import HoleScreen from './pages/HoleScreen'
import RoundSummary from './pages/RoundSummary'
import RoundsList from './pages/RoundsList'
import Stats from './pages/Stats'
import Onboarding from './pages/Onboarding'
import Login from './pages/Login'

function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="mb-2 text-xl font-bold text-dark-green">Page not found</h1>
      <p className="text-sm text-gray-600">
        That page doesn&apos;t exist. Head back to the caddie.
      </p>
      <a
        href="/"
        className="mt-6 inline-flex min-h-[44px] items-center rounded-xl bg-dark-green px-6 text-sm font-semibold text-white"
      >
        Back to Caddie
      </a>
    </div>
  )
}

function AppRoutes() {
  const { profile } = useApp()

  if (!profile.onboardingComplete) {
    return <Onboarding />
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/clubs" element={<Navigate to="/profile" replace />} />
      <Route path="/courses" element={<Courses />} />
      <Route path="/clubs/add" element={<AddClub />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/rounds/new" element={<StartRound />} />
      <Route path="/rounds" element={<RoundsList />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/rounds/:roundId/holes/:holeNumber" element={<HoleScreen />} />
      <Route path="/rounds/:roundId/summary" element={<RoundSummary />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function LoadingScreen({ label }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] items-center justify-center bg-off-white shadow-2xl">
      <p className="text-sm text-dark-green/75">{label}</p>
    </div>
  )
}

function ReadyGate() {
  const { ready, loadError, syncError, retryLoad } = useApp()

  if (!ready) return <LoadingScreen label="Loading your game…" />

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col items-center justify-center bg-off-white px-6 text-center shadow-2xl">
        <h1 className="mb-2 text-xl font-bold text-dark-green">Could not load your data</h1>
        <p className="mb-6 text-sm text-gray-600">{loadError}</p>
        <Button onClick={retryLoad}>Try again</Button>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <AppShell>
        {syncError && (
          <p className="bg-red-50 px-4 py-2 text-center text-sm text-danger" role="status">
            {syncError}
          </p>
        )}
        <AppRoutes />
      </AppShell>
    </ErrorBoundary>
  )
}

export default function App() {
  const { status, user } = useAuth()

  if (status === 'loading') return <LoadingScreen label="Loading…" />

  if (status === 'guest') {
    const id = guestUserId()
    return (
      <AppProvider key={`guest:${id}`} userId={id} guest>
        <ReadyGate />
      </AppProvider>
    )
  }

  if (status !== 'authenticated' || !user) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-off-white shadow-2xl">
        <Login />
      </div>
    )
  }

  return (
    <AppProvider key={user.id} userId={user.id}>
      <ReadyGate />
    </AppProvider>
  )
}
