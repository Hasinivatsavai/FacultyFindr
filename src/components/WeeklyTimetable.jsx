import { useId, useState } from 'react'
import { useDirectory } from '../data/DirectoryContext'
import { getAvailability, getNextFreePeriod, getNextClass, timetableDays } from '../data/facultyProfiles'
import '../styles/academic.css'

const weekdays = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' }
const dayKeys = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const dateFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
const shades = ['indigo', 'clay', 'sage', 'lavender', 'slate', 'olive']

export function AvailabilityLabel({ status }) {
  return <span className={`ac-status ac-status--${status.kind}`}><i aria-hidden="true" />{status.label}</span>
}

function periodTime(slot) {
  return `${slot.start}–${slot.end}`
}

function ScheduleSummary({ profile, now }) {
  const status = getAvailability(profile, now)
  const free = getNextFreePeriod(profile, now)
  const nextClass = getNextClass(profile, now)
  const inFreePeriod = status.slot?.type === 'free'
  const slotLabel = inFreePeriod && status.kind !== 'free' ? 'Scheduled free period' : status.slot?.label
  return (
    <dl className="ac-summary">
      <div>
        <dt className="ac-label">Current period</dt>
        <dd><AvailabilityLabel status={status} />
          <span>{status.slot ? `${slotLabel} · ${periodTime(status.slot)}` : 'Outside a scheduled period'}</span>
          {status.slot?.room && <small>Room {status.slot.room}</small>}
        </dd>
      </div>
      <div>
        <dt className="ac-label">Next free period</dt>
        <dd><strong>{status.kind === 'free' ? 'Available now' : free ? `${free.day} · ${free.start}` : 'None scheduled'}</strong>
          {free && <span>{free.label} · until {free.end}</span>}
        </dd>
      </div>
      <div>
        <dt className="ac-label">Next class</dt>
        <dd><strong>{nextClass?.label || 'None scheduled'}</strong>
          {nextClass && <span>{nextClass.day} · {periodTime(nextClass)}{nextClass.room && ` · ${nextClass.room}`}</span>}
        </dd>
      </div>
      <div>
        <dt className="ac-label">Permanent cabin</dt>
        <dd><strong>{profile.room || 'Not listed'}</strong>
          {profile.note && <span><small>Faculty note</small> {profile.note}</span>}
        </dd>
      </div>
    </dl>
  )
}

function NowMarker({ time }) {
  return <div className="ac-now-line"><span>Now · {time}</span></div>
}

function DaySchedule({ day, slots, today, clock, colors }) {
  const isToday = day === today
  // Place the live marker alongside the active slot or in the gap before the next one.
  const markerIndex = isToday ? slots.findIndex((slot) => slot.end > clock) : -1
  const showMarker = isToday && clock >= '08:00' && clock < '18:00'
  return (
    <section className={`ac-day${isToday ? ' ac-day--today' : ''}`} aria-label={`${weekdays[day]} schedule`}>
      <h3 className="ac-day-name"><span>{weekdays[day]}</span>{isToday && <small>Today</small>}</h3>
      <div className="ac-day-entries">
        {slots.map((slot, i) => {
          const current = isToday && slot.start <= clock && clock < slot.end
          const before = i === markerIndex && !current && showMarker
          const subjectClass = slot.type === 'class' ? colors.get(slot.label) : slot.type
          return (
            <div key={`${day}-${slot.start}`}>
              {before && <NowMarker time={clock} />}
              <article className={`ac-entry ac-entry--${subjectClass}${current ? ' ac-entry--current' : ''}`} aria-current={current ? 'time' : undefined}>
                <div className="ac-entry-top">
                  <span>{periodTime(slot)}</span>
                  {current && <strong>Now</strong>}
                </div>
                <h4>{slot.label}</h4>
                <p><i aria-hidden="true" />{slot.type === 'class' ? 'Class' : slot.type === 'free' ? 'Free period' : 'Break'}
                  {slot.room && <span> · {slot.room}</span>}
                </p>
              </article>
            </div>
          )
        })}
        {showMarker && markerIndex < 0 && <NowMarker time={clock} />}
        {!slots.length && <p className="ac-day-empty">No scheduled periods</p>}
      </div>
    </section>
  )
}

export default function WeeklyTimetable({ profile }) {
  const { now, timeZone } = useDirectory()
  const today = dayKeys[now.getUTCDay()]
  const clock = timeFormatter.format(now)
  const id = useId()
  const [view, setView] = useState(() => window.matchMedia('(max-width: 760px)').matches ? 'day' : 'week')
  const [chosenDay, setChosenDay] = useState(null)
  const selectedDay = chosenDay || (timetableDays.includes(today) ? today : timetableDays[0])
  const shownDays = view === 'week' ? timetableDays : [selectedDay]
  const colors = new Map()
  for (const day of timetableDays) {
    for (const slot of profile.schedule[day] || []) {
      if (slot.type === 'class' && !colors.has(slot.label)) colors.set(slot.label, shades[colors.size % shades.length])
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} id="weekly-timetable" className="ac-week">
      <header className="ac-week-title">
        <h2 id={`${id}-title`} className="ac-section-title">Weekly <em>schedule.</em></h2>
        <span className="ac-clock"><span className="ac-label">Campus time · {timeZone}</span> {dateFormatter.format(now)} · {clock}</span>
      </header>
      <ScheduleSummary profile={profile} now={now} />
      <div className="ac-schedule-controls">
        <div className="ac-legend" aria-label="Period types">
          <span><i className="ac-legend-class" />Class</span><span><i className="ac-legend-free" />Free period</span><span><i className="ac-legend-break" />Break</span>
        </div>
        <div className="ac-view-switch" role="group" aria-label="Schedule view">
          {['week', 'day'].map((mode) => (
            <button key={mode} type="button" onClick={() => setView(mode)} aria-pressed={view === mode}>{mode}</button>
          ))}
        </div>
      </div>
      {view === 'day' && <div className="ac-day-switch" role="group" aria-label="Choose a weekday">
        {timetableDays.map((day) => <button type="button" aria-label={weekdays[day]} aria-pressed={selectedDay === day}
          key={day} onClick={() => setChosenDay(day)}>{day}</button>)}
      </div>}
      <div className={`ac-schedule ac-schedule--${view}`} aria-label={`Schedule for ${profile.name}`}>
        {shownDays.map((day) => (
          <DaySchedule key={day} day={day} slots={profile.schedule[day] || []} today={today} clock={clock} colors={colors} />
        ))}
      </div>
    </section>
  )
}
