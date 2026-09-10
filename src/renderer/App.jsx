import React, { useState } from 'react'
import { LangProvider } from './context/LangContext'
import { StudyProvider } from './context/StudyContext'
import Sidebar from './components/Sidebar'
import StudyMiniWidget from './components/StudyMiniWidget'
import Today from './pages/Today'
import Week from './pages/Week'
import DayView from './pages/DayView'
import MyHabits from './pages/MyHabits'
import KPSS from './pages/KPSS'
import KPSSVideos from './pages/KPSSVideos'
import Streaks from './pages/Streaks'
import Settings from './pages/Settings'
import Study from './pages/Study'
import Practice from './pages/Practice'
import MockExams from './pages/MockExams'
import './styles/global.css'

export default function App() {
  const [page, setPage] = useState('today')

  const pages = {
    today:    <Today onNavigate={setPage} />,
    week:     <Week />,
    day:      <DayView />,
    habits:   <MyHabits />,
    kpss:     <KPSS />,
    videos:   <KPSSVideos />,
    streaks:  <Streaks />,
    study:    <Study />,
    mock:     <MockExams />,
    practice: <Practice />,
    settings: <Settings />
  }

  return (
    <LangProvider>
      <StudyProvider>
        <div className="app-layout">
          <Sidebar currentPage={page} onNavigate={setPage} />
          <main className="app-main" style={{ position: 'relative' }}>
            <StudyMiniWidget onNavigateStudy={() => setPage('study')} />
            {pages[page] ?? pages.today}
          </main>
        </div>
      </StudyProvider>
    </LangProvider>
  )
}
