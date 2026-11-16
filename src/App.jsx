import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { DirectoryProvider } from './data/DirectoryContext'
import CustomCursor from './components/CustomCursor'
import ScrollReset from './components/ScrollReset'
import Layout from './components/Layout'
import OpeningExperience from './components/OpeningExperience'
import HomePage from './pages/HomePage'
import TimetablePage from './pages/TimetablePage'
import FacultySpacePage from './pages/FacultySpacePage'
import FacultyProfilePage from './pages/FacultyProfilePage'

function Experience() {
  const location = useLocation()
  const navigate = useNavigate()
  const [entered, setEntered] = useState(() => {
    try { return sessionStorage.getItem('facultyfindr-entered') === 'yes' }
    catch { return false }
  })
  const showOpening = location.pathname === '/opening' || (location.pathname === '/' && !entered && !location.hash)
  function enter() {
    try { sessionStorage.setItem('facultyfindr-entered', 'yes') } catch { /* The directory also works in memory. */ }
    setEntered(true)
    navigate('/discover', {replace:true})
  }
  return <>
    <CustomCursor />
    {showOpening ? <OpeningExperience onEnter={enter} /> : <Layout>
      <div key={location.pathname} className="route-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/discover" element={<HomePage />} />
          <Route path="/departments" element={<Navigate to="/discover#departments" replace />} />
          <Route path="/faculty/:facultyId" element={<FacultyProfilePage />} />
          <Route path="/timetable" element={<TimetablePage />} />
          <Route path="/faculty-space" element={<FacultySpacePage />} />
          <Route path="*" element={<section className="container missing-page"><p className="section-kicker">404</p><h1>Page unavailable.</h1><button className="primary-action" onClick={() => navigate('/discover')}>Open the directory →</button></section>} />
        </Routes>
      </div>
    </Layout>}
    <ScrollReset />
  </>
}
export default function App() {
  return <BrowserRouter><DirectoryProvider><Experience /></DirectoryProvider></BrowserRouter>
}
