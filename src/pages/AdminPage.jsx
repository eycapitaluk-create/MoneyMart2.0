import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { fetchAdminReports, updateCommentStatus, updatePostStatus, updateReportStatus } from '../lib/loungeApi'
import { Activity, AlertTriangle, BookOpen, Database, Package } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [dashboard, setDashboard] = useState({
    totalProducts: 0,
    activeProducts: 0,
    academyCourses: 0,
    openReports: 0,
    dauToday: 0,
    signupsToday: 0,
    saveSuccessRate: 0,
    latestStockDate: null,
    latestFundDate: null,
    daily: [],
  })
  const [formData, setFormData] = useState({
    category: 'cards',
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
  const [academyForm, setAcademyForm] = useState({
    title: '',
    youtubeUrl: '',
    categoryKey: 'general',
    level: '初級',
    isFeatured: false,
  })
  const [academyLoading, setAcademyLoading] = useState(false)
  const [academyMessage, setAcademyMessage] = useState(null)
  const [products, setProducts] = useState([])
  const [productLoading, setProductLoading] = useState(false)
  const [productMessage, setProductMessage] = useState(null)
  const [editingProductId, setEditingProductId] = useState(null)
  const [editProductForm, setEditProductForm] = useState({
    category: 'cards',
    name: '',
    link: '',
    description: '',
    spec: '',
  })

  const loadProducts = async () => {
    setProductLoading(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, category, name, link, description, spec, is_active, created_at')
        .order('created_at', { ascending: false })
        .limit(300)
      if (error) throw error
      setProducts(data || [])
    } catch (err) {
      setProductMessage({ type: 'error', text: err.message || 'Failed to load products.' })
    } finally {
      setProductLoading(false)
    }
  }

  const loadReports = async (status = reportStatusFilter) => {
    setReportLoading(true)
    try {
      const data = await fetchAdminReports(status, 300)
      setReports(data)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to load report data.' })
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
        category: formData.category || null,
        name: formData.name,
        link: formData.link || null,
        description: formData.description || null,
        spec: formData.spec || null,
      }])
      if (error) throw error
      setMessage({ type: 'success', text: 'Product created successfully.' })
      setFormData({ category: 'cards', name: '', link: '', description: '', spec: '' })
      loadProducts()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to create product. Please check Supabase settings.' })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateReportStatus = async (id, status) => {
    try {
      await updateReportStatus(id, status)
      await loadReports(reportStatusFilter)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update report status.' })
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
      setMessage({ type: 'error', text: err.message || 'Moderation action failed.' })
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
      setMessage({ type: 'error', text: err.message || 'Restore action failed.' })
    }
  }

  const handleAcademyChange = (e) => {
    const { name, value, type, checked } = e.target
    setAcademyForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleAcademySubmit = async (e) => {
    e.preventDefault()
    setAcademyLoading(true)
    setAcademyMessage(null)
    try {
      const { error } = await supabase
        .from('academy_courses')
        .insert([{
          title: academyForm.title.trim(),
          youtube_url: academyForm.youtubeUrl.trim(),
          category_key: academyForm.categoryKey,
          level: academyForm.level,
          is_featured: academyForm.isFeatured,
          is_published: true,
        }])
      if (error) throw error
      setAcademyMessage({ type: 'success', text: 'Academy course created successfully.' })
      setAcademyForm({
        title: '',
        youtubeUrl: '',
        categoryKey: 'general',
        level: '初級',
        isFeatured: false,
      })
    } catch (err) {
      setAcademyMessage({ type: 'error', text: err.message || 'Failed to create course. Please verify Academy schema.' })
    } finally {
      setAcademyLoading(false)
    }
  }

  const handleStartEditProduct = (product) => {
    setEditingProductId(product.id)
    setEditProductForm({
      category: product.category || 'cards',
      name: product.name || '',
      link: product.link || '',
      description: product.description || '',
      spec: product.spec || '',
    })
  }

  const handleCancelEditProduct = () => {
    setEditingProductId(null)
    setEditProductForm({ category: 'cards', name: '', link: '', description: '', spec: '' })
  }

  const handleEditProductChange = (e) => {
    const { name, value } = e.target
    setEditProductForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSaveProductEdit = async (id) => {
    setProductMessage(null)
    try {
      const { error } = await supabase
        .from('products')
        .update({
          category: editProductForm.category || null,
          name: editProductForm.name,
          link: editProductForm.link || null,
          description: editProductForm.description || null,
          spec: editProductForm.spec || null,
        })
        .eq('id', id)
      if (error) throw error
      setProductMessage({ type: 'success', text: 'Product updated successfully.' })
      setEditingProductId(null)
      loadProducts()
    } catch (err) {
      setProductMessage({ type: 'error', text: err.message || 'Failed to update product.' })
    }
  }

  const handleToggleProductActive = async (product) => {
    setProductMessage(null)
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id)
      if (error) throw error
      setProductMessage({ type: 'success', text: `Product visibility updated: ${product.is_active ? 'Hidden' : 'Published'}.` })
      loadProducts()
    } catch (err) {
      setProductMessage({ type: 'error', text: err.message || 'Failed to update visibility.' })
    }
  }

  const buildRecentDayLabels = (days = 7) => {
    const labels = []
    const now = new Date()
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      labels.push(d.toISOString().slice(0, 10))
    }
    return labels
  }

  const countRowsByDay = (rows, key, dayKeys) => {
    const counter = new Map(dayKeys.map((d) => [d, 0]))
    ;(rows || []).forEach((row) => {
      const raw = row?.[key]
      if (!raw) return
      const day = String(raw).slice(0, 10)
      if (counter.has(day)) counter.set(day, counter.get(day) + 1)
    })
    return counter
  }

  const loadDashboard = async () => {
    setDashboardLoading(true)
    setDashboardError('')
    try {
      const dayKeys = buildRecentDayLabels(7)
      const dayStart = dayKeys[0]

      const [
        productsCountRes,
        productsActiveRes,
        academyCountRes,
        reportsOpenRes,
        productsRecentRes,
        academyRecentRes,
        reportsRecentRes,
        latestStockRes,
        latestFundRes,
      ] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('academy_courses').select('id', { count: 'exact', head: true }),
        supabase.from('lounge_reports').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'reviewing']),
        supabase.from('products').select('created_at').gte('created_at', `${dayStart}T00:00:00`),
        supabase.from('academy_courses').select('created_at').gte('created_at', `${dayStart}T00:00:00`),
        supabase.from('lounge_reports').select('created_at').gte('created_at', `${dayStart}T00:00:00`),
        supabase.from('stock_prices').select('trade_date').order('trade_date', { ascending: false }).limit(1),
        supabase.from('quick_fund_master').select('standard_date').order('standard_date', { ascending: false }).limit(1),
      ])

      const productByDay = countRowsByDay(productsRecentRes.data, 'created_at', dayKeys)
      const academyByDay = countRowsByDay(academyRecentRes.data, 'created_at', dayKeys)
      const reportsByDay = countRowsByDay(reportsRecentRes.data, 'created_at', dayKeys)
      const daily = dayKeys.map((day) => ({
        day: day.slice(5).replace('-', '/'),
        products: productByDay.get(day) || 0,
        academy: academyByDay.get(day) || 0,
        reports: reportsByDay.get(day) || 0,
      }))
      let dauToday = 0
      let signupsToday = 0
      let saveSuccessRate = 0
      const { data: adminDailyMetrics, error: dailyMetricErr } = await supabase
        .from('admin_daily_metrics')
        .select('metric_date,dau,signup_count,mypage_save_success_rate')
        .order('metric_date', { ascending: false })
        .limit(7)
      if (!dailyMetricErr && Array.isArray(adminDailyMetrics) && adminDailyMetrics.length > 0) {
        const latest = adminDailyMetrics[0]
        dauToday = Number(latest.dau || 0)
        signupsToday = Number(latest.signup_count || 0)
        saveSuccessRate = Number(latest.mypage_save_success_rate || 0)
      }

      setDashboard({
        totalProducts: productsCountRes.count || 0,
        activeProducts: productsActiveRes.count || 0,
        academyCourses: academyCountRes.count || 0,
        openReports: reportsOpenRes.count || 0,
        dauToday,
        signupsToday,
        saveSuccessRate,
        latestStockDate: latestStockRes.data?.[0]?.trade_date || null,
        latestFundDate: latestFundRes.data?.[0]?.standard_date || null,
        daily,
      })
    } catch (err) {
      setDashboardError(err.message || 'Failed to load business dashboard.')
    } finally {
      setDashboardLoading(false)
    }
  }

  useEffect(() => {
    loadReports('submitted')
    loadProducts()
    loadDashboard()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Admin Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition ${
              activeTab === 'dashboard'
                ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
            }`}
          >
            Business Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('operations')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition ${
              activeTab === 'operations'
                ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
            }`}
          >
            Operations
          </button>
        </div>

        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="p-4">
                <p className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Package size={14} /> Total Products</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{dashboard.totalProducts}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Activity size={14} /> Active Products</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{dashboard.activeProducts}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><BookOpen size={14} /> Academy Courses</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{dashboard.academyCourses}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><AlertTriangle size={14} /> Open Reports</p>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{dashboard.openReports}</p>
              </Card>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="p-4">
                <p className="text-xs font-bold text-gray-500 mb-1">DAU (Today)</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{dashboard.dauToday.toLocaleString()}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-bold text-gray-500 mb-1">Signups (Today)</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{dashboard.signupsToday.toLocaleString()}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-bold text-gray-500 mb-1">MyPage Save Success</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{dashboard.saveSuccessRate.toFixed(1)}%</p>
              </Card>
            </div>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">7-Day Operations Trend</h2>
                <Button type="button" variant="ghost" onClick={loadDashboard}>Refresh</Button>
              </div>
              {dashboardLoading ? (
                <p className="text-sm text-gray-500">Loading dashboard...</p>
              ) : dashboardError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{dashboardError}</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboard.daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="products" name="Products" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="academy" name="Academy" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="reports" name="Reports" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="p-4">
              <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1"><Database size={14} /> Data Freshness</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs text-gray-500">Latest Stock Trade Date</p>
                  <p className="text-sm font-black text-gray-900 dark:text-white">{dashboard.latestStockDate || '-'}</p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs text-gray-500">Latest Fund Standard Date</p>
                  <p className="text-sm font-black text-gray-900 dark:text-white">{dashboard.latestFundDate || '-'}</p>
                </div>
              </div>
            </Card>
          </>
        )}

        {activeTab === 'operations' && (
          <>
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="cards">Credit Cards</option>
                <option value="savings">Savings</option>
                <option value="loans">Loans</option>
                <option value="insurance">Insurance</option>
                <option value="points">Points</option>
              </select>
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Product Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                placeholder="Enter product name"
              />
            </div>
            <div>
              <label htmlFor="link" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Link
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
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                placeholder="Enter product description"
              />
            </div>
            <div>
              <label htmlFor="spec" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Specs
              </label>
              <textarea
                id="spec"
                name="spec"
                rows={3}
                value={formData.spec}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                placeholder="Specs (JSON supported)"
              />
            </div>
            {message && (
              <p className={`text-sm ${message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {message.text}
              </p>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Product'}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Products / Edit / Visibility</h2>
            <Button type="button" variant="ghost" onClick={loadProducts}>Refresh</Button>
          </div>
          {productMessage ? (
            <p className={`text-sm mb-3 ${productMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {productMessage.text}
            </p>
          ) : null}
          {productLoading ? (
            <p className="text-sm text-gray-500">Loading product list...</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-gray-500">No products found.</p>
          ) : (
            <div className="space-y-3">
              {products.map((product) => {
                const editing = editingProductId === product.id
                return (
                  <div key={product.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-bold px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">#{product.id}</span>
                      <span className="text-xs font-bold px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{product.category || 'uncategorized'}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${product.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'}`}>
                        {product.is_active ? 'Published' : 'Hidden'}
                      </span>
                      <span className="text-xs text-gray-500">{new Date(product.created_at).toLocaleString()}</span>
                    </div>

                    {editing ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <select
                            name="category"
                            value={editProductForm.category}
                            onChange={handleEditProductChange}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                          >
                            <option value="cards">Credit Cards</option>
                            <option value="savings">Savings</option>
                            <option value="loans">Loans</option>
                            <option value="insurance">Insurance</option>
                            <option value="points">Points</option>
                          </select>
                          <input
                            name="name"
                            value={editProductForm.name}
                            onChange={handleEditProductChange}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                            placeholder="Product name"
                          />
                        </div>
                        <input
                          name="link"
                          value={editProductForm.link}
                          onChange={handleEditProductChange}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                          placeholder="https://..."
                        />
                        <textarea
                          name="description"
                          rows={2}
                          value={editProductForm.description}
                          onChange={handleEditProductChange}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                          placeholder="Description"
                        />
                        <textarea
                          name="spec"
                          rows={2}
                          value={editProductForm.spec}
                          onChange={handleEditProductChange}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                          placeholder="Specs"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" onClick={() => handleSaveProductEdit(product.id)}>Save</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={handleCancelEditProduct}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{product.name}</p>
                        <p className="text-xs text-gray-500 mt-1 break-all">{product.link || '-'}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{product.description || '-'}</p>
                        <p className="text-xs text-gray-500 mt-1">{product.spec || '-'}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button type="button" size="sm" onClick={() => handleStartEditProduct(product)}>Edit</Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={product.is_active ? 'ghost' : 'secondary'}
                            onClick={() => handleToggleProductActive(product)}
                          >
                            {product.is_active ? 'Hide' : 'Publish'}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Academy Course Registration (YouTube)</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Only 5 fields are required. All other fields use system defaults.
          </p>
          <form onSubmit={handleAcademySubmit} className="space-y-4">
            <div>
              <label htmlFor="academy-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Course Title *
              </label>
              <input
                id="academy-title"
                name="title"
                type="text"
                required
                value={academyForm.title}
                onChange={handleAcademyChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                placeholder="e.g. New NISA Basics #1"
              />
            </div>
            <div>
              <label htmlFor="academy-youtube" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                YouTube URL *
              </label>
              <input
                id="academy-youtube"
                name="youtubeUrl"
                type="url"
                required
                value={academyForm.youtubeUrl}
                onChange={handleAcademyChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="academy-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  id="academy-category"
                  name="categoryKey"
                  value={academyForm.categoryKey}
                  onChange={handleAcademyChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="general">General</option>
                  <option value="beginner">Beginner</option>
                  <option value="analysis">Analysis</option>
                </select>
              </div>
              <div>
                <label htmlFor="academy-level" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Level
                </label>
                <select
                  id="academy-level"
                  name="level"
                  value={academyForm.level}
                  onChange={handleAcademyChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="初級">Beginner</option>
                  <option value="中級">Intermediate</option>
                  <option value="上級">Advanced</option>
                </select>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                name="isFeatured"
                checked={academyForm.isFeatured}
                onChange={handleAcademyChange}
              />
              Set as featured course
            </label>
            {academyMessage ? (
              <p className={`text-sm ${academyMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {academyMessage.text}
              </p>
            ) : null}
            <Button type="submit" disabled={academyLoading}>
              {academyLoading ? 'Creating...' : 'Create Course'}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Lounge Report Moderation</h2>
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
                <option value="all">All</option>
                <option value="submitted">Submitted</option>
                <option value="reviewing">Reviewing</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>
              <Button type="button" variant="ghost" onClick={() => loadReports(reportStatusFilter)}>
                Refresh
              </Button>
            </div>
          </div>
          {reportLoading ? (
            <p className="text-sm text-gray-500">Loading reports...</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-gray-500">No reports found.</p>
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
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Reason: {report.reason}</p>
                  {report.details ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Details: {report.details}</p>
                  ) : null}
                  <p className="text-xs text-gray-500 mt-1">
                    target post: {report.target_post_id || '-'} / comment: {report.target_comment_id || '-'}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button type="button" size="sm" onClick={() => handleUpdateReportStatus(report.id, 'reviewing')}>
                      Mark Reviewing
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => handleModerateTarget(report)}>
                      Hide Target + Resolve
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => handleRestoreTarget(report)}>
                      Restore Target + Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
          </>
        )}
      </div>
    </div>
  )
}
