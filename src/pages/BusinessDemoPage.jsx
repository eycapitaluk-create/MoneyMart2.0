import { useEffect, useMemo, useState } from 'react'
import AdvisorShell from '../components/advisorDemo/Shell'
import AdvisorDashboard from '../components/advisorDemo/Dashboard'
import ClientList from '../components/advisorDemo/ClientList'
import ClientWorkspace from '../components/advisorDemo/ClientWorkspace'
import CalendarPage from '../components/advisorDemo/Calendar'
import MarketPage from '../components/advisorDemo/Market'
import FundPage from '../components/advisorDemo/Fund'
import StockPage from '../components/advisorDemo/Stock'
import InsightsPage from '../components/advisorDemo/Insights'
import SettingsPage from '../components/advisorDemo/Settings'
import HelpPage from '../components/advisorDemo/Help'
import MyPage from '../components/advisorDemo/MyPage'
import { DemoBanner } from '../components/advisorDemo/ui'
import { buildAdvisorDemoBundle } from '../components/advisorDemo/mockFeatured'
import { buildCalendarMeetings } from '../components/advisorDemo/mockCatalog'

function normalizeMeetings(raw, calendarExtra) {
  const fromBundle = (raw || []).map((m, i) => ({
    id: m.id || `m-${i}`,
    dateKey: m.dateKey || m.date || '',
    time: m.time || '10:00',
    title: m.title || m.type || 'ミーティング',
    clientId: m.clientId,
    clientName: m.clientName || '',
    mode: m.mode || (m.status === '完了' ? 'Office' : 'Online'),
    kind: m.kind || (String(m.type || '').includes('ヒアリング') ? 'hearing' : 'review'),
    advisorName: m.advisorName || 'Justin',
  }))
  return [...fromBundle, ...(calendarExtra || [])]
}

export default function BusinessDemoPage() {
  const data = useMemo(() => buildAdvisorDemoBundle(), [])
  const calendarMeetings = useMemo(() => {
    const extra = buildCalendarMeetings(data.clients)
    return normalizeMeetings(data.meetings, extra)
  }, [data])
  const [view, setView] = useState('dashboard')
  const [clientId, setClientId] = useState(data.featuredId)
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [bannerDismissed, setBannerDismissed] = useState(() => localStorage.getItem('mm_demo_banner_dismissed') === '1')

  useEffect(() => {
    document.title = 'MoneyMart Business — Demo'
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2800)
  }

  const openClient = (c) => {
    setClientId(c.id)
    setView('client')
    setSearch('')
  }

  const pickClientContext = (c) => {
    setClientId(c.id)
    showToast(`対象顧客: ${c.name}`)
  }

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return data.clients.filter((c) =>
      [c.name, c.kana, c.email, c.id].some((x) => String(x || '').toLowerCase().includes(q)),
    )
  }, [data.clients, search])

  const client = data.clients.find((c) => c.id === clientId) || data.clients[0]

  const onNavigate = (id) => {
    if (id === 'personal') {
      showToast('デモ: 個人モードへの切替は無効です')
      return
    }
    if (id === 'client' && !clientId) setClientId(data.featuredId)
    setView(id)
  }

  let body = null
  if (view === 'dashboard') body = <AdvisorDashboard data={data} onOpenClient={openClient} onToast={showToast} />
  else if (view === 'clients') body = <ClientList clients={data.clients} onOpen={openClient} onToast={showToast} />
  else if (view === 'client') body = <ClientWorkspace key={client?.id} client={client} onToast={showToast} />
  else if (view === 'calendar') {
    body = (
      <CalendarPage
        meetings={calendarMeetings}
        clients={data.clients}
        onOpenClient={openClient}
        onToast={showToast}
      />
    )
  }
  else if (view === 'market') body = <MarketPage />
  else if (view === 'funds') body = (
    <FundPage client={client} clients={data.clients} onPickClient={pickClientContext} onToast={showToast} />
  )
  else if (view === 'stocks') body = (
    <StockPage client={client} clients={data.clients} onPickClient={pickClientContext} onToast={showToast} />
  )
  else if (view === 'insights') body = <InsightsPage onToast={showToast} />
  else if (view === 'settings') body = <SettingsPage onToast={showToast} />
  else if (view === 'help') body = <HelpPage onToast={showToast} />
  else if (view === 'mypage') body = <MyPage advisor={data.advisor} onToast={showToast} />
  else body = <AdvisorDashboard data={data} onOpenClient={openClient} onToast={showToast} />

  return (
    <>
      <AdvisorShell
        view={view}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        search={search}
        onSearch={setSearch}
        searchResults={searchResults}
        onPickClient={openClient}
        advisor={data.advisor}
        toast={toast}
      >
        {body}
      </AdvisorShell>
      <DemoBanner
        dismissed={bannerDismissed}
        onDismiss={() => {
          localStorage.setItem('mm_demo_banner_dismissed', '1')
          setBannerDismissed(true)
        }}
      />
    </>
  )
}
