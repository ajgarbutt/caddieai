import { useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import { useApp } from '../context/AppContext'

const HIDE_NAV_ROUTES = ['/clubs/add']

export default function AppShell({ children }) {
  const location = useLocation()
  const { profile } = useApp()
  const onHoleScreen = /^\/rounds\/[^/]+\/holes\/\d+/.test(location.pathname)
  const showNav =
    profile.onboardingComplete &&
    !onHoleScreen &&
    !HIDE_NAV_ROUTES.includes(location.pathname)

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-off-white shadow-2xl">
      <main
        className={[
          'flex flex-1 flex-col overflow-y-auto',
          showNav ? 'pb-[calc(96px+env(safe-area-inset-bottom,0px))]' : '',
        ].join(' ')}
      >
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  )
}
