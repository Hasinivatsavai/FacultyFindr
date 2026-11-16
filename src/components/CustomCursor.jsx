import { useEffect, useRef } from 'react'

export default function CustomCursor() {
  const ref = useRef(null)
  useEffect(() => {
    const eligible = matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)')
    const node = ref.current
    let frame = 0, magnet = null
    let x = 0, y = 0, tx = 0, ty = 0
    function resetMagnet() {
      if (!magnet) return
      magnet.style.removeProperty('--mx')
      magnet.style.removeProperty('--my')
      magnet = null
    }
    function hide() {
      node.classList.remove('is-active')
      resetMagnet()
      cancelAnimationFrame(frame)
      frame = 0
    }
    function step() {
      x += (tx - x) * .34
      y += (ty - y) * .34
      node.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'
      frame = Math.abs(tx - x) + Math.abs(ty - y) > .5 ? requestAnimationFrame(step) : 0
    }
    function move(event) {
      if (!eligible.matches || event.pointerType === 'touch') return hide()
      const target = event.target instanceof Element ? event.target : null
      const button = target?.closest('[data-magnetic]')
      if (button !== magnet) resetMagnet()
      if (button) {
        magnet = button
        const box = button.getBoundingClientRect()
        button.style.setProperty('--mx', ((event.clientX - box.left - box.width / 2) * .06) + 'px')
        button.style.setProperty('--my', ((event.clientY - box.top - box.height / 2) * .12) + 'px')
      }
      if (!target?.closest('.contact-art,.home-art__hands')) {
        node.classList.remove('is-active')
        return
      }
      tx = event.clientX
      ty = event.clientY
      if (!node.classList.contains('is-active')) { x = tx; y = ty }
      node.classList.add('is-active')
      if (!frame) frame = requestAnimationFrame(step)
    }
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', hide)
    window.addEventListener('blur', hide)
    eligible.addEventListener('change', hide)
    return () => {
      hide()
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', hide)
      window.removeEventListener('blur', hide)
      eligible.removeEventListener('change', hide)
    }
  }, [])
  return <span aria-hidden="true" ref={ref} className="art-cursor"><i /></span>
}
