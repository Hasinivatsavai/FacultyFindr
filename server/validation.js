import { createHash } from 'node:crypto'
import { timetableDays, workingHours } from '../src/data/facultyProfiles.js'

export function problem(status, message) {
  return Object.assign(new Error(message), { status })
}

export function bodyFields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw problem(400, 'Provide a JSON object.')
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw problem(400, 'This request contains an unsupported field.')
  }
  return value
}

export function stringValue(value, name, limit, required = true) {
  if (typeof value !== 'string' || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw problem(400, 'Enter a valid ' + name + ' (up to ' + limit + ' characters).')
  }
  const text = value.trim()
  if (required && !text) throw problem(400, 'Enter a ' + name + '.')
  return text
}

export function emailAddress(value) {
  const address = stringValue(value, 'email address', 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(address)) throw problem(400, 'Enter a valid email address.')
  return address
}

const identityLimits = { name: 100, title: 100, department: 100, room: 100 }
const narrativeLimits = { bio: 2500, qualifications: 2500, background: 2500, phdSpecialisation: 2500, experience: 2500, note: 120 }
const listFields = ['research', 'publications', 'projects', 'subjects', 'expertise', 'achievements']

export function profilePatch(body) {
  bodyFields(body, [...Object.keys(identityLimits), ...Object.keys(narrativeLimits), ...listFields, 'photo'])
  const values = {}
  for (const [key, value] of Object.entries(body)) {
    if (key === 'photo') continue
    if (listFields.includes(key)) {
      if (!Array.isArray(value) || value.length > 250 || value.some(item => typeof item !== 'string') || value.join('\n').length > 2500) {
        throw problem(400, 'Enter a list of up to 2,500 characters for ' + key + '.')
      }
      values[key] = [...new Set(value.map(item => stringValue(item, key, 2500, false)).filter(Boolean))]
    } else {
      values[key] = stringValue(value, key, identityLimits[key] ?? narrativeLimits[key], key in identityLimits)
    }
  }
  return values
}

// Browser thumbnails are re-encoded as JPEG before upload. Check the image frame,
// dimensions, segment lengths and scan boundary before it can enter the photo table.
function isThumbnail(bytes) {
  if (bytes.length < 25 || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) return false
  let frame = false
  let at = 2
  while (at + 4 <= bytes.length) {
    if (bytes[at++] !== 0xff) return false
    while (bytes[at] === 0xff) at++
    const marker = bytes[at++]
    if (at + 2 > bytes.length) return false
    const size = bytes.readUInt16BE(at)
    if (size < 2 || at + size > bytes.length - 2) return false
    if (marker === 0xc0 || marker === 0xc2) {
      if (size < 11 || bytes[at + 2] !== 8) return false
      const height = bytes.readUInt16BE(at + 3)
      const width = bytes.readUInt16BE(at + 5)
      const components = bytes[at + 7]
      if (width < 1 || height < 1 || width > 480 || height > 480 ||
          ![1, 3].includes(components) || size !== 8 + components * 3) return false
      frame = true
    }
    if (marker === 0xda) return frame && size >= 8 && at + size < bytes.length - 2
    at += size
  }
  return false
}

export function thumbnail(data) {
  if (data === '') return null
  const prefix = 'data:image/jpeg;base64,'
  if (typeof data !== 'string' || data.length > 720000 || !data.startsWith(prefix)) {
    throw problem(400, 'Upload a JPEG thumbnail of up to 480 by 480 pixels.')
  }
  const encoded = data.slice(prefix.length)
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw problem(400, 'The JPEG encoding is invalid.')
  }
  const bytes = Buffer.from(encoded, 'base64')
  if (!isThumbnail(bytes)) throw problem(400, 'The JPEG thumbnail is invalid or exceeds 480 pixels.')
  return { bytes, version: createHash('sha256').update(bytes).digest('hex') }
}

export function weekDay(value) {
  if (!timetableDays.includes(value)) throw problem(400, 'Choose a teaching day from Monday to Friday.')
  return value
}

export function periodFields(value) {
  bodyFields(value, ['start', 'end', 'type', 'label', 'room'])
  const { type, start, end } = value
  const isTime = time => typeof time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)
  if (!isTime(start) || !isTime(end) || start >= end || start < workingHours.start || end > workingHours.end) {
    throw problem(400, 'Choose a start before the end, between 08:00 and 18:00.')
  }
  if (!['class', 'free', 'break'].includes(type)) throw problem(400, 'Choose a class, free period or break.')
  return {
    type, start, end,
    label: stringValue(value.label, 'period name', 90),
    room: stringValue(value.room ?? '', 'classroom', 50, type === 'class'),
  }
}
