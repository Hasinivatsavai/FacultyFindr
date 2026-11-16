import { useEffect, useRef, useState } from 'react'
import './PixelHands.css'

const IMAGE = `${import.meta.env.BASE_URL}art/connection-plate.webp`
const ART_WIDTH = 2400
const ART_HEIGHT = 798
const clamp = (n) => Math.max(0, Math.min(1, n))

const vertexSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = vec2(a_position.x * .5 + .5, .5 - a_position.y * .5);
    gl_Position = vec4(a_position, 0., 1.);
  }
`

// The hand plate retains thousands of individually engraved marks. Sample it
// locally, leaving the matte surround and typography outside the GPU layer.
const fragmentSource = `
  precision highp float;
  uniform sampler2D u_plate;
  uniform vec2 u_view;
  uniform vec2 u_frame;
  uniform vec2 u_pointer;
  uniform float u_presence;
  uniform float u_time;
  uniform float u_exit;
  uniform float u_motion;
  uniform int u_mode;
  varying vec2 v_uv;

  float noise(vec2 p) {
    return fract(sin(dot(mod(p, 128.), vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 pos = v_uv * u_view;
    vec2 uv = (pos - (u_view - u_frame) * .5) / u_frame;
    float side = step(.501, uv.x);
    // Both wrists stay at the edge while the fingertips breathe closer.
    float taper = 1. - smoothstep(0., .5, abs(uv.x - .5));
    uv.x += (side * 2. - 1.) * .00145 * sin(u_time * .59) * taper * u_motion;
    uv.y += .0019 * sin(u_time * .46 + side * 1.7) * taper * u_motion;

    vec2 offset = pos - u_pointer;
    float distanceToCursor = length(offset);
    float radius = clamp(u_frame.x * .12, 55., 158.);
    float near = (1. - smoothstep(0., radius, distanceToCursor)) * u_presence;
    float wave = .5 + .5 * cos(distanceToCursor * .082 - u_time * 2.7);
    uv -= offset / max(distanceToCursor, 1.) * near * (1.3 + wave * 2.3) / u_frame * u_motion;
    uv.x += (side * 2. - 1.) * .014 * u_exit * taper;

    vec2 cell = floor(uv * vec2(400., 133.));
    float grain = noise(cell);
    vec2 drift = vec2(grain - .5, noise(cell.yx + 19.) - .5);
    uv += drift * u_exit * u_exit * vec2(.028, .10);
    vec4 ink = texture2D(u_plate, uv);
    float inBounds = step(0., uv.x) * step(0., uv.y) *
                     (1. - step(1., uv.x)) * (1. - step(1., uv.y));
    float blueInk = smoothstep(.1, .35, ink.b - ink.r);
    vec3 cobalt = vec3(.125, .29, .97);
    vec3 color = ink.rgb;
    if (u_mode == 1) {
      color = mix(vec3(.06, .20, .57) + .28 * ink.rgb, vec3(.22, .43, .96), blueInk);
      cobalt = vec3(.18, .44, 1.);
    }
    if (u_mode == 2) {
      color = mix(vec3(.86, .88, .89) - .4 * ink.rgb, vec3(.40, .61, 1.), blueInk);
      cobalt = vec3(.39, .70, 1.);
    }
    float flicker = .5 + .5 * sin(grain * 13. + u_time * 1.5);
    float signal = near * (.48 + .27 * wave + .25 * grain);
    signal = max(signal, (1. - smoothstep(.0, .087, abs(uv.x - .501))) * .22 * flicker * u_motion);
    float energize = max(signal, u_exit * (.48 + .5 * grain));
    color = mix(color, cobalt, energize);
    float alpha = ink.a * inBounds * (1. - u_exit * u_exit * .96);
    gl_FragColor = vec4(color, alpha);
  }
`

function linkProgram(gl) {
  const program = gl.createProgram()
  const shaders = []
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
      const shader = gl.createShader(type)
      shaders.push(shader)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader unavailable.')
      gl.attachShader(program, shader)
    }
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Artwork renderer unavailable.')
    return program
  } catch (error) {
    gl.deleteProgram(program)
    throw error
  } finally {
    shaders.forEach((shader) => gl.deleteShader(shader))
  }
}

function CanvasLayer({ variant, compact, exiting }) {
  const canvasRef = useRef(null)
  const [contextVersion, setContextVersion] = useState(0)
  const settings = useRef({ variant, exiting })
  const repaint = useRef(null)

  useEffect(() => {
    settings.current = { variant, exiting }
    repaint.current?.()
  }, [variant, exiting])

  useEffect(() => {
    const canvas = canvasRef.current
    const surface = canvas.parentElement
    const gl = canvas.getContext('webgl', {
      alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power',
    })
    if (!gl) return undefined

    let program
    try { program = linkProgram(gl) } catch { return undefined }
    gl.useProgram(program)

    const quad = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const attribute = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(attribute)
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0)

    const names = ['plate', 'view', 'frame', 'pointer', 'presence', 'time', 'exit', 'motion', 'mode']
    const locations = Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, 'u_' + name)]))
    const texture = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.uniform1i(locations.plate, 0)

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pointer = { x: -500, y: -500, targetX: -500, targetY: -500, strength: 0, active: false }
    let contextInvalidated = false
    let ready = false
    let visible = true
    let disposed = false
    let frameRequest = 0
    let wakeTimer = 0
    let lastPaint = 0
    let departure = 0
    let width = 0
    let height = 0

    function schedule() {
      clearTimeout(wakeTimer)
      if (disposed || !ready || !visible || document.hidden || frameRequest) return
      frameRequest = requestAnimationFrame(paint)
    }

    function paint(now) {
      frameRequest = 0
      if (disposed || !ready || !visible || document.hidden || !width || !height) return
      const dt = Math.min(65, now - lastPaint || 16)
      lastPaint = now
      const blend = motion.matches ? 1 : 1 - Math.exp(-dt / 58)
      pointer.x += (pointer.targetX - pointer.x) * blend
      pointer.y += (pointer.targetY - pointer.y) * blend
      pointer.strength += (Number(pointer.active) - pointer.strength) * blend
      departure = settings.current.exiting ? clamp(departure + dt / 670) : 0

      // A narrow viewport crops the outer wrist, never the central gesture.
      const ratio = Math.max(width / ART_WIDTH, height / ART_HEIGHT)
      const mode = settings.current.variant
      gl.uniform2f(locations.view, width, height)
      gl.uniform2f(locations.frame, ART_WIDTH * ratio, ART_HEIGHT * ratio)
      gl.uniform2f(locations.pointer, pointer.x, pointer.y)
      gl.uniform1f(locations.presence, pointer.strength)
      gl.uniform1f(locations.time, motion.matches ? 0 : (now * .001) % 3200)
      gl.uniform1f(locations.motion, motion.matches ? 0 : 1)
      gl.uniform1f(locations.exit, motion.matches ? 0 : departure)
      gl.uniform1i(locations.mode, mode === 'carbon' ? 2 : Number(mode === 'cobalt'))
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      canvas.dataset.ready = 'true'

      if (!motion.matches) {
        const active = pointer.active || pointer.strength > .01 || settings.current.exiting
        wakeTimer = window.setTimeout(schedule, active ? 15 : compact ? 140 : 75)
      }
    }

    function size() {
      const rect = surface.getBoundingClientRect()
      width = rect.width
      height = rect.height
      const dpr = Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2)
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      gl.viewport(0, 0, canvas.width, canvas.height)
      schedule()
    }

    function track(event) {
      if (event.pointerType === 'touch' && event.type === 'pointermove' && !event.buttons) return
      const box = canvas.getBoundingClientRect()
      pointer.targetX = event.clientX - box.left
      pointer.targetY = event.clientY - box.top
      if (!pointer.active && pointer.strength < .02) {
        pointer.x = pointer.targetX
        pointer.y = pointer.targetY
      }
      pointer.active = true
      schedule()
    }

    function release(event) {
      if (event.type === 'pointerup' && event.pointerType === 'mouse') return
      pointer.active = false
      schedule()
    }

    function onContextLost(event) {
      event.preventDefault()
      contextInvalidated = true
      ready = false
      delete canvas.dataset.ready
      clearTimeout(wakeTimer)
      cancelAnimationFrame(frameRequest)
      frameRequest = 0
    }

    const resizeObserver = new ResizeObserver(size)
    resizeObserver.observe(surface)
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      schedule()
    })
    visibilityObserver.observe(surface)
    motion.addEventListener('change', schedule)
    document.addEventListener('visibilitychange', schedule)
    surface.addEventListener('pointerdown', track)
    surface.addEventListener('pointermove', track)
    for (const event of ['pointerleave', 'pointercancel', 'pointerup']) surface.addEventListener(event, release)
    const onContextRestored = () => setContextVersion((v) => v + 1)
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)
    const img = new Image()
    img.onload = () => {
      if (disposed || gl.isContextLost()) return
      // A power-of-two texture supports mipmaps even on WebGL 1 devices.
      const source = document.createElement('canvas')
      const max = gl.getParameter(gl.MAX_TEXTURE_SIZE)
      source.width = Math.min(2048, max)
      source.height = Math.min(1024, max)
      const ctx = source.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0, source.width, source.height)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
      gl.generateMipmap(gl.TEXTURE_2D)
      ready = true
      size()
    }
    img.src = IMAGE
    repaint.current = schedule

    return () => {
      disposed = true
      repaint.current = null
      clearTimeout(wakeTimer)
      cancelAnimationFrame(frameRequest)
      delete canvas.dataset.ready
      img.onload = null
      resizeObserver.disconnect()
      visibilityObserver.disconnect()
      motion.removeEventListener('change', schedule)
      document.removeEventListener('visibilitychange', schedule)
      surface.removeEventListener('pointerdown', track)
      surface.removeEventListener('pointermove', track)
      for (const event of ['pointerleave', 'pointercancel', 'pointerup']) surface.removeEventListener(event, release)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      if (!contextInvalidated) {
        gl.deleteBuffer(quad)
        gl.deleteTexture(texture)
        gl.deleteProgram(program)
      }
    }
  }, [compact, contextVersion])

  return <canvas className="connection-canvas" ref={canvasRef} aria-hidden="true" />
}

export default function PixelHands({ variant = 'graphite', compact = false, exiting = false, className = '' }) {
  return (
    <div className={`pixel-hands ${compact ? 'pixel-hands--compact' : ''} ${className}`} data-ink={variant} data-exiting={exiting || undefined}
      role="img" aria-label="Two human hands, engraved in thousands of tiny pixels and glyphs, reaching fingertip to fingertip.">
      <CanvasLayer variant={variant} compact={compact} exiting={exiting} />
      <img className="connection-still" src={IMAGE} alt="" width={ART_WIDTH} height={ART_HEIGHT}
        draggable="false" loading={compact ? 'lazy' : 'eager'} />
    </div>
  )
}
