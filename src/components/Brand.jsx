import { Link } from 'react-router-dom'

export function Mark() {
  return (
    <svg className="brand-mark" aria-hidden="true" viewBox="0 0 30 30" fill="currentColor">
      <path d="M2 12h4V8h4V4h7v5h-5v4H8v4H2zM4 20h6v-4h4v-4h6V8h6v6h-5v4h-5v5h-6v4H4zM20 22h5v5h-5z" />
    </svg>
  )
}

export default function Brand({ to = '/discover' }) {
  return <Link to={to} className="brand" aria-label="FacultyFindr home"><Mark /><span>FacultyFindr<span className="brand-period">.</span></span></Link>
}
