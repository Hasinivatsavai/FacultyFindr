import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight, CornerDownLeft, MapPin, Search, X } from 'lucide-react'
import { useDirectory } from '../data/DirectoryContext'
import { getAvailability } from '../data/facultyProfiles'
import PixelHands from '../components/PixelHands'
import '../styles/discovery.css'

function clean(text) { return String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() }
function scrollToDirectory() {
  document.getElementById('directory')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
}
function FacultyRow({ profile, now, index }) {
  const availability = getAvailability(profile, now)
  return <Link to={'/faculty/' + profile.id} className="faculty-row" aria-label={'View profile for ' + profile.name}>
    <div className={'faculty-monogram tone-' + (index % 3)}>
      {profile.photo ? <img src={profile.photo} alt="" /> : <span>{profile.initials}</span>}
    </div>
    <div className="faculty-row__identity"><span className="small-code">{profile.facultyNumber}</span><h3>{profile.name}</h3><p>{profile.title}</p></div>
    <div className="faculty-row__details"><p>{profile.department}</p><span><MapPin size={13}/>{profile.room || 'Cabin pending'}</span></div>
    <div className={'faculty-state state-' + availability.kind}><i/>{availability.label}</div>
    <ArrowUpRight className="row-arrow" size={19}/>
  </Link>
}

function DepartmentSection({ departments, profiles, selected, onSelect }) {
  return <aside id="departments" className="departments" tabIndex="-1" aria-labelledby="department-title">
    <h2 className="section-kicker" id="department-title"><span className="signal-mark"/> Departments</h2>
    <div className="department-options" role="group" aria-label="Filter faculty by department">
      {['', ...departments].map(dept => <button type="button" aria-pressed={selected === dept} onClick={() => onSelect(dept)} key={dept}>
        <span>{dept || 'All departments'}</span><span className="dept-count">{String(dept ? profiles.filter(p => p.department === dept).length : profiles.length).padStart(2,'0')}</span>
      </button>)}
    </div>
    <Link className="dept-schedule" to="/timetable">Browse weekly timetables <ArrowUpRight size={14}/></Link>
  </aside>
}

export default function HomePage() {
  const {profiles, now} = useDirectory()
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('')
  const primaryInput = useRef(null)
  const home = useRef(null)
  const departments = [...new Set(profiles.map(p => p.department).filter(Boolean))].sort()
  const q = clean(query)
  const matches = profiles.filter(p => (!department || p.department === department) &&
    clean([p.name, p.facultyNumber, p.department, p.title, ...(p.expertise || []), ...(p.subjects || [])].join(' ')).includes(q))
  useEffect(() => {
    function slash(event) {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || event.target.closest('input,textarea,select,[contenteditable]')) return
      event.preventDefault()
      primaryInput.current?.focus()
    }
    document.addEventListener('keydown', slash)
    return () => document.removeEventListener('keydown', slash)
  }, [])
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed')
        observer.unobserve(entry.target)
      }
    }, {threshold:.1})
    home.current?.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])
  return <div ref={home} className="home">
    <div className="container">
      <section className="discover-hero">
        <div className="discover-copy">
          <div className="section-kicker"><span className="signal-mark"/> Faculty discovery</div>
          <h1>Find your faculty.<br/><em>Find your time<span>.</span></em></h1>
          <p>Discover your lecturers, explore their academic profiles, check their schedules, and find out when they're available.</p>
        </div>
        <figure className="home-art">
          <div className="home-art__frame"><span className="small-code">FIG. 01</span><div className="home-art__hands"><PixelHands compact /></div><i className="home-art__target" aria-hidden="true"/></div>
          <figcaption><span>The contact study</span><Link to="/opening">View installation <ArrowUpRight size={12}/></Link></figcaption>
        </figure>
      </section>
      <form className="discovery-search" role="search" onSubmit={event => {event.preventDefault();scrollToDirectory()}}>
        <Search size={24} strokeWidth={1.5}/>
        <label htmlFor="faculty-search" className="sr-only">Search faculty by name, faculty ID or department</label>
        <input id="faculty-search" ref={primaryInput} type="search" placeholder="Search faculty by name, faculty ID or department..." value={query} onChange={event => setQuery(event.target.value)}/>
        {query && <button aria-label="Clear search" type="button" className="search-clear" onClick={() => {setQuery(''); primaryInput.current?.focus()}}><X size={16}/></button>}
        <button type="submit" className="search-go"><span>Search</span><CornerDownLeft size={16}/></button>
      </form>
    </div>
    <section id="directory" className="directory-section" aria-label="Faculty directory" tabIndex="-1">
      <div className="container directory-grid">
        <DepartmentSection departments={departments} profiles={profiles} selected={department} onSelect={setDepartment}/>
        <div className="roster">
          <div className="roster-heading" data-reveal><h2>Faculty index<span>.</span></h2><p role="status">{String(matches.length).padStart(2,'0')} {matches.length === 1 ? 'profile' : 'profiles'}</p></div>
          {matches.length ? <div className="faculty-rows">{matches.map((p,i) => <FacultyRow key={p.id} profile={p} now={now} index={i}/>)}</div> :
            <div className="directory-empty"><h3>No matching faculty.</h3><p>Try another name, faculty ID, or department.</p><button onClick={() => {setQuery('');setDepartment('');primaryInput.current?.focus()}}>Clear search and filters <ArrowRight size={15}/></button></div>}
        </div>
      </div>
    </section>
    <section className="directory-end container" data-reveal>
      <div><div className="section-kicker"><ArrowDown size={13}/> Timetable</div><h2>Find a time <em>to meet.</em></h2></div>
      <Link to="/timetable" className="primary-action" data-magnetic>Explore the timetable <ArrowRight size={17}/></Link>
    </section>
  </div>
}
