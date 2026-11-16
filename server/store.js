import { createHash, randomBytes, randomUUID, scrypt, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { promisify } from 'node:util'
import { facultyProfiles, freeSlotKey, getAvailability, timetableDays } from '../src/data/facultyProfiles.js'
import { campusDate } from '../src/data/campusTime.js'
import { bodyFields, emailAddress, periodFields, problem, profilePatch, stringValue, thumbnail, weekDay } from './validation.js'

const derive = promisify(scrypt)
const passwordOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const sessionLifetime = 7 * 24 * 60 * 60 * 1000
const demoPassword = 'FacultyDemo1!'
const digest = value => createHash('sha256').update(value).digest('hex')
const invalidLogin = () => problem(401, 'The email and password do not match an available faculty account.')

function passwordInput(value, registering) {
  if (typeof value !== 'string' || value.length > 256 || (registering && value.length < 8)) {
    throw problem(400, 'Choose a password of 8 to 256 characters.')
  }
  return value
}

function initials(name) {
  const words = name.trim().split(/\s+/u)
  return (Array.from(words[0])[0] + (words.length > 1 ? Array.from(words.at(-1))[0] : '')).toUpperCase()
}

function newProfile(input) {
  const name = stringValue(input.name, 'full name', 80)
  return {
    id: 'faculty-' + randomUUID(), name, initials: initials(name),
    facultyNumber: stringValue(input.facultyNumber, 'faculty ID', 32).toUpperCase(),
    department: stringValue(input.department, 'department', 100),
    title: stringValue(input.title, 'designation', 100), room: stringValue(input.room, 'cabin', 50),
    color: '#a5afbd', bio: '', note: '', qualifications: '', background: '', experience: '',
    phdSpecialisation: '', research: [], publications: [], projects: [], achievements: [],
    subjects: [], expertise: [], schedule: {},
  }
}

function databaseError(error) {
  if (error.status) return error
  if (error.code === 'ERR_SQLITE_ERROR' && [5, 6].includes(error.errcode)) {
    return problem(503, 'The directory is busy. Please retry your change.')
  }
  return Object.assign(new Error('The directory could not complete this operation.', { cause: error }), { status: 500 })
}

export function openStore(path, { demoEnabled = true, now = () => new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone } = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;')
  const statements = new Map()
  function sql(query) {
    if (!statements.has(query)) statements.set(query, db.prepare(query))
    return statements.get(query)
  }

  function atomic(operation) {
    try {
      db.exec('BEGIN IMMEDIATE')
      try {
        const result = operation()
        db.exec('COMMIT')
        return result
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    } catch (error) { throw databaseError(error) }
  }

  function addAccount(profile, email, salt, hash, demo) {
    sql('INSERT INTO profiles (id, faculty_number, record) VALUES (?, ?, ?)').run(
      profile.id, profile.facultyNumber, JSON.stringify(profile),
    )
    sql('INSERT INTO accounts (profile_id, email, salt, password_hash, is_demo) VALUES (?, ?, ?, ?, ?)').run(
      profile.id, email, salt, hash, Number(demo),
    )
  }

  try {
    atomic(() => {
      const { user_version: schema } = sql('PRAGMA user_version').get()
      if (schema === 1) return
      if (schema !== 0) throw problem(500, 'This database uses an unsupported schema version.')
      db.exec(`
        CREATE TABLE profiles (
          id TEXT PRIMARY KEY NOT NULL, faculty_number TEXT NOT NULL UNIQUE COLLATE NOCASE, record TEXT NOT NULL
        );
        CREATE TABLE accounts (
          profile_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          email TEXT NOT NULL UNIQUE COLLATE NOCASE, salt BLOB NOT NULL, password_hash BLOB NOT NULL,
          is_demo INTEGER NOT NULL DEFAULT 0 CHECK(is_demo IN (0, 1))
        );
        CREATE TABLE sessions (
          token_hash TEXT PRIMARY KEY NOT NULL,
          profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL
        );
        CREATE INDEX sessions_expiry ON sessions(expires_at);
        CREATE TABLE photos (
          profile_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          jpeg BLOB NOT NULL, version TEXT NOT NULL
        );
        PRAGMA user_version=1;
      `)
      for (const profile of facultyProfiles) {
        const salt = randomBytes(16)
        const hash = scryptSync(demoPassword, salt, 32, passwordOptions)
        addAccount(profile, profile.name.split(' ')[0].toLowerCase() + '@faculty.demo', salt, hash, true)
      }
    })
    // Disable old seed sessions immediately if the same database is reopened without demo access.
    if (!demoEnabled) {
      sql('DELETE FROM sessions WHERE profile_id IN (SELECT profile_id FROM accounts WHERE is_demo = 1)').run()
    }
    sql('DELETE FROM sessions WHERE expires_at <= ?').run(now().getTime())
  } catch (error) { db.close(); throw error }

  function issueSession(id) {
    const token = randomBytes(32).toString('hex')
    const time = now().getTime()
    sql('DELETE FROM sessions WHERE expires_at <= ?').run(time)
    sql('INSERT INTO sessions (token_hash, profile_id, expires_at) VALUES (?, ?, ?)').run(
      digest(token), id, time + sessionLifetime,
    )
    return token
  }

  function record(id) {
    const row = sql('SELECT record FROM profiles WHERE id = ?').get(id)
    if (!row) throw problem(404, 'This faculty profile could not be found.')
    return JSON.parse(row.record)
  }

  function save(profile) {
    sql('UPDATE profiles SET record = ? WHERE id = ?').run(JSON.stringify(profile), profile.id)
  }

  return {
    listProfiles() {
      return sql(`SELECT p.record, f.version FROM profiles p LEFT JOIN photos f ON p.id = f.profile_id
          ORDER BY p.rowid`).all().map(row => {
        const profile = JSON.parse(row.record)
        return { ...profile, photo: row.version ? '/api/photos/' + encodeURIComponent(profile.id) + '?v=' + row.version : '' }
      })
    },

    session(token) {
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null
      const row = sql(`SELECT s.profile_id FROM sessions s JOIN accounts a ON a.profile_id=s.profile_id
        WHERE s.token_hash=? AND s.expires_at>? AND (a.is_demo=0 OR ?=1)`).get(digest(token), now().getTime(), Number(demoEnabled))
      return row?.profile_id ?? null
    },

    async signup(input) {
      bodyFields(input, ['name', 'facultyNumber', 'department', 'title', 'room', 'email', 'password'])
      const profile = newProfile(input)
      const email = emailAddress(input.email)
      const password = passwordInput(input.password, true)
      const salt = randomBytes(16)
      const hash = await derive(password, salt, 32, passwordOptions)
      return atomic(() => {
        if (sql('SELECT 1 FROM accounts WHERE email = ?').get(email)) throw problem(409, 'This email already has a faculty account.')
        if (sql('SELECT 1 FROM profiles WHERE faculty_number = ?').get(profile.facultyNumber)) throw problem(409, 'This faculty ID is already in the directory.')
        addAccount(profile, email, salt, hash, false)
        return issueSession(profile.id)
      })
    },

    async login(input) {
      bodyFields(input, ['email', 'password'])
      const email = emailAddress(input.email)
      const password = passwordInput(input.password, false)
      const row = sql('SELECT * FROM accounts WHERE email = ?').get(email)
      const candidate = await derive(password, row?.salt ?? Buffer.alloc(16), 32, passwordOptions)
      if (!row || !timingSafeEqual(candidate, row.password_hash) || (row.is_demo && !demoEnabled)) throw invalidLogin()
      return atomic(() => issueSession(row.profile_id))
    },

    demo(input) {
      bodyFields(input, ['id'])
      if (!demoEnabled) throw problem(403, 'Demo sign-in is disabled on this server.')
      const id = stringValue(input.id, 'demo profile ID', 100)
      if (!sql('SELECT 1 FROM accounts WHERE profile_id=? AND is_demo=1').get(id)) {
        throw problem(404, 'Choose one of the sample faculty profiles.')
      }
      return atomic(() => issueSession(id))
    },

    logout(token) {
      if (typeof token === 'string') sql('DELETE FROM sessions WHERE token_hash = ?').run(digest(token))
    },

    patchProfile(id, fields) {
      const patch = profilePatch(fields)
      const picture = 'photo' in fields ? thumbnail(fields.photo) : undefined
      atomic(() => {
        const profile = Object.assign(record(id), patch)
        profile.initials = initials(profile.name)
        save(profile)
        if (picture === null) sql('DELETE FROM photos WHERE profile_id=?').run(id)
        if (picture) {
          sql(`INSERT INTO photos(profile_id, jpeg, version) VALUES(?, ?, ?)
            ON CONFLICT(profile_id) DO UPDATE SET jpeg=excluded.jpeg, version=excluded.version`).run(id, picture.bytes, picture.version)
        }
      })
    },

    updatePeriod(id, input) {
      bodyFields(input, ['day', 'slot', 'original'])
      const original = input.original
      if (!original && !input.slot) throw problem(400, 'Choose a period to edit or remove.')
      if (original) {
        bodyFields(original, ['day', 'slot'])
        weekDay(original.day)
        periodFields(original.slot)
      }
      const day = input.slot ? weekDay(input.day) : null
      const slot = input.slot ? periodFields(input.slot) : null
      atomic(() => {
        const profile = record(id)
        const schedule = profile.schedule
        if (original) {
          const periods = schedule[original.day] ?? []
          const previous = periods.find(period => period.start === original.slot.start)
          if (!previous || ['start', 'end', 'type', 'label', 'room'].some(key => (previous[key] ?? '') !== (original.slot[key] ?? ''))) {
            throw problem(409, 'This period changed. Refresh the timetable and reopen the editor.')
          }
          const date = campusDate(now(), timeZone)
          if (timetableDays[date.getUTCDay() - 1] === original.day && profile.availabilityOverride?.key === freeSlotKey(date, previous)) {
            delete profile.availabilityOverride
          }
          schedule[original.day] = periods.filter(period => period !== previous)
        }
        if (slot) {
          const periods = schedule[day] ?? []
          if (periods.some(period => period.start < slot.end && period.end > slot.start)) throw problem(409, 'This time overlaps another period on ' + day + '.')
          schedule[day] = [...periods, slot].sort((a, b) => a.start.localeCompare(b.start))
        }
        save(profile)
      })
    },

    updateAvailability(id, input) {
      bodyFields(input, ['status', 'note', 'slotKey'])
      if (!['Free', 'Busy', 'Break'].includes(input.status)) throw problem(400, 'Choose Free, Busy or Break.')
      const note = stringValue(input.note, 'location note', 120, false)
      atomic(() => {
        const profile = record(id)
        const date = campusDate(now(), timeZone)
        const { slot } = getAvailability(profile, date)
        if (slot?.type !== 'free') throw problem(409, 'Availability can only be set during a scheduled free period.')
        const key = freeSlotKey(date, slot)
        if (input.slotKey !== undefined && key !== input.slotKey) throw problem(409, 'This free period changed. Refresh your availability.')
        profile.availabilityOverride = { key, status: input.status }
        profile.note = note
        save(profile)
      })
    },

    photo(id) {
      const row = sql('SELECT jpeg, version FROM photos WHERE profile_id=?').get(id)
      return row ? { bytes: Buffer.from(row.jpeg), etag: '"' + row.version + '"' } : null
    },

    close() { db.close() },
  }
}
