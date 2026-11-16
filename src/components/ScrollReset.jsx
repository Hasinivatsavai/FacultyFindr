import { useLayoutEffect, useRef } from 'react'
import { useDirectory } from '../data/DirectoryContext'
import { useLocation, useNavigationType } from 'react-router-dom'

export default function ScrollReset() {
  const { pathname, hash } = useLocation()
  const { ready } = useDirectory()
  const navigation = useNavigationType()
  const previous = useRef(null)
  useLayoutEffect(() => {
    const changed = previous.current !== pathname
    const first = previous.current === null
    previous.current = pathname
    if (hash) {
      const target = document.getElementById(hash.slice(1))
      target?.scrollIntoView()
      if (target?.matches('[tabindex]')) target.focus({ preventScroll: true })
    } else if (changed && (navigation !== 'POP' || first)) {
      window.scrollTo(0, 0)
      if (!first) document.querySelector('main')?.focus({ preventScroll: true })
    }
  }, [hash, pathname, navigation, ready])
  return null
}
