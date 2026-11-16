import { useEffect, useId, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, ArrowLeft, Search } from 'lucide-react'
import { useDirectory } from '../data/DirectoryContext'
import WeeklyTimetable from '../components/WeeklyTimetable'
import '../styles/academic.css'

function FacultyPicker({ profiles, selected, onPick }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const input = useRef(null)
  const list = useRef(null)
  const id = useId()
  const needle = query.trim().toLocaleLowerCase()
  const matches = profiles.filter((person) => [person.name, person.facultyNumber, person.department]
    .some((field) => field?.toLocaleLowerCase().includes(needle)))
  const active = Math.max(0, Math.min(highlight, matches.length - 1))

  useEffect(() => {
    const row = list.current?.children[active]
    if (!open || !row) return
    const panel = list.current.parentElement
    const box = row.getBoundingClientRect()
    const bounds = panel.getBoundingClientRect()
    if (box.top < bounds.top) panel.scrollTop += box.top - bounds.top
    if (box.bottom > bounds.bottom) panel.scrollTop += box.bottom - bounds.bottom
  }, [active, open, query])

  function pick(person) {
    if (!person) return
    onPick(person.id)
    setQuery('')
    setOpen(false)
    setHighlight(0)
    input.current?.focus({ preventScroll: true })
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setHighlight(open && matches.length ? (active + step + matches.length) % matches.length : 0)
    }
    if (event.key === 'Enter' && open && matches[active]) {
      event.preventDefault()
      pick(matches[active])
    }
  }

  return (
    <div className="ac-picker" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <label htmlFor={id} className="ac-label">Find a faculty member</label>
      <div className="ac-input-wrap">
        <Search size={19} strokeWidth={1.65} aria-hidden="true" />
        <input id={id} ref={input} role="combobox" type="text" autoComplete="off"
          aria-autocomplete="list" aria-controls={`${id}-list`} aria-expanded={open}
          aria-activedescendant={open && matches[active] ? `${id}-option-${active}` : undefined}
          placeholder="Name, ID or department" value={query}
          onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
          onKeyDown={onKeyDown} onChange={(event) => { setQuery(event.target.value); setHighlight(0); setOpen(true) }} />
        <button type="button" tabIndex="-1" aria-label={open ? 'Close faculty list' : 'Browse faculty'}
          aria-expanded={open} aria-controls={`${id}-list`} onMouseDown={(event) => event.preventDefault()}
          onClick={() => { input.current?.focus(); setOpen(!open) }}>
          <span aria-hidden="true">{open ? '−' : '+'}</span>
        </button>
      </div>
      <div className="ac-picker-panel" hidden={!open}>
        <ul role="listbox" id={`${id}-list`} aria-label="Matching faculty" ref={list}>
          {matches.map((person, i) => (
            <li key={person.id} role="option" aria-selected={selected === person.id} id={`${id}-option-${i}`}
              data-highlight={active === i} onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(person)}>
              <span><strong>{person.name}</strong><small>{person.department}</small></span>
              <span className="ac-picker-id">{person.facultyNumber}</span>
            </li>
          ))}
        </ul>
        {!matches.length && <p role="status">No faculty match “{query}”.</p>}
      </div>
    </div>
  )
}

export default function TimetablePage() {
  const { profiles } = useDirectory()
  const [params, setParams] = useSearchParams()
  const requested = params.get('faculty')
  const selected = profiles.find((person) => person.id === requested) || profiles[0]

  function selectFaculty(id) {
    const next = new URLSearchParams(params)
    next.set('faculty', id)
    setParams(next, { preventScrollReset: true })
  }

  return (
    <div className="container ac-shell">
      <div className="ac-breadcrumb">
        <Link to="/discover#directory"><ArrowLeft size={14} aria-hidden="true" /> Faculty directory</Link>
        <span className="ac-kicker">Timetable</span>
      </div>
      <header className="ac-time-hero">
        <h1 className="ac-display">Faculty <em>timetable.</em></h1>
        <div className="ac-time-intro">
          <p>Find a lecturer’s classes, office hours and next free period.</p>
          <FacultyPicker profiles={profiles} selected={selected?.id} onPick={selectFaculty} />
        </div>
      </header>
      {requested && selected?.id !== requested && <p className="ac-picker-feedback" role="status">The requested faculty record could not be found.</p>}
      {selected ? <>
        <div className="ac-selected">
          <div className="ac-selected-mark" aria-hidden="true">
            {selected.photo ? <img src={selected.photo} alt="" /> : selected.initials}
          </div>
          <div className="ac-selected-details">
            <span className="ac-kicker">{selected.facultyNumber}</span>
            <h2>{selected.name}</h2><p>{selected.department}</p>
          </div>
          <Link className="ac-text-link" to={`/faculty/${selected.id}`}>View profile <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
        <WeeklyTimetable profile={selected} />
      </> : <p className="ac-empty-page">No faculty timetables are available yet.</p>}
    </div>
  )
}
