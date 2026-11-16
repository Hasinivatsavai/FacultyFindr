import { createServer } from 'node:http'
import { access, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serveApp } from './static.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = resolve(root, 'dist')

async function start() {
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (!(major >= 24 || (major === 22 && minor >= 12))) {
    throw new Error('FacultyFindr needs Node.js 22.12+ in the 22.x line, or Node.js 24+. Open a new terminal after installing it.')
  }
  const dev = process.argv.includes('--dev')
  const port = Number(process.env.PORT || 5173)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.')
  const timeZone = new Intl.DateTimeFormat('en', {
    timeZone: process.env.CAMPUS_TIME_ZONE || Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).resolvedOptions().timeZone
  const demoEnabled = process.env.ENABLE_DEMO !== '0'
  const filename = resolve(root, process.env.FACULTYFINDR_DB || 'data/facultyfindr.sqlite')
  if (!dev) {
    try { await access(join(dist, 'index.html')) }
    catch { throw new Error('The website build is missing. Run npm ci and npm run build, then npm start.') }
  }
  await mkdir(dirname(filename), { recursive: true, mode: 0o700 })
  const { openStore } = await import('./store.js')
  const { createApi } = await import('./api.js')
  const store = openStore(filename, { timeZone, demoEnabled })
  const api = createApi(store, { timeZone, demoEnabled })
  let vite
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]'])
  const http = createServer(async (req, res) => {
    try {
      const authority = (req.headers.host || '').toLowerCase()
      if (!allowedHosts.has(authority.replace(/:\d+$/, ''))) {
        res.writeHead(403).end('Use the localhost address printed in the terminal.')
        return
      }
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        await api(req, res)
      } else if (vite) {
        vite.middlewares(req, res)
      } else {
        let pathname
        try { pathname = decodeURIComponent(url.pathname) }
        catch { res.writeHead(400).end(); return }
        if (pathname.includes('\0')) { res.writeHead(400).end(); return }
        await serveApp(req, res, dist, pathname)
      }
    } catch (error) {
      if (res.destroyed || error.code === 'ERR_STREAM_PREMATURE_CLOSE') return
      console.error('Request failed:', error.message)
      if (!res.headersSent) res.writeHead(500)
      res.end()
    }
  })
  try {
    if (dev) {
      const { createServer: createVite } = await import('vite')
      vite = await createVite({
        root,
        server: {
          middlewareMode: true,
          hmr: { server: http },
          // The development file server must never serve the database or server source.
          fs: { strict: true, deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/server/**', '**/data/*.sqlite*', '**/*.sqlite*', '**/*.db', '**/*.db-*', filename, filename + '-*'] },
        },
      })
    }
    await new Promise((ok, fail) => {
      http.once('error', fail)
      http.listen(port, '127.0.0.1', () => { http.off('error', fail); ok() })
    })
  } catch (error) {
    await vite?.close()
    store.close()
    if (error.code === 'EADDRINUSE') throw new Error('Port ' + port + ' is in use. Stop the previous server with Ctrl+C, or choose a different PORT.')
    throw error
  }
  console.log('FacultyFindr is running at http://localhost:' + port)
  console.log('Database: ' + filename + '\nCampus time: ' + timeZone)
  let stopping = false
  async function stop() {
    if (stopping) return
    stopping = true
    const closed = new Promise(done => http.close(done))
    await vite?.close()
    http.closeIdleConnections()
    await closed
    store.close()
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

start().catch(error => { console.error(error.message); process.exitCode = 1 })
