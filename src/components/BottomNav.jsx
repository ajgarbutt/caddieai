import { NavLink } from 'react-router-dom'
import { BarChart3, Flag, Map, Sparkles, User } from 'lucide-react'

const navItems = [
  { to: '/stats', label: 'Stats', icon: BarChart3, end: false },
  { to: '/courses', label: 'Courses', icon: Map, end: false },
  { to: '/', label: 'Caddie', icon: Sparkles, end: true },
  { to: '/rounds/new', label: 'Round', icon: Flag, end: true },
  { to: '/profile', label: 'Profile', icon: User, end: false },
]

export default function BottomNav() {
  return (
    <nav
      className="safe-bottom safe-x fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-dark-green/15 bg-white"
      aria-label="Main navigation"
    >
      <ul className="relative flex items-stretch">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 py-2 transition-colors',
                  label === 'Caddie'
                    ? 'relative -translate-y-2'
                    : isActive
                      ? 'text-dark-green'
                      : 'text-dark-green/70 hover:text-dark-green',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  {label === 'Caddie' ? (
                    <span
                      className={[
                        'flex h-14 w-14 items-center justify-center rounded-full border-4 bg-[#e8f2ed] text-soft-green shadow-md transition-colors',
                        isActive ? 'border-dark-green' : 'border-white',
                      ].join(' ')}
                    >
                      <Icon className="h-6 w-6" strokeWidth={2.5} />
                    </span>
                  ) : (
                    <Icon
                      className="h-6 w-6"
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  )}
                  <span
                    className={[
                      'text-xs',
                      label === 'Caddie' ? 'mt-0.5' : '',
                      isActive ? 'font-semibold' : 'font-medium',
                    ].join(' ')}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
