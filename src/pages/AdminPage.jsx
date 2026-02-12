import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { fetchAdminReports, updateCommentStatus, updatePostStatus, updateReportStatus } from '../lib/loungeApi'

export default function AdminPage() {
  const [formData, setFormData] = useState({
    name: '',
    link: '',
    description: '',
    spec: '',
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [reports, setReports] = useState([])
  const [reportStatusFilter, setReportStatusFilter] = useState('submitted')
  const [reportLoading, setReportLoading] = useState(false)

  const loadReports = async (status = reportStatusFilter) => {
    setReportLoading(true)
    try {
      const data = await fetchAdminReports(status, 300)
      setReports(data)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || '通報データの取得に失敗しました。' })
    } finally {
      setReportLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const { error } = await supabase.from('products').insert([{
        name: formData.name,
        link: formData.link || null,
        description: formData.description || null,
        spec: formData.spec || null,
      }])
      if (error) throw error
      setMessage({ type: 'success', text: '商品を登録しました。' })
      setFormData({ name: '', link: '', description: '', spec: '' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message || '登録に失敗しました。Supabaseの設定を確認してください。' })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateReportStatus = async (id, status) => {
    try {
      await updateReportStatus(id, status)
      await loadReports(reportStatusFilter)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || '通報ステータス更新に失敗しました。' })
    }
  }

  const handleModerateTarget = async (report) => {
    try {
      if (report.target_type === 'post' && report.target_post_id) {
        await updatePostStatus(report.target_post_id, 'hidden')
      } else if (report.target_type === 'comment' && report.target_comment_id) {
        await updateCommentStatus(report.target_comment_id, 'hidden')
      }
      await updateReportStatus(report.id, 'resolved')
      await loadReports(reportStatusFilter)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'モデレーション処理に失敗しました。' })
    }
  }

  const handleRestoreTarget = async (report) => {
    try {
      if (report.target_type === 'post' && report.target_post_id) {
        await updatePostStatus(report.target_post_id, 'published')
      } else if (report.target_type === 'comment' && report.target_comment_id) {
        await updateCommentStatus(report.target_comment_id, 'published')
      }
      await updateReportStatus(report.id, 'rejected')
      await loadReports(reportStatusFilter)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || '復旧処理に失敗しました。' })
    }
  }

  useEffect(() => {
    loadReports('submitted')
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">商品管理</h1>
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                商品名 *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                placeholder="商品名を入力"
              />
            </div>
            <div>
              <label htmlFor="link" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                リンク
              </label>
              <input
                id="link"
                name="link"
                type="url"
                value={formData.link}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                placeholder="https://..."
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                説明
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                placeholder="商品の説明を入力"
              />
            </div>
            <div>
              <label htmlFor="spec" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                スペック
              </label>
              <textarea
                id="spec"
                name="spec"
                rows={3}
                value={formData.spec}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                placeholder="スペック（JSON可）"
              />
            </div>
            {message && (
              <p className={`text-sm ${message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {message.text}
              </p>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? '登録中...' : '登録する'}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">ラウンジ通報モデレーション</h2>
            <div className="flex items-center gap-2">
              <select
                value={reportStatusFilter}
                onChange={(e) => {
                  const value = e.target.value
                  setReportStatusFilter(value)
                  loadReports(value)
                }}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              >
                <option value="all">すべて</option>
                <option value="submitted">受付</option>
                <option value="reviewing">検討中</option>
                <option value="resolved">対応完了</option>
                <option value="rejected">却下</option>
              </select>
              <Button type="button" variant="ghost" onClick={() => loadReports(reportStatusFilter)}>
                更新
              </Button>
            </div>
          </div>
          {reportLoading ? (
            <p className="text-sm text-gray-500">通報一覧を読み込んでいます...</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-gray-500">該当する通報はありません。</p>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                      #{report.id}
                    </span>
                    <span className="text-xs font-bold px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                      {report.target_type}
                    </span>
                    <span className="text-xs font-bold px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      {report.status}
                    </span>
                    <span className="text-xs text-gray-500">{new Date(report.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">理由: {report.reason}</p>
                  {report.details ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">詳細: {report.details}</p>
                  ) : null}
                  <p className="text-xs text-gray-500 mt-1">
                    target post: {report.target_post_id || '-'} / comment: {report.target_comment_id || '-'}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button type="button" size="sm" onClick={() => handleUpdateReportStatus(report.id, 'reviewing')}>
                      検討中に変更
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => handleModerateTarget(report)}>
                      対象を非表示 + 完了
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => handleRestoreTarget(report)}>
                      対象復旧 + 却下
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
