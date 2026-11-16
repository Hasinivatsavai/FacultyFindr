import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { demoAccounts, useDirectory } from '../data/DirectoryContext'
import { freeSlotKey, getAvailability, getNextFreePeriod, timetableDays } from '../data/facultyProfiles'
import '../styles/faculty-space.css'

const academicFields = [
  ['qualifications', 'Educational qualifications'], ['background', 'Academic background'],
  ['phdSpecialisation', 'Doctoral research'], ['experience', 'Teaching experience'],
  ['research', 'Research interests', true], ['publications', 'Publications', true],
  ['projects', 'Projects', true], ['subjects', 'Subjects taught', true],
  ['expertise', 'Technical expertise', true], ['achievements', 'Achievements', true],
]
const identityFields = [
  ['name', 'Full name'], ['title', 'Designation'], ['department', 'Department'],
  ['room', 'Permanent cabin / room'], ['bio', 'Biography'], ['note', 'Activity or location note'],
]
const areas = ['Profile', 'Academic record', 'Timetable', 'Availability']
const typeLabels = { class: 'Class', free: 'Free period', break: 'Break' }

function Arrow({ diagonal = false }) {
  return <svg className="fs-arrow" width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d={diagonal ? 'M5 15 15 5M5 5h10v10' : 'M3 10h14m-6-6 6 6-6 6'}
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

function Feedback({ message }) {
  return <div className={'fs-feedback' + (message?.error ? ' fs-feedback--error' : '')}
    role={message?.error ? 'alert' : 'status'}>{message?.text}</div>
}

function Field({ label, area, ...props }) {
  const Tag = area ? 'textarea' : 'input'
  const id = useId()
  return <div className={'fs-field' + (area ? ' fs-field--area' : '')}>
    <label htmlFor={id}>{label}</label><Tag id={id} {...props} />
  </div>
}

function IdentityCard({ profile }) {
  return <div className="fs-idcard" aria-label={'Faculty identification card for ' + profile.name}>
    <div className="fs-idcard-top"><span>Faculty identification</span><span className="fs-cardstar" aria-hidden="true">✳︎</span></div>
    <div className="fs-cardface">
      <div className="fs-cardportrait" aria-hidden="true">{profile.photo ? <img src={profile.photo} alt="" /> : profile.initials}</div>
      <div className="fs-cardidentity"><strong>{profile.name}</strong><span>{profile.department}</span></div>
    </div>
    <div className="fs-idcard-bottom"><span>{profile.facultyNumber}</span><span>FacultyFindr</span></div>
  </div>
}

function StaffLogin() {
  const { profiles, signIn, signInDemo, signUp, demoEnabled, sessionMessage } = useDirectory()
  const [register, setRegister] = useState(false)
  const [selected, setSelected] = useState(demoAccounts[0].id)
  const [feedback, setFeedback] = useState(null)
  const [working, setWorking] = useState(false)
  const [openingDemo, setOpeningDemo] = useState(false)
  const profile = profiles.find(person => person.id === selected) || profiles[0]

  async function submit(event) {
    event.preventDefault()
    if (working) return
    setFeedback(null)
    setWorking(true)
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try {
      if (register) await signUp(values)
      else await signIn(values.email, values.password)
    } catch (error) { setFeedback({ error: true, text: error.message }) }
    finally { setWorking(false) }
  }

  async function openDemo() {
    if (working) return
    setFeedback(null)
    setWorking(true)
    setOpeningDemo(true)
    try { await signInDemo(selected) }
    catch (error) { setFeedback({ error: true, text: error.message }) }
    finally { setOpeningDemo(false); setWorking(false) }
  }

  return <div className="fs-page fs-login">
    <section className="fs-login-intro">
      <p className="fs-kicker">Faculty space</p>
      <h1>Your faculty<br /><em>workspace.</em></h1>
      <p>Manage your academic profile, teaching schedule and office hours in one place.</p>
      {profile && <div className="fs-idmount"><IdentityCard profile={profile} /></div>}
    </section>
    <section className="fs-login-panel" aria-labelledby="fs-auth-title">
      <div className="fs-mode" aria-label="Faculty account options">
        {[false, true].map(value => <button key={String(value)} type="button" aria-pressed={register === value} disabled={working}
          onClick={() => { setRegister(value); setFeedback(null) }}>{value ? 'Create account' : 'Sign in'}</button>)}
      </div>
      <h2 id="fs-auth-title">{register ? 'Create your profile.' : 'Faculty sign-in.'}</h2>
      <p className="fs-hint">{register ? 'New profiles appear in the shared faculty directory.' : 'Use your faculty account to edit your public profile.'}</p>
      {sessionMessage && <p className="fs-hint" role="status">{sessionMessage}</p>}
      <form className="fs-form" key={String(register)} onSubmit={submit}>
        {register && <div className="fs-fields">
          <Field label="Full name" name="name" autoComplete="name" maxLength={80} required />
          <Field label="Faculty ID" name="facultyNumber" placeholder="E.g. ENG-405" maxLength={32} required />
          <Field label="Department" name="department" list="fs-department-options" maxLength={100} required />
          <Field label="Designation" name="title" placeholder="E.g. Lecturer" maxLength={100} required />
          <Field label="Permanent cabin / room" name="room" maxLength={50} required />
        </div>}
        <Field label="Email address" name="email" type="email" autoComplete="username" maxLength={254} required placeholder="you@university.edu" />
        <Field label="Password" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'}
          minLength={register ? 8 : undefined} maxLength={256} placeholder={register ? 'At least 8 characters' : 'Enter your password'} required />
        <button type="submit" className="fs-primary" disabled={working}>
          {working && !openingDemo ? 'Opening workspace…' : register ? 'Create account' : 'Sign in'} <Arrow />
        </button>
        <Feedback message={feedback} />
      </form>
      {!register && demoEnabled && <div className="fs-demo">
        <p className="fs-kicker">Try a demo profile</p>
        <div className="fs-demo-controls"><label className="fs-field"><span className="fs-sr">Demo faculty member</span>
          <select value={selected} disabled={working} onChange={event => setSelected(event.target.value)}>{demoAccounts.map(account =>
            <option key={account.id} value={account.id}>{profiles.find(p => p.id === account.id)?.name || account.name}</option>)}</select></label>
          <button type="button" className="fs-secondary" disabled={working} onClick={openDemo}>{openingDemo ? 'Opening demo…' : 'Open demo'} <Arrow diagonal /></button></div>
      </div>}
      <DepartmentsList />
    </section>
  </div>
}

function DepartmentsList() {
  const { profiles } = useDirectory()
  return <datalist id="fs-department-options">{[...new Set(profiles.map(profile => profile.department))].sort().map(name =>
    <option key={name} value={name} />)}</datalist>
}

async function photoThumbnail(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG or WebP photograph.')
  }
  if (file.size > 12 * 1024 * 1024) throw new Error('Choose a photograph smaller than 12 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = Math.min(side, 480)
    const context = canvas.getContext('2d')
    context.fillStyle = '#f4f3ee'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally { URL.revokeObjectURL(url) }
}

function PhotoEditor({ profile }) {
  const { updateProfile, saving } = useDirectory()
  const [message, setMessage] = useState(null)
  const [working, setWorking] = useState(false)
  const fileRef = useRef(null)
  const inputId = useId()
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  async function changePhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || working) return
    setWorking(true)
    try {
      const photo = await photoThumbnail(file)
      if (!mounted.current) return
      await updateProfile({ photo })
      setMessage({ text: 'Profile photograph updated.' })
    } catch (error) {
      setMessage({ error: true, text: error.name === 'EncodingError' ? 'This image could not be opened.' : error.message })
    } finally { setWorking(false) }
  }

  async function removePhoto() {
    setWorking(true)
    setMessage(null)
    try { await updateProfile({ photo: '' }); setMessage({ text: 'Profile photograph removed.' }) }
    catch (error) { setMessage({ error: true, text: error.message }) }
    finally { setWorking(false) }
  }

  return <div className="fs-photo">
    <div className="fs-avatar" aria-hidden="true">{profile.photo ? <img src={profile.photo} alt="" /> : profile.initials}</div>
    <div>
      <label htmlFor={inputId} className="fs-kicker">Profile photograph</label>
      <div className="fs-inline-actions">
        <input ref={fileRef} id={inputId} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={changePhoto} />
        <button className="fs-textbtn" type="button" disabled={working || saving} onClick={() => fileRef.current?.click()}>{working ? 'Processing…' : profile.photo ? 'Change photo' : 'Upload photo'} <Arrow diagonal /></button>
        {profile.photo && <button className="fs-textbtn" type="button" disabled={working || saving} onClick={removePhoto}>Remove photo</button>}
      </div>
      <Feedback message={message} />
    </div>
  </div>
}

function ProfileFields({ profile, academic = false }) {
  const { updateProfile, saving } = useDirectory()
  const fields = academic ? academicFields : identityFields
  const [message, setMessage] = useState(null)
  const [draft, setDraft] = useState({})
  const [submitting, setSubmitting] = useState(false)
  async function save(event) {
    event.preventDefault()
    const patch = {}
    for (const [key, , list] of fields) {
      if (!(key in draft)) continue
      const text = draft[key].trim()
      if (['name', 'department', 'title', 'room'].includes(key) && !text) {
        setMessage({ error: true, text: 'Complete your name, designation, department and cabin.' })
        return
      }
      const value = list ? [...new Set(text.split('\n').map(item => item.trim()).filter(Boolean))] : text
      if (JSON.stringify(profile[key]) !== JSON.stringify(value)) patch[key] = value
    }
    if (!Object.keys(patch).length) {
      setDraft({})
      setMessage({ text: 'No changes to save.' })
      return
    }
    setSubmitting(true)
    try {
      await updateProfile(patch)
      setDraft({})
      setMessage({ text: academic ? 'Academic record saved.' : 'Profile saved.' })
    } catch (error) { setMessage({ error: true, text: error.message }) }
    finally { setSubmitting(false) }
  }
  return <section className="fs-edit-section">
    <h2>{academic ? 'Academic record.' : 'Profile details.'}</h2>
    <p className="fs-hint">{academic ? 'For lists, enter one item per line.' : 'These details appear on your public faculty profile.'}</p>
    {!academic && <PhotoEditor profile={profile} />}
    <form onSubmit={save} className="fs-form"><div className="fs-fields">
      {fields.map(([key, label, list]) => <Field key={key} label={label} name={key}
        disabled={submitting} area={academic || ['bio', 'note'].includes(key)} rows={academic ? 3 : 2}
        value={draft[key] ?? (list ? profile[key].join('\n') : profile[key])}
        maxLength={key === 'note' ? 120 : academic || key === 'bio' ? 2500 : 100}
        required={!academic && !['note', 'bio'].includes(key)}
        list={key === 'department' ? 'fs-department-options' : undefined}
        onChange={event => { setDraft(previous => ({ ...previous, [key]: event.target.value })); setMessage(null) }} />)}
    </div>
    <div className="fs-save-line"><button type="submit" className="fs-primary" disabled={saving || submitting}>{submitting ? 'Saving…' : academic ? 'Save academic record' : 'Save profile'} <Arrow /></button>
      <Feedback message={message} /></div></form>
  </section>
}

function PeriodEditor({ edit, onCancel, onSaved }) {
  const { updatePeriod, saving } = useDirectory()
  const [day, setDay] = useState(edit.day)
  const [slot, setSlot] = useState(edit.slot || { start: '09:00', end: '10:00', type: 'class', label: '', room: '' })
  const [message, setMessage] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [submitting, setSubmitting] = useState('')
  function change(key, value) {
    setSlot(previous => ({ ...previous, [key]: value }))
    setMessage(null)
  }
  async function save(event) {
    event.preventDefault()
    setSubmitting('save')
    try {
      await updatePeriod({ day, slot: { ...slot, label: slot.label.trim(), room: (slot.room || '').trim() }, original: edit.slot ? edit : null })
      onSaved(day, 'Period saved.')
    } catch (error) { setMessage({ error: true, text: error.message }) }
    finally { setSubmitting('') }
  }
  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setSubmitting('remove')
    try { await updatePeriod({ original: edit }); onSaved(day, 'Period removed.') }
    catch (error) { setMessage({ error: true, text: error.message }) }
    finally { setSubmitting('') }
  }
  return <form onSubmit={save} className="fs-form fs-period-editor">
    <div className="fs-section-line"><h3>{edit.slot ? 'Edit period' : 'New period'}</h3>
      <button type="button" onClick={onCancel} disabled={saving} className="fs-textbtn">Cancel</button></div>
    <fieldset className="fs-fields fs-edit-fields" disabled={Boolean(submitting)}>
      <label className="fs-field"><span>Day</span><select value={day} onChange={event => setDay(event.target.value)}>
        {timetableDays.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="fs-field"><span>Period type</span><select value={slot.type} onChange={event => change('type', event.target.value)}>
        {Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <Field label="Start time" type="time" min="08:00" max="18:00" required value={slot.start} onChange={event => change('start', event.target.value)} />
      <Field label="End time" type="time" min="08:00" max="18:00" required value={slot.end} onChange={event => change('end', event.target.value)} />
      <Field label={slot.type === 'class' ? 'Subject' : 'Period name'} required value={slot.label} maxLength={90} onChange={event => change('label', event.target.value)} />
      <Field label={slot.type === 'class' ? 'Classroom' : 'Location (optional)'} required={slot.type === 'class'}
        value={slot.room || ''} maxLength={50} onChange={event => change('room', event.target.value)} />
    </fieldset>
    <div className="fs-save-line"><button type="submit" className="fs-primary" disabled={saving || Boolean(submitting)}>{submitting === 'save' ? 'Saving…' : 'Save period'} <Arrow /></button>
      {edit.slot && <button className="fs-textbtn fs-remove" type="button" disabled={saving || Boolean(submitting)} onClick={remove}>{submitting === 'remove' ? 'Removing…' : confirmDelete ? 'Confirm removal' : 'Remove period'}</button>}</div>
    <Feedback message={message} />
  </form>
}

function ScheduleEditor({ profile }) {
  const { now, timeZone, saving } = useDirectory()
  const [day, setDay] = useState(timetableDays[now.getUTCDay() - 1] || 'Mon')
  const [edit, setEdit] = useState(null)
  const [message, setMessage] = useState(null)
  const slots = profile.schedule[day] || []
  function startEdit(slot = null) { setEdit({ day, slot }); setMessage(null) }
  function chooseDay(value) { setDay(value); setEdit(null); setMessage(null) }

  return <section className="fs-edit-section">
    <div className="fs-section-line"><h2>Weekly timetable.</h2>
      <Link to={'/timetable?faculty=' + profile.id} className="fs-textbtn">Student view <Arrow diagonal /></Link></div>
    <p className="fs-hint">Teaching, free periods and breaks repeat weekly. Campus time · {timeZone}.</p>
    <div className="fs-days" aria-label="Choose a weekday">
      {timetableDays.map(value => <button key={value} type="button" disabled={saving} onClick={() => chooseDay(value)}
        aria-pressed={day === value}>{value}</button>)}
    </div>
    {!edit ? <>
      <ul className="fs-period-list" aria-label={day + ' periods'}>
        {slots.map(slot => <li key={slot.start}>
          <span className="fs-period-time">{slot.start}–{slot.end}</span>
          <div><small className={'fs-type fs-type--' + slot.type}>{typeLabels[slot.type]}</small><strong>{slot.label}</strong>
            {slot.room && <span className="fs-hint">{slot.room}</span>}</div>
          <button type="button" aria-label={'Edit ' + slot.label + ' at ' + slot.start} className="fs-textbtn" onClick={() => startEdit(slot)}>Edit <Arrow diagonal /></button>
        </li>)}
      </ul>
      {!slots.length && <p className="fs-empty">No periods scheduled for {day}.</p>}
      <button type="button" className="fs-primary" onClick={() => startEdit()}>Add period <span aria-hidden="true">＋</span></button>
    </> : <PeriodEditor edit={edit} onCancel={() => setEdit(null)} onSaved={(nextDay, text) => {
      setDay(nextDay); setEdit(null); setMessage({ text })
    }} />}
    <Feedback message={message} />
  </section>
}

function AvailabilityEditor({ profile }) {
  const { now, updateAvailability, updateProfile, saving } = useDirectory()
  const { slot, label, kind } = getAvailability(profile, now)
  const next = getNextFreePeriod(profile, now)
  const available = slot?.type === 'free'
  const [choice, setChoice] = useState(null)
  const [draftNote, setDraftNote] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)

  async function save(event) {
    event.preventDefault()
    setSubmitting(true)
    try {
      const note = (draftNote ?? profile.note).trim()
      if (available && choice && choice !== label) await updateAvailability(choice, note, freeSlotKey(now, slot))
      else if (note !== profile.note) await updateProfile({ note })
      else {
        setMessage({ text: 'No changes to save.' })
        return
      }
      setChoice(null); setDraftNote(null)
      setMessage({ text: available ? 'Availability and note saved.' : 'Location note saved.' })
    } catch (error) { setMessage({ error: true, text: error.message }) }
    finally { setSubmitting(false) }
  }
  return <section className="fs-edit-section">
    <h2>Current availability.</h2>
    <div className="fs-current"><div><p className="fs-kicker">Your public status</p>
      <strong className={'fs-status fs-status--' + kind}><i />{label}</strong></div>
      <div>{slot ? <><strong>{slot.label}</strong><small>{slot.start}–{slot.end}{slot.room ? ' · ' + slot.room : ''}</small></>
        : <strong>Outside scheduled periods</strong>}</div>
    </div>
    <p className="fs-hint">{available ? 'Set your status until this free period ends at ' + slot.end + '.'
      : 'Status changes are available during scheduled free periods.'}{!available && next ? ' Next free period: ' + next.day + ', ' + next.start + '–' + next.end + '.' : ''}</p>
    <form className="fs-form" onSubmit={save}>
      <fieldset className="fs-status-choices" disabled={!available || submitting}><legend>Free-period status</legend>
        {['Free', 'Busy', 'Break'].map(status => <label key={status}><input type="radio" name="availability"
          checked={available && (choice || label) === status} value={status} onChange={() => { setChoice(status); setMessage(null) }} />{status}</label>)}
      </fieldset>
      <Field disabled={submitting} area rows={3} label="Activity or location note" maxLength={120} value={draftNote ?? profile.note}
        onChange={event => { setDraftNote(event.target.value); setMessage(null) }} />
      <div className="fs-save-line"><button type="submit" className="fs-primary" disabled={submitting || saving}>{submitting ? 'Saving…' : available ? 'Save availability' : 'Save note'} <Arrow /></button><Feedback message={message} /></div>
    </form>
  </section>
}

function Workspace({ profile }) {
  const { signOut, now, saving, timeZone, sessionMessage } = useDirectory()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  async function leave() {
    setSignOutError('')
    setSigningOut(true)
    try { await signOut() }
    catch (error) { setSignOutError(error.message) }
    finally { setSigningOut(false) }
  }
  const [active, setActive] = useState(areas[0])
  const currentSlot = getAvailability(profile, now).slot
  return <div className="fs-page fs-workspace">
    <header className="fs-dashboard-heading">
      <div><p className="fs-kicker">Faculty space / {profile.facultyNumber}</p><h1>Your <em>workspace.</em></h1>
        <p>{profile.name} <span aria-hidden="true">·</span> {profile.department}</p></div>
      <div className="fs-workspace-actions"><Link className="fs-secondary" to={'/faculty/' + profile.id}>Public profile <Arrow diagonal /></Link>
        <button className="fs-textbtn" type="button" onClick={leave} disabled={saving || signingOut}>{signingOut ? 'Signing out…' : 'Sign out'} <Arrow /></button></div>
    </header>
    {signOutError && <p role="alert" className="fs-feedback fs-feedback--error">{signOutError}</p>}
    {sessionMessage && <p role="status" className="fs-feedback">{sessionMessage}</p>}
    <div className="fs-workgrid">
      <aside className="fs-side"><nav aria-label="Workspace sections">{areas.map(area =>
        <button type="button" key={area} aria-pressed={active === area} onClick={() => setActive(area)}>
          {area}<Arrow /></button>)}</nav><p className="fs-local-caption">Campus time<br />{timeZone}</p></aside>
      <div className="fs-dashboard-content">
        <div hidden={active !== 'Profile'}><ProfileFields profile={profile} /></div>
        <div hidden={active !== 'Academic record'}><ProfileFields profile={profile} academic /></div>
        <div hidden={active !== 'Timetable'}><ScheduleEditor profile={profile} /></div>
        <div hidden={active !== 'Availability'}><AvailabilityEditor
          key={now.toISOString().slice(0, 10) + (currentSlot?.start || '') + (currentSlot?.end || '')} profile={profile} /></div>
      </div>
    </div>
    <DepartmentsList />
  </div>
}

export default function FacultySpacePage() {
  const { currentFaculty } = useDirectory()
  return currentFaculty ? <Workspace key={currentFaculty.id} profile={currentFaculty} /> : <StaffLogin />
}
