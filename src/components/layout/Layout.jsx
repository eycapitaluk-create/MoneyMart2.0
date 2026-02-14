import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import ChatBot from '../ChatBot'

const THEME_STORAGE_KEY = 'mm_theme'

export default function Layout({ session = null, authReady = false }) {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (saved === 'dark') return true
      if (saved === 'light') return false
    }
    // Default to light mode unless user explicitly chose dark.
    return false
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    }
  }, [darkMode])

  const toggleDarkMode = () => setDarkMode((prev) => !prev)

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950 font-sans">
      <Navbar darkMode={darkMode} onToggleDarkMode={toggleDarkMode} session={session} authReady={authReady} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ChatBot />
    </div>
  )
}
