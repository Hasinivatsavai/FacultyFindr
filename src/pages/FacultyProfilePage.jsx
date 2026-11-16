import { Link, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft } from 'lucide-react'
import { useDirectory } from '../data/DirectoryContext'
import { facultyProfiles, getAvailability } from '../data/facultyProfiles'
import WeeklyTimetable, { AvailabilityLabel } from '../components/WeeklyTimetable'
import '../styles/academic.css'

const recordSections = [
  {
    title: 'Academic background',
    fields: [
      ['qualifications', 'Qualifications'],
      ['background', 'Academic background'],
      ['phdSpecialisation', 'Doctoral specialisation'],
      ['experience', 'Teaching experience'],
    ],
  },
  {
    title: 'Teaching & research',
    fields: [
      ['subjects', 'Subjects taught'],
      ['research', 'Research interests'],
      ['expertise', 'Technical expertise'],
    ],
  },
  {
    title: 'Selected work',
    fields: [
      ['publications', 'Publications'],
      ['projects', 'Projects'],
      ['achievements', 'Achievements'],
    ],
  },
]

function AcademicRecord({ profile }) {
  return (
    <section id="academic-record" className="ac-record" aria-labelledby="ac-record-title">
      <h2 className="ac-section-title" id="ac-record-title">Academic <em>record.</em></h2>
      <div className="ac-record-list">
        {recordSections.map(({ title, fields }, index) => (
          <details key={title} className="ac-record-group" open={index === 0}>
            <summary>{title}<span className="ac-expand" aria-hidden="true" /></summary>
            <dl>
              {fields.map(([key, label]) => {
                const value = profile[key]
                const items = Array.isArray(value) ? value.filter(Boolean) : []
                return (
                  <div key={key} className="ac-record-line">
                    <dt>{label}</dt>
                    <dd>{Array.isArray(value) && items.length ? (
                      <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
                    ) : (typeof value === 'string' && value.trim()) || <span className="ac-missing">Not listed</span>}</dd>
                  </div>
                )
              })}
            </dl>
          </details>
        ))}
      </div>
    </section>
  )
}

function PortraitPlate({ profile }) {
  return (
    <figure className="ac-portrait">
      <div className="ac-portrait-art">
        {profile.photo ? (
          <img src={profile.photo} alt={profile.name} />
        ) : (
          <div className="ac-monogram" aria-label={`Monogram for ${profile.name}`}>
            <span aria-hidden="true">{profile.initials}</span>
          </div>
        )}
      </div>
      <figcaption><span>{profile.photo ? 'Faculty portrait' : 'Faculty monogram'}</span><b>{profile.facultyNumber}</b></figcaption>
    </figure>
  )
}

export default function FacultyProfilePage() {
  const { facultyId } = useParams()
  const { profiles, now } = useDirectory()
  const profile = profiles.find((faculty) => faculty.id === facultyId)

  if (!profile) return (
    <div className="container ac-shell ac-empty-page">
      <h1 className="ac-display">Faculty record <em>unavailable.</em></h1>
      <Link className="ac-text-link" to="/discover#directory"><ArrowLeft size={14} aria-hidden="true" /> Return to the directory</Link>
    </div>
  )

  const names = profile.name.trim().split(/\s+/)
  const familyName = names.pop()
  const status = getAvailability(profile, now)
  const sample = facultyProfiles.some((person) => person.id === profile.id)

  return (
    <div className="container ac-shell">
      <div className="ac-breadcrumb">
        <Link to="/discover#directory"><ArrowLeft size={14} aria-hidden="true" /> Faculty directory</Link>
        <span className="ac-kicker">{sample ? 'Sample faculty profile' : 'Faculty profile'}</span>
      </div>
      <section className="ac-profile-hero" aria-labelledby="ac-person-name">
        <div className="ac-profile-identity">
          <p className="ac-kicker">{profile.department || 'Department unlisted'}</p>
          <h1 className="ac-display ac-person-name" id="ac-person-name">
            {names.length > 0 && <span>{names.join(' ')} </span>}<em>{familyName}</em>
          </h1>
          <p className="ac-designation">{profile.title || 'Faculty member'}</p>
          <div className="ac-identity-meta">
            <div><span className="ac-label">Cabin</span><strong>{profile.room || 'Not listed'}</strong></div>
            <div><span className="ac-label">Availability</span><AvailabilityLabel status={status} /></div>
          </div>
          <a className="ac-text-link" href="#weekly-timetable">View weekly timetable <ArrowDown size={15} aria-hidden="true" /></a>
        </div>
        <PortraitPlate profile={profile} />
      </section>
      {profile.bio && <section className="ac-bio" aria-labelledby="ac-bio-title">
        <h2 className="ac-label" id="ac-bio-title">Biography</h2>
        <p>{profile.bio}</p>
      </section>}
      <AcademicRecord key={profile.id} profile={profile} />
      <WeeklyTimetable profile={profile} />
    </div>
  )
}
