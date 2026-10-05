import { useCallback, useEffect, useState } from 'react'
import { CAMPAIGN_CP2026_SNS_SEP_ID, CAMPAIGN_CP2026_SNS_SEP_SURVEY_QUESTIONS } from '../../../constants/campaignCp2026SnsSep'
import { campaignEntryStatusLabel, snsPostReviewLabel } from '../../../lib/campaignStaffLookup'

function Card({ children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-12">
      {children}
    </section>
  )
}

function adminAuthHeader() {
  const cred = typeof window !== 'undefined' ? sessionStorage.getItem('mm_admin_auth') : ''
  if (!cred) return null
  return { Authorization: `Basic ${cred}` }
}

function surveyLines(answers) {
  if (!answers || typeof answers !== 'object') return []
  const lines = []
  for (const question of CAMPAIGN_CP2026_SNS_SEP_SURVEY_QUESTIONS) {
    if (question.type === 'section') continue
    const raw = answers[question.id]
    if (raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0)) continue
    const values = Array.isArray(raw) ? raw : [raw]
    const labels = question.options
      ? Object.fromEntries(question.options.map((option) => [option.value, option.label]))
      : null
    const text = values.map((value) => (labels && labels[value]) || String(value)).join(', ')
    lines.push({ id: question.id, label: question.label, text })
    if (question.otherFieldId && answers[question.otherFieldId]) {
      lines.push({
        id: question.otherFieldId,
        label: `${question.label}（その他）`,
        text: String(answers[question.otherFieldId]),
      })
    }
  }
  return lines
}

const BUCKETS = [
  { id: 'all', label: 'すべて' },
  { id: 'receipt', label: '書類受付' },
  { id: 'awarded', label: '当選' },
  { id: 'afterwindow', label: '終了後' },
  { id: 'prewindow', label: '期間前' },
  { id: 'staff', label: 'スタッフ' },
]

export default function CampaignEntriesAdminCard() {
  const [bucket, setBucket] = useState('all')
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ status: 'loading', payload: null, error: '' })
  const [detail, setDetail] = useState(null)
  const [csvError, setCsvError] = useState('')

  const load = useCallback(async () => {
    const headers = adminAuthHeader()
    if (!headers) {
      setState({ status: 'error', payload: null, error: 'Admin session missing. Reload and sign in again.' })
      return
    }
    setState((prev) => ({ ...prev, status: 'loading', error: '' }))
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25', bucket })
      const res = await fetch(`/api/admin/campaign-cp2026-entries?${params}`, { headers })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Failed to read entries (${res.status})`)
      setState({ status: 'ready', payload: data, error: '' })
    } catch (err) {
      setState({ status: 'error', payload: null, error: String(err?.message || err) })
    }
  }, [bucket, page])

  useEffect(() => {
    load()
  }, [load])

  const openDetail = async (id) => {
    const headers = adminAuthHeader()
    if (!headers) return
    setDetail({ status: 'loading', entry: null, error: '' })
    try {
      const res = await fetch(`/api/admin/campaign-cp2026-entries?id=${encodeURIComponent(id)}`, { headers })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Failed to read entry (${res.status})`)
      setDetail({ status: 'ready', entry: data.entry, error: '' })
    } catch (err) {
      setDetail({ status: 'error', entry: null, error: String(err?.message || err) })
    }
  }

  const downloadCsv = async () => {
    const headers = adminAuthHeader()
    setCsvError('')
    if (!headers) {
      setCsvError('Admin session missing. Reload and sign in again.')
      return
    }
    const res = await fetch(`/api/admin/campaign-cp2026-entries?format=csv&bucket=${encodeURIComponent(bucket)}`, { headers })
    const type = String(res.headers.get('content-type') || '')
    if (!res.ok || type.includes('application/json')) {
      const data = await res.json().catch(() => ({}))
      setCsvError(data?.error || `CSV was not downloaded (${res.status})`)
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'campaign-cp2026-oct-entries.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const payload = state.payload
  const summary = payload?.summary
  const entries = Array.isArray(payload?.entries) ? payload.entries : []
  const total = Number(payload?.total || 0)
  const pageSize = Number(payload?.pageSize || 25)
  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-800">October applications</h2>
          <p className="mt-1 max-w-3xl text-[10px] leading-relaxed text-slate-400">
            {CAMPAIGN_CP2026_SNS_SEP_ID}. Read only. 書類受付 is eligible paperwork inside the window.
            当選 is rewarded and is a separate final result. A saved post URL is not reviewed and is not a win.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-700"
        >
          CSV
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {BUCKETS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => { setPage(1); setBucket(item.id); setDetail(null) }}
            className={`rounded-full px-3 py-1 text-[11px] ${bucket === item.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {summary ? (
        <p className="mt-3 text-[12px] text-slate-600">
          書類受付 {summary.autoReceipt == null ? '判定不能' : summary.autoReceipt}
          {' · '}
          当選 {summary.awarded == null ? '判定不能' : summary.awarded}
          {summary.legacyRows != null ? ` · 過去ID ${summary.legacyRows}` : ''}
        </p>
      ) : null}
      {csvError ? <p className="mt-2 text-[12px] text-rose-600">{csvError}</p> : null}
      {state.status === 'error' ? <p className="mt-3 text-[12px] text-rose-600">{state.error}</p> : null}
      {state.status === 'loading' ? <p className="py-6 text-xs text-slate-400">Loading applications…</p> : null}

      {state.status === 'ready' ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12px]">
            <thead className="text-[11px] text-slate-400">
              <tr>
                <th className="pb-2 font-medium">Applied</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Survey</th>
                <th className="pb-2 font-medium">Post</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="py-2 text-slate-600">{row.applied_at || '—'}</td>
                  <td className="py-2 text-slate-800">{campaignEntryStatusLabel(row)}</td>
                  <td className="py-2 text-slate-600">{row.survey_completed ? '回答あり' : '未回答'}</td>
                  <td className="py-2">
                    {row.sns_url ? (
                      <a href={row.sns_url} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                        {row.sns_url}
                      </a>
                    ) : '—'}
                    <div className="text-[10px] text-slate-400">{snsPostReviewLabel(row)}</div>
                  </td>
                  <td className="py-2 text-slate-600">{row.emailLookupFailed ? '照会失敗' : (row.email || '—')}</td>
                  <td className="py-2">
                    <button type="button" className="text-sky-700" onClick={() => openDetail(row.id)}>
                      詳細
                    </button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-slate-400">No rows in this filter.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-3 text-[12px] text-slate-500">
            <button type="button" disabled={page <= 1} onClick={() => setPage((n) => Math.max(1, n - 1))} className="disabled:opacity-40">
              前へ
            </button>
            <span>{page} / {pages} · {total}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage((n) => n + 1)} className="disabled:opacity-40">
              次へ
            </button>
          </div>
        </div>
      ) : null}

      {detail?.status === 'loading' ? <p className="mt-4 text-xs text-slate-400">Loading survey…</p> : null}
      {detail?.status === 'error' ? <p className="mt-4 text-[12px] text-rose-600">{detail.error}</p> : null}
      {detail?.status === 'ready' && detail.entry ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <p className="text-[12px] font-medium text-slate-800">
            {campaignEntryStatusLabel(detail.entry)} · {snsPostReviewLabel(detail.entry)}
          </p>
          <p className="mt-1 text-[10px] text-slate-400">アンケート原文は自動検証せず、当選判定にも使いません。</p>
          <dl className="mt-2 space-y-2">
            {surveyLines(detail.entry.survey_answers).map((line) => (
              <div key={line.id}>
                <dt className="text-[11px] text-slate-400">{line.label}</dt>
                <dd className="text-[12px] text-slate-700">{line.text}</dd>
              </div>
            ))}
            {surveyLines(detail.entry.survey_answers).length === 0 ? (
              <p className="text-[12px] text-slate-400">保存された回答はありません。</p>
            ) : null}
          </dl>
        </div>
      ) : null}
    </Card>
  )
}
