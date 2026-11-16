import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
}

export async function serveApp(req, res, directory, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end()
    return
  }
  // Known client routes share the HTML shell. Missing assets keep their 404.
  const page = !extname(pathname) && !/^\/(?:assets|art|fonts|textures)(?:\/|$)/.test(pathname)
  const path = resolve(directory, page ? 'index.html' : '.' + pathname)
  if (!path.startsWith(directory + sep) || pathname.includes('\\')) {
    res.writeHead(404).end()
    return
  }
  let info
  try {
    info = await stat(path)
  } catch (error) {
    if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error
  }
  if (!info?.isFile()) { res.writeHead(404).end(); return }
  res.writeHead(200, {
    'Content-Type': types[extname(path)] || 'application/octet-stream',
    'Content-Length': info.size,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  if (req.method === 'HEAD') { res.end(); return }
  await pipeline(createReadStream(path), res)
}
