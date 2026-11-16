import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, MousePointer2 } from 'lucide-react'
import Brand from './Brand'
import LocalClock from './LocalClock'
import PixelHands from './PixelHands'
import './OpeningExperience.css'

const editions = [
  { value: 'graphite', name: 'Graphite' },
  { value: 'cobalt', name: 'Blueprint' },
  { value: 'carbon', name: 'Carbon' },
]

export default function OpeningExperience({ onEnter }) {
  const [variant, setVariant] = useState('graphite')
  const [exiting, setExiting] = useState(false)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])

  function enter() {
    if (exiting) return
    setExiting(true)
    timer.current = setTimeout(onEnter, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 680)
  }

  return (
    <div className={'opening opening--' + variant + (exiting ? ' is-leaving' : '')}>
      <a className="skip-link" href="#enter-button">Skip to enter</a>
      <header className="opening-header container">
        <Brand to="/opening" />
        <div className="opening-header__right">
          <LocalClock />
          <button className="intro-skip" onClick={onEnter}>Skip intro <ArrowUpRight size={14} /></button>
        </div>
      </header>
      <main className="installation container">
        <section className="opening-intro" aria-labelledby="opening-title">
          <div>
            <div className="section-kicker"><span className="signal-mark" /> The academic connection</div>
            <h1 id="opening-title">Where knowledge<br /><em>meets connection<span>.</span></em></h1>
          </div>
          <div className="opening-action">
            <p>Find the people behind the lectures, the rooms they teach in, and the time to connect.</p>
            <button type="button" id="enter-button" data-magnetic className="primary-action" onClick={enter} disabled={exiting}>
              Enter FacultyFindr <ArrowRight size={18} strokeWidth={1.7} />
            </button>
          </div>
        </section>
        <figure className="contact-plate">
          <div className="plate-field">
            <div className="plate-grid" aria-hidden="true" />
            <div className="plate-ruler plate-ruler--top" aria-hidden="true" />
            <div className="plate-ruler plate-ruler--bottom" aria-hidden="true" />
            <i aria-hidden="true" className="crop crop--tl" /><i aria-hidden="true" className="crop crop--tr" />
            <i aria-hidden="true" className="crop crop--bl" /><i aria-hidden="true" className="crop crop--br" />
            <div className="plate-id"><span className="plate-index">FIG. 01</span><span>Contact study</span></div>
            <div className="contact-art"><div className="engraving">
              <PixelHands variant={variant} exiting={exiting} />
              <div className="axis-marker" aria-hidden="true"><i /><b /></div>
            </div></div>
            <div className="plate-caption" aria-hidden="true"><span className="wave-mark" /> <span>15,417 marks</span></div>
            <div className="plate-scale" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          </div>
          <figcaption className="plate-controls">
            <span className="motion-hint"><MousePointer2 size={14} strokeWidth={1.6} /><span className="pointer-hint">Move across the hands to illuminate</span><span className="touch-hint">Touch the hands to illuminate</span></span>
            <div className="plate-variants" role="group" aria-label="Artwork rendering">
              {editions.map(({ value, name }) => <button key={value} type="button" aria-pressed={value === variant} onClick={() => setVariant(value)}><i className={'chip-' + value} />{name}</button>)}
            </div>
          </figcaption>
        </figure>
      </main>
      <footer className="opening-foot container"><span>Student directory <b>/</b> Open access</span><Link to="/faculty-space">Faculty sign-in <ArrowUpRight size={12}/></Link></footer>
    </div>
  )
}
