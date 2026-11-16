import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import Brand from './Brand'
import { useDirectory } from '../data/DirectoryContext'

const destinations = [
  { label: 'Discover', url: '/discover' },
  { label: 'Departments', url: '/discover#departments' },
  { label: 'Timetable', url: '/timetable' },
  { label: 'Faculty space', url: '/faculty-space' },
]

export default function Layout({children}) {
  const { pathname, hash } = useLocation()
  const { ready, syncError, refreshing, refresh, timeZone } = useDirectory()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname, hash])
  useEffect(() => {
    if (!open) return
    function escape(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        document.querySelector('.nav-toggle')?.focus()
      }
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [open])
  function current(url) {
    if (url === '/discover#departments') return ['/','/discover'].includes(pathname) && hash === '#departments'
    if (url === '/discover') return (['/','/discover'].includes(pathname) && hash !== '#departments') || pathname.startsWith('/faculty/')
    return pathname === url
  }
  return <div className="site">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header">
      <div className="container nav-wrap">
        <Brand /><button className="nav-toggle" type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="primary-nav" aria-label={open ? 'Close navigation' : 'Open navigation'}>{open ? <X /> : <Menu />}</button>
        <nav id="primary-nav" className={open ? 'nav-links is-open' : 'nav-links'} aria-label="Primary navigation">
          {destinations.map(({label,url}) => <Link key={url} to={url} onClick={() => setOpen(false)} className={current(url) ? 'is-active' : ''} aria-current={current(url) ? 'page' : undefined}>{label}{url === '/faculty-space' && <ArrowUpRight size={14} />}</Link>)}
        </nav>
      </div>
    </header>
    <main id="main-content" tabIndex="-1">
      {syncError && <div className="container api-notice" role="alert"><span>{syncError}{ready && ' Showing the last loaded directory.'}</span>
        <button className="primary-action" onClick={refresh} disabled={refreshing}>{refreshing ? 'Reconnecting…' : 'Retry connection'}</button></div>}
      {ready ? children : !syncError && <div className="container api-notice" role="status">Loading the faculty directory…</div>}
    </main>
    <footer className="site-footer container">
      <div><Brand /><span>The academic connection</span></div>
      <p>{ready ? `Campus time · ${timeZone}` : 'Faculty directory'}</p>
      <Link to="/opening">Replay opening <ArrowUpRight size={14}/></Link>
    </footer>
  </div>
}
