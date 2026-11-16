import { TextDecoder } from 'node:util'

const COOKIE = 'facultyfindr_session'
const SESSION_SECONDS = 7 * 24 * 60 * 60
const GENERAL_BODY_LIMIT = 64 * 1024
const PROFILE_BODY_LIMIT = 2 * 1024 * 1024
const THROTTLE_WINDOW = 15 * 60 * 1000
const MAX_TRACKED_ADDRESSES = 10000
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

function failure(status, message) {
  return Object.assign(new Error(message), { status })
}

function sendJson(req, res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  res.end(req.method === 'HEAD' ? undefined : body)
}

function sessionToken(req) {
  const part = (req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(COOKIE + '='))
  return part ? part.slice(COOKIE.length + 1) : ''
}

function sessionCookie(req, token) {
  const secure = req.socket.encrypted ? '; Secure' : ''
  return COOKIE + '=' + token + '; Path=/api; HttpOnly; SameSite=Lax; Max-Age=' + (token ? SESSION_SECONDS : 0) + secure
}

function requireLocalMutation(req) {
  const origin = req.headers.origin
  const fetchSite = req.headers['sec-fetch-site']
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throw failure(403, 'Open FacultyFindr on the same origin to make changes.')
  }
  if (origin !== undefined) {
    const scheme = req.socket.encrypted ? 'https:' : 'http:'
    if (origin !== scheme + '//' + req.headers.host) {
      throw failure(403, 'Open FacultyFindr on the same origin to make changes.')
    }
  }
  // The mandatory JSON media type also prevents simple cross-origin form posts.
  const mime = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
  if (mime !== 'application/json') throw failure(415, 'Send a JSON object with Content-Type application/json.')
  if (req.headers['content-encoding'] && req.headers['content-encoding'].toLowerCase() !== 'identity') {
    throw failure(415, 'Send an uncompressed JSON request.')
  }
}

async function readJson(req, maxSize) {
  if (Number(req.headers['content-length']) > maxSize) throw failure(413, 'The submitted data is too large.')
  const chunks = []
  let size = 0
  // Keep the socket writable long enough to return 413 for oversized chunked bodies.
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length
    if (size > maxSize) throw failure(413, 'The submitted data is too large.')
    chunks.push(chunk)
  }
  let data
  try { data = JSON.parse(utf8Decoder.decode(Buffer.concat(chunks, size))) }
  catch { throw failure(400, 'The request must contain valid JSON.') }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw failure(400, 'Send the fields as a JSON object.')
  return data
}

function createThrottle() {
  const records = new Map()
  let nextPurge = 0
  return (address, group) => {
    const now = Date.now()
    if (now >= nextPurge) {
      for (const [key, record] of records) if (record.until <= now) records.delete(key)
      nextPurge = now + 60000
    }
    const key = group + ':' + address
    let record = records.get(key)
    if (!record || record.until <= now) {
      if (!record && records.size >= MAX_TRACKED_ADDRESSES) {
        throw Object.assign(failure(429, 'Too many account requests. Try again in a minute.'), { retry: 60 })
      }
      record = { attempts: 0, until: now + THROTTLE_WINDOW }
      records.set(key, record)
    }
    const maximum = group === 'signup' ? 10 : 30
    if (record.attempts >= maximum) {
      throw Object.assign(failure(429, 'Too many account requests. Please try again later.'), {
        retry: Math.max(1, Math.ceil((record.until - now) / 1000)),
      })
    }
    record.attempts++
  }
}

function allowMethod(res, allowed) {
  res.setHeader('Allow', allowed)
  throw failure(405, 'This method is unavailable for this endpoint.')
}

async function servePhoto(store, req, res, url, rawId) {
  if (req.method !== 'GET' && req.method !== 'HEAD') allowMethod(res, 'GET, HEAD')
  let id
  try { id = decodeURIComponent(rawId) }
  catch { throw failure(400, 'Invalid photograph address.') }
  const photo = await store.photo(id)
  const requested = url.searchParams.get('v')
  if (!photo || (requested !== null && requested !== photo.etag.slice(1, -1))) {
    throw failure(404, 'This photograph is unavailable.')
  }
  // Even versioned photos must be revalidated. A removed/replaced photo may
  // never be returned from a fresh browser cache under its old URL.
  res.setHeader('Cache-Control', 'public, no-cache, must-revalidate')
  res.setHeader('ETag', photo.etag)
  res.setHeader('Content-Type', 'image/jpeg')
  const candidates = (req.headers['if-none-match'] || '').split(',').map(s => s.trim().replace(/^W\//, ''))
  if (candidates.includes(photo.etag) || candidates.includes('*')) {
    res.writeHead(304)
    res.end()
    return
  }
  res.setHeader('Content-Length', photo.bytes.length)
  res.writeHead(200)
  res.end(req.method === 'HEAD' ? undefined : photo.bytes)
}

const mutations = new Map([
  ['/api/auth/signup', 'POST'],
  ['/api/auth/login', 'POST'],
  ['/api/auth/demo', 'POST'],
  ['/api/auth/logout', 'POST'],
  ['/api/me/profile', 'PATCH'],
  ['/api/me/period', 'POST'],
  ['/api/me/availability', 'POST'],
])

export function createApi(store, { timeZone, demoEnabled }) {
  const throttle = createThrottle()

  async function state(token) {
    return {
      profiles: await store.listProfiles(), currentFacultyId: token ? (await store.session(token)) || null : null,
      timeZone, serverTime: new Date().toISOString(), demoEnabled,
    }
  }

  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    try {
      const url = new URL(req.url, 'http://localhost')
      const path = url.pathname
      const token = sessionToken(req)
      if (path === '/api/state') {
        if (req.method !== 'GET' && req.method !== 'HEAD') allowMethod(res, 'GET, HEAD')
        sendJson(req, res, 200, await state(token))
        return
      }
      const photoRoute = /^\/api\/photos\/([^/]+)$/.exec(path)
      if (photoRoute) {
        await servePhoto(store, req, res, url, photoRoute[1])
        return
      }

      const expectedMethod = mutations.get(path)
      if (!expectedMethod) throw failure(404, 'Unknown API endpoint.')
      if (req.method !== expectedMethod) allowMethod(res, expectedMethod)
      requireLocalMutation(req)
      if (path === '/api/auth/demo' && !demoEnabled) throw failure(403, 'Sample sign-in is disabled.')
      const own = path.startsWith('/api/me/')
      const expectedOwner = req.headers['x-faculty-id']
      const checkOwner = own || (path === '/api/auth/logout' && expectedOwner !== undefined)
      const facultyId = checkOwner && token ? await store.session(token) : null
      if (own && !facultyId) throw failure(401, 'Sign in to edit your faculty record.')
      if (checkOwner && expectedOwner !== undefined && expectedOwner !== facultyId) {
        throw failure(409, 'The signed-in account changed. Refresh this page before making changes.')
      }

      if (path === '/api/auth/signup' || path === '/api/auth/login' || path === '/api/auth/demo') {
        throttle(req.socket.remoteAddress, path === '/api/auth/signup' ? 'signup' : 'login')
      }
      const data = await readJson(req, path === '/api/me/profile' ? PROFILE_BODY_LIMIT : GENERAL_BODY_LIMIT)
      if (own && (await store.session(token)) !== facultyId) {
        throw failure(401, 'Your session ended. Sign in again to save changes.')
      }
      let nextToken = token
      switch (path) {
        case '/api/auth/signup': nextToken = await store.signup(data); break
        case '/api/auth/login': nextToken = await store.login(data); break
        case '/api/auth/demo': nextToken = await store.demo({ id: data.id }); break
        case '/api/auth/logout':
          if (token) await store.logout(token)
          nextToken = ''
          break
        case '/api/me/profile': await store.patchProfile(facultyId, data); break
        case '/api/me/period': await store.updatePeriod(facultyId, data); break
        case '/api/me/availability': await store.updateAvailability(facultyId, data); break
      }
      if (token && nextToken && token !== nextToken) await store.logout(token)
      if (!own) res.setHeader('Set-Cookie', sessionCookie(req, nextToken))
      sendJson(req, res, 200, await state(nextToken))
    } catch (error) {
      if (!req.complete && !req.destroyed) req.resume()
      if (res.headersSent || res.destroyed) return
      const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500
      if (error.retry) res.setHeader('Retry-After', error.retry)
      if (status >= 500) console.error('FacultyFindr API request failed:', error.message)
      let message = error.message
      if (status >= 500) message = status === 503 ? 'The directory is busy. Please retry your change.' : 'The server could not complete this request.'
      sendJson(req, res, status, { error: message })
    }
  }
}
