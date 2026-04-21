import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDailyBriefArchive } from '../lib/newsManualClient'
import { supabase } from '../lib/supabase'

const formatDateTime = (value) => {
  if (!value) return '--'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '--'
  return d.toLocaleString('ja-JP')
}

export default function BriefArchivePage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toneFilter, setToneFilter] = useState('all')
  const [daysFilter, setDaysFilter] = useState('all')

  const trackBriefEvent = async (eventName, eventMeta = {}) => {
    try {
      const { data } = await supabase.auth.getUser()
      if (!data?.user?.id) return
      await supabase.from('user_activity_events').insert({
        user_id: data.user.id,
        event_name: eventName,
        event_meta: eventMeta,
      })
    } catch {
      // no-op
    }
  }

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const data = await fetchDailyBriefArchive(45)
        if (!alive) return
        setRows(Array.isArray(data) ? data : [])
      } catch (err) {
        if (!alive) return
        setRows([])
        setError(err?.message || 'ブリーフ履歴の読み込みに失敗しました。')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    trackBriefEvent('brief_archive_viewed', { source: 'brief_archive_page' })
  }, [])

  useEffect(() => {
    trackBriefEvent('brief_archive_filter_changed', { tone: toneFilter, days: daysFilter })
  }, [toneFilter, daysFilter])

  const filteredRows = useMemo(() => {
    const now = Date.now()
    return rows.filter((row) => {
      if (toneFilter !== 'all' && String(row?.tone || '') !== toneFilter) return false
      if (daysFilter === 'all') return true
      const days = Number(daysFilter)
      if (!Number.isFinite(days) || days <= 0) return true
      const ts = new Date(row?.published_at || row?.updated_at || 0).getTime()
      if (!Number.isFinite(ts) || ts <= 0) return false
      return ts >= (now - (days * 24 * 60 * 60 * 1000))
    })
  }, [rows, toneFilter, daysFilter])

  const toneOptions = useMemo(() => {
    const values = new Set(rows.map((row) => String(row?.tone || '中立')))
    return ['all', ...Array.from(values)]
  }, [rows])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">日本経済ブリーフ（履歴）</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Source: MoneyMart Research Desk</p>
          </div>
          <Link
            to="/mypage"
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900"
          >
            マイページへ
          </Link>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-sm text-slate-500 dark:text-slate-400">
            読み込み中...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-600">
            {error}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
              <select
                value={toneFilter}
                onChange={(e) => setToneFilter(e.target.value)}
                className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                {toneOptions.map((tone) => (
                  <option key={tone} value={tone}>
                    {tone === 'all' ? 'トーン: 全体' : `トーン: ${tone}`}
                  </option>
                ))}
              </select>
              <select
                value={daysFilter}
                onChange={(e) => setDaysFilter(e.target.value)}
                className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="all">期間: 全体</option>
                <option value="7">期間: 7日</option>
                <option value="30">期間: 30日</option>
                <option value="90">期間: 90日</option>
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 md:ml-auto">
                {filteredRows.length} 件
              </p>
            </div>
            {filteredRows.map((row) => (
              <article key={row.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-300">{row.tone || '中立'}</span>
                  <span className="text-[11px] text-slate-400">{formatDateTime(row.published_at || row.updated_at)}</span>
                </div>
                <h2 className="text-sm md:text-base font-black text-slate-900 dark:text-white">{row.title || '-'}</h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">{row.description || ''}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-400">Source: {row.source || 'MoneyMart News Desk'}</p>
                  {row?.url ? (
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => trackBriefEvent('brief_archive_item_clicked', { id: row.id, source: row.source || 'unknown' })}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 hover:underline"
                    >
                      原文を見る
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
            {filteredRows.length === 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-sm text-slate-500 dark:text-slate-400">
                条件に一致するブリーフがありません。
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
