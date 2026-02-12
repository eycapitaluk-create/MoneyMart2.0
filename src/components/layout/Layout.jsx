import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import ChatBot from '../ChatBot'

export default function Layout({ session = null, authReady = false }) {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
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
