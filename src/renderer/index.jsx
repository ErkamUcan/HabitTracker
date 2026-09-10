import React from 'react'
import { createRoot } from 'react-dom/client'
import { StudyProvider } from './context/StudyContext'
import App from './App'
import FloatingWidget from './components/FloatingWidget'
import './styles/global.css'

const isWidget = new URLSearchParams(window.location.search).get('widget') === 'true'

if (isWidget) {
  createRoot(document.getElementById('root')).render(
    <StudyProvider>
      <FloatingWidget />
    </StudyProvider>
  )
} else {
  createRoot(document.getElementById('root')).render(<App />)
}
