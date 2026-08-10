import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { IconHistory, IconMe, IconStats, IconTrain } from './Icons'
import TrainingResumeBanner from './TrainingResumeBanner'

const TABS = [
  { path: '/', label: '训练', Icon: IconTrain },
  { path: '/history', label: '历史', Icon: IconHistory },
  { path: '/stats', label: '统计', Icon: IconStats },
  { path: '/settings', label: '我的', Icon: IconMe },
]

export default function Layout() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const active = TABS.slice().reverse().find(t => pathname === t.path || (t.path !== '/' && pathname.startsWith(t.path)))

  return (
    <div className="shell">
      <TrainingResumeBanner />
      <Outlet />
      <nav className="tabbar">
        {TABS.map(({ path, label, Icon }) => (
          <button
            key={path}
            className={'tab' + (active?.path === path ? ' on' : '')}
            onClick={() => nav(path)}
          >
            <span className="ic"><Icon size={22} /></span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export function Page({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <header className="nav">
        {title}
        {right && <div className="nav-right">{right}</div>}
      </header>
      <main className="body">{children}</main>
    </>
  )
}
