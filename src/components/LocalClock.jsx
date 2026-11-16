import { useEffect, useState } from 'react'
const formatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export default function LocalClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(timer)
  }, [])
  return <span className="local-clock"><i /> Local time <time dateTime={now.toISOString()}>{formatter.format(now)}</time></span>
}
