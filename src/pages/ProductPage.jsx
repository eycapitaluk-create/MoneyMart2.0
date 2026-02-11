import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  CreditCard, Landmark, Plane, Banknote, Coins,
  Filter, Plus, Check, ArrowRightLeft, Trash2, X,
  Search, ArrowUpDown
} from 'lucide-react'
import AdBanner from '../components/AdBanner'
import { CATEGORIES, PRODUCTS } from '../data/products'

// スペック値から数値を抽出 (金利・還元率・保険料など)
const parseSpecValue = (val) => {
  if (!val || val === '無料') return 0
  const cleaned = String(val).replace(/,/g, '')
  const m = cleaned.match(/([\d.]+)/)
  return m ? parseFloat(m[1]) : 0
}

// カテゴリ別フィルター (金利・手数料・ポイント等で絞り込み)
const CATEGORY_FILTERS = {
  savings: [
    { id: 'rate_02', label: '金利0.2%以上', specIndex: 0, fn: (v) => parseSpecValue(v) >= 0.2 },
    { id: 'rate_03', label: '金利0.25%以上', specIndex: 0, fn: (v) => parseSpecValue(v) >= 0.25 },
    { id: 'rate_03_high', label: '金利0.3%以上', specIndex: 0, fn: (v) => parseSpecValue(v) >= 0.3 },
  ],
  cards: [
    { id: 'fee_free', label: '年会費無料', specIndex: 0, fn: (v) => v === '無料' || v === '永年無料' },
    { id: 'return_1', label: '還元率1%以上', specIndex: 1, fn: (v) => parseSpecValue(v) >= 1 },
    { id: 'return_05', label: '還元率0.5%以上', specIndex: 1, fn: (v) => parseSpecValue(v) >= 0.5 },
  ],
  loans: [
    { id: 'rate_025', label: '変動金利0.25%以下', specIndex: 0, fn: (v) => parseSpecValue(v) <= 0.25 && parseSpecValue(v) > 0 },
    { id: 'rate_03', label: '変動金利0.3%以下', specIndex: 0, fn: (v) => parseSpecValue(v) <= 0.3 && parseSpecValue(v) > 0 },
    { id: 'danshin_100', label: '団信がん100%', specIndex: 1, fn: (v) => v?.includes('100%') },
  ],
  insurance: [
    { id: 'price_1200', label: '保険料1,200円以下', specIndex: 0, fn: (v) => parseSpecValue(v) <= 1200 },
    { id: 'price_1500', label: '保険料1,500円以下', specIndex: 0, fn: (v) => parseSpecValue(v) <= 1500 },
    { id: 'museigen', label: '治療救援無制限', specIndex: 1, fn: (v) => v === '無制限' },
  ],
  points: [
    { id: 'return_1', label: '還元率1%以上', specIndex: 0, fn: (v) => parseSpecValue(v) >= 1 },
    { id: 'return_05', label: '還元率0.5%以上', specIndex: 0, fn: (v) => parseSpecValue(v) >= 0.5 },
  ],
}

// 並び替え (中立表現: 金利順・名前順など)
const SORT_OPTIONS = [
  { id: 'default', label: '表示順', fn: (a, b) => a.id - b.id },
  { id: 'name', label: '名前順', fn: (a, b) => (a.name > b.name ? 1 : -1) },
  { id: 'provider', label: '提供会社順', fn: (a, b) => (a.provider > b.provider ? 1 : -1) },
]

const getCategorySortOptions = (category) => {
  const base = [{ id: 'default', label: '表示順', fn: (a, b) => a.id - b.id }]
  if (category === 'savings') base.push({ id: 'rate', label: '金利が高い順', fn: (a, b) => parseSpecValue(b.specs[0]?.value) - parseSpecValue(a.specs[0]?.value) })
  if (category === 'cards') base.push({ id: 'return', label: '還元率が高い順', fn: (a, b) => parseSpecValue(b.specs[1]?.value) - parseSpecValue(a.specs[1]?.value) })
  if (category === 'loans') base.push({ id: 'rate', label: '金利が低い順', fn: (a, b) => parseSpecValue(a.specs[0]?.value) - parseSpecValue(b.specs[0]?.value) })
  if (category === 'insurance') base.push({ id: 'price', label: '保険料が安い順', fn: (a, b) => parseSpecValue(a.specs[0]?.value) - parseSpecValue(b.specs[0]?.value) })
  if (category === 'points') base.push({ id: 'return', label: '還元率が高い順', fn: (a, b) => parseSpecValue(b.specs[0]?.value) - parseSpecValue(a.specs[0]?.value) })
  return base
}

export default function ProductPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialCategory = searchParams.get('category') || 'all'
  const [activeCategory, setActiveCategory] = useState(initialCategory)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState([])
  const [sortBy, setSortBy] = useState('default')
  const [compareList, setCompareList] = useState([])
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)

  useEffect(() => {
    const urlCategory = searchParams.get('category') || 'all'
    setActiveCategory(urlCategory)
  }, [searchParams])

  const handleCategoryChange = (catId) => {
    if (compareList.length > 0 && !window.confirm('カテゴリーを変更すると比較リストがリセットされます。よろしいですか？')) {
      return
    }
    if (compareList.length > 0) setCompareList([])
    setActiveCategory(catId)
    setSearchParams({ category: catId })
    setSortBy('default')
    setActiveFilters([])
  }

  const toggleFilter = (filterId) => {
    setActiveFilters((prev) => (prev.includes(filterId) ? prev.filter((f) => f !== filterId) : [...prev, filterId]))
  }

  const toggleCompare = (product) => {
    if (compareList.find((p) => p.id === product.id)) {
      setCompareList(compareList.filter((p) => p.id !== product.id))
      return
    }
    if (compareList.length > 0 && compareList[0].category !== product.category) {
      alert('同じカテゴリーの商品のみ比較できます。')
      return
    }
    if (compareList.length >= 3) {
      alert('一度に比較できるのは3つまでです。')
      return
    }
    setCompareList([...compareList, product])
  }

  const categoryProducts = activeCategory === 'all'
    ? PRODUCTS
    : PRODUCTS.filter((p) => p.category === activeCategory)

  const filteredBySearch = searchQuery.trim()
    ? categoryProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.provider.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categoryProducts

  const filters = CATEGORY_FILTERS[activeCategory] || []
  const filteredBySpec = activeFilters.length === 0
    ? filteredBySearch
    : filteredBySearch.filter((p) => {
        return activeFilters.every((filterId) => {
          const f = filters.find((x) => x.id === filterId)
          if (!f) return true
          const spec = p.specs[f.specIndex]
          if (!spec) return false
          return f.fn(spec.value)
        })
      })

  const sortOptions = activeCategory === 'all' ? SORT_OPTIONS : getCategorySortOptions(activeCategory)
  const sortFn = sortOptions.find((o) => o.id === sortBy)?.fn || SORT_OPTIONS[0].fn
  const filteredProducts = [...filteredBySpec].sort(sortFn)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32 font-sans">
      {/* ヘッダー */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-16 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-6">金融商品比較</h1>
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                  activeCategory === cat.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg scale-105'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <cat.icon size={22} />
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 検索 */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="商品名・提供会社で検索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-orange-500/30 placeholder-slate-400"
          />
        </div>

        {/* カテゴリ別フィルター (金利・手数料・ポイント等) */}
        {filters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {filters.map((f) => {
              const isActive = activeFilters.includes(f.id)
              return (
                <button
                  key={f.id}
                  onClick={() => toggleFilter(f.id)}
                  className={`px-4 py-2 rounded-xl font-bold text-sm transition ${
                    isActive
                      ? 'bg-orange-500 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-orange-500'
                  }`}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        )}

        {/* 並び替え */}
        <div className="flex items-center gap-2 mb-6">
          <ArrowUpDown size={18} className="text-slate-500 dark:text-slate-400 shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/30"
          >
            {sortOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
            {filteredProducts.length}件
          </span>
        </div>

        {/* 広告バナー */}
        <div className="mb-8">
          <AdBanner variant="horizontal" />
        </div>

        {/* 商品リスト */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProducts.map((product) => {
            const isSelected = compareList.find((p) => p.id === product.id)
            return (
              <Link
                key={product.id}
                to={`/products/${product.id}`}
                className={`group relative bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border transition-all duration-300 block ${
                  isSelected
                    ? 'border-orange-500 ring-2 ring-orange-500/20 shadow-xl transform -translate-y-1'
                    : 'border-slate-200 dark:border-slate-800 hover:border-orange-500 hover:shadow-lg'
                }`}
              >
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    toggleCompare(product)
                  }}
                  className={`absolute top-4 right-4 p-2 rounded-full transition-all z-10 flex items-center gap-2 font-bold text-xs ${
                    isSelected
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {isSelected ? <><Check size={16} /> 選択中</> : <><Plus size={16} /> 比較</>}
                </button>

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-full bg-white border border-slate-100 dark:border-slate-700 p-2 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                    <img
                      src={product.image}
                      alt={product.provider}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        const fallback = e.target.nextElementSibling
                        if (fallback) fallback.classList.remove('hidden')
                      }}
                    />
                    <div className="hidden w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg">
                      {product.category === 'cards' && <CreditCard size={28} className="text-slate-400" />}
                      {product.category === 'insurance' && <Plane size={28} className="text-slate-400" />}
                      {product.category === 'loans' && <Banknote size={28} className="text-slate-400" />}
                      {product.category === 'savings' && <Landmark size={28} className="text-slate-400" />}
                      {product.category === 'points' && <Coins size={28} className="text-slate-400" />}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{product.name}</h3>
                    <p className="text-xs text-slate-400 font-bold mt-1">{product.provider}</p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 grid grid-cols-3 gap-2 mb-4">
                  {product.specs.map((spec, idx) => (
                    <div key={idx} className="text-center border-r border-slate-200 dark:border-slate-700 last:border-0">
                      <p className="text-[10px] text-slate-400 font-bold mb-1">{spec.label}</p>
                      <p className="font-black text-sm text-slate-700 dark:text-slate-300">{spec.value}</p>
                    </div>
                  ))}
                </div>
              </Link>
            )
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-20 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
            <Filter size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-bold">該当する商品はまだありません。</p>
            <button onClick={() => handleCategoryChange('all')} className="mt-4 text-orange-500 font-bold hover:underline">
              すべての商品を見る
            </button>
          </div>
        )}
      </div>

      {/* 比較フローティングドック */}
      {compareList.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-4 rounded-2xl shadow-2xl z-40 animate-slideUp flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-orange-500 text-white font-black w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-md">
              {compareList.length}
            </div>
            <div className="text-sm font-bold">
              <span className="block opacity-60 text-xs">比較リスト</span>
              {compareList.length === 1 ? 'あと2つ選択できます' : '比較する準備ができました'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCompareList([])} className="p-2 hover:bg-white/10 dark:hover:bg-slate-200 rounded-lg transition">
              <Trash2 size={20} />
            </button>
            <button
              onClick={() => setIsCompareModalOpen(true)}
              disabled={compareList.length < 2}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition shadow-lg ${
                compareList.length < 2
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              }`}
            >
              比較開始 <ArrowRightLeft size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 比較モーダル */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="text-orange-500" /> 商品比較
              </h2>
              <button onClick={() => setIsCompareModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition">
                <X size={24} className="text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <div className="grid gap-4" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${compareList.length}, minmax(140px, 1fr))` }}>
                <div className="space-y-4 pt-32">
                  <div className="font-bold text-slate-400 text-sm h-12 flex items-center">提供会社</div>
                  {compareList[0]?.specs.map((spec, idx) => (
                    <div key={idx} className="font-bold text-slate-400 text-sm h-12 flex items-center border-b border-slate-100 dark:border-slate-800">
                      {spec.label}
                    </div>
                  ))}
                  <div className="font-bold text-slate-400 text-sm h-12 flex items-center pt-4">申込</div>
                </div>
                {compareList.map((product) => (
                  <div key={product.id} className="space-y-4 text-center">
                    <div className="h-32 flex flex-col items-center justify-start gap-2">
                      <img src={product.image} className="h-12 object-contain" alt="" />
                      <p className="font-black text-slate-900 dark:text-white text-sm leading-tight px-2">{product.name}</p>
                      {product.badge && <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">{product.badge}</span>}
                    </div>
                    <div className="h-12 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      {product.provider}
                    </div>
                    {product.specs.map((spec, idx) => (
                      <div key={idx} className="h-12 flex items-center justify-center font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800">
                        {spec.value}
                      </div>
                    ))}
                    <div className="h-12 flex items-center justify-center pt-4">
                      <Link
                        to={`/products/${product.id}`}
                        onClick={() => setIsCompareModalOpen(false)}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-bold text-sm shadow-md transition flex items-center justify-center"
                      >
                        詳細・申込
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
