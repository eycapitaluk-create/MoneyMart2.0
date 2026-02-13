import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  CreditCard, Landmark, Plane, Banknote, Coins,
  Filter, Plus, Check, ArrowRightLeft, Trash2, X,
  Search, ArrowUpDown, Sparkles, ArrowRight, ShieldCheck, Clock3, Star
} from 'lucide-react'
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
  if (category === 'savings') base.push({ id: 'rate', label: '金利が高い順', fn: (a, b) => parseSpecValue(b.specs?.[0]?.value) - parseSpecValue(a.specs?.[0]?.value) })
  if (category === 'cards') base.push({ id: 'return', label: '還元率が高い順', fn: (a, b) => parseSpecValue(b.specs?.[1]?.value) - parseSpecValue(a.specs?.[1]?.value) })
  if (category === 'loans') base.push({ id: 'rate', label: '金利が低い順', fn: (a, b) => parseSpecValue(a.specs?.[0]?.value) - parseSpecValue(b.specs?.[0]?.value) })
  if (category === 'insurance') base.push({ id: 'price', label: '保険料が安い順', fn: (a, b) => parseSpecValue(a.specs?.[0]?.value) - parseSpecValue(b.specs?.[0]?.value) })
  if (category === 'points') base.push({ id: 'return', label: '還元率が高い順', fn: (a, b) => parseSpecValue(b.specs?.[0]?.value) - parseSpecValue(a.specs?.[0]?.value) })
  return base
}

const CATEGORY_THEME = {
  all: {
    active: 'bg-slate-900 text-white border-slate-900 shadow-lg',
    idle: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200',
    heroBg: 'from-slate-900 to-slate-800',
    accent: 'text-slate-700',
    chip: 'bg-slate-100 text-slate-700',
  },
  savings: {
    active: 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20',
    idle: 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100',
    heroBg: 'from-blue-700 to-indigo-700',
    accent: 'text-blue-700',
    chip: 'bg-blue-100 text-blue-700',
  },
  cards: {
    active: 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-500/20',
    idle: 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100',
    heroBg: 'from-purple-700 to-fuchsia-700',
    accent: 'text-purple-700',
    chip: 'bg-purple-100 text-purple-700',
  },
  loans: {
    active: 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-500/20',
    idle: 'bg-green-50 text-green-700 border-green-100 hover:bg-green-100',
    heroBg: 'from-emerald-700 to-green-700',
    accent: 'text-green-700',
    chip: 'bg-green-100 text-green-700',
  },
  points: {
    active: 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20',
    idle: 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100',
    heroBg: 'from-amber-500 to-orange-600',
    accent: 'text-amber-700',
    chip: 'bg-amber-100 text-amber-700',
  },
  insurance: {
    active: 'bg-sky-600 text-white border-sky-600 shadow-lg shadow-sky-500/20',
    idle: 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100',
    heroBg: 'from-sky-700 to-cyan-700',
    accent: 'text-sky-700',
    chip: 'bg-sky-100 text-sky-700',
  },
}

const HERO_COPY = {
  all: {
    title: '金融商品をまとめて比較',
    subtitle: '手数料・金利・還元率を横断で確認して、あなたに合う選択肢を見つけましょう。',
    promo: '最大3商品まで同時比較',
    metricA: '最短3分',
    metricALabel: '比較完了まで',
    metricB: '0円',
    metricBLabel: '比較利用料',
  },
  savings: {
    title: '預金金利をスマートに比較',
    subtitle: '期間・最低預入額・金利を一画面で確認。条件に合う預金をすぐに絞り込めます。',
    promo: 'ネット銀行の高金利をチェック',
    metricA: '0.35%',
    metricALabel: '最高水準の金利例',
    metricB: '1万円',
    metricBLabel: '最低預入の目安',
  },
  cards: {
    title: 'クレジットカードを比較',
    subtitle: '年会費・還元率・付帯保険を比較して、あなたに合う1枚を見つけましょう。',
    promo: '最大¥20,000 相当の特典情報も確認',
    metricA: '1.5%',
    metricALabel: '高還元率',
    metricB: '¥0',
    metricBLabel: '年会費無料の選択肢',
  },
  loans: {
    title: 'ローン条件を見える化',
    subtitle: '金利・団信・手数料を整理して比較。返済負担を下げる選択肢を探せます。',
    promo: '借換え候補も同時に比較可能',
    metricA: '0.219%',
    metricALabel: '変動金利の例',
    metricB: '最短',
    metricBLabel: 'オンライン申込対応',
  },
  insurance: {
    title: '旅行保険を条件で比較',
    subtitle: '保険料・補償額・サポート体制を比較して、旅先リスクに備えましょう。',
    promo: '治療救援・日本語サポートを重点比較',
    metricA: '無制限',
    metricALabel: '補償例',
    metricB: '24h',
    metricBLabel: '日本語サポート',
  },
  points: {
    title: 'ポイ活サービスを比較',
    subtitle: '還元率・提携先・キャンペーンを比較し、日常支出の効率を高めます。',
    promo: '還元率・提携先で最適化',
    metricA: '5.0%',
    metricALabel: '最大還元率の例',
    metricB: '全国',
    metricBLabel: '提携店舗',
  },
}

const HERO_IMAGE = {
  all: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
  savings: 'https://images.unsplash.com/photo-1579621970795-87facc2f976d?auto=format&fit=crop&w=1200&q=80',
  cards: 'https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1200&q=80',
  loans: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
  insurance: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  points: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80',
}

const HERO_IMAGE_OVERLAY = {
  all: 'from-slate-900/35 via-slate-900/10 to-slate-900/45',
  savings: 'from-blue-900/35 via-indigo-900/10 to-indigo-900/40',
  cards: 'from-purple-900/35 via-fuchsia-900/10 to-fuchsia-900/40',
  loans: 'from-emerald-900/35 via-green-900/10 to-green-900/40',
  insurance: 'from-sky-900/35 via-cyan-900/10 to-cyan-900/40',
  points: 'from-amber-900/35 via-orange-900/10 to-orange-900/40',
}

const toNumericList = (raw = '') => (
  String(raw)
    .replace(/,/g, '')
    .match(/[\d.]+/g)
    ?.map((v) => Number(v))
    .filter((v) => Number.isFinite(v)) || []
)

const parseMoneyLikeValue = (raw = '') => {
  if (String(raw).includes('無料')) return 0
  const nums = toNumericList(raw)
  return nums.length ? nums[0] : null
}

const parsePercentMin = (raw = '') => {
  const nums = toNumericList(raw)
  return nums.length ? Math.min(...nums) : null
}

const parsePercentMax = (raw = '') => {
  const nums = toNumericList(raw)
  return nums.length ? Math.max(...nums) : null
}

const parseCoverageValue = (raw = '') => {
  if (String(raw).includes('無制限')) return Number.POSITIVE_INFINITY
  const nums = toNumericList(raw)
  return nums.length ? Math.max(...nums) : null
}

const getCompareRule = (category, label = '') => {
  if (label.includes('年会費')) return { direction: 'min', parse: parseMoneyLikeValue }
  if (label.includes('手数料')) return { direction: 'min', parse: parsePercentMin }
  if (label.includes('保険料')) return { direction: 'min', parse: parseMoneyLikeValue }
  if (label.includes('最低預入')) return { direction: 'min', parse: parseMoneyLikeValue }
  if (label.includes('還元率')) return { direction: 'max', parse: parsePercentMax }
  if (label.includes('治療救援')) return { direction: 'max', parse: parseCoverageValue }
  if (label.includes('団信')) return { direction: 'max', parse: parsePercentMax }
  if (label.includes('限度額')) return { direction: 'max', parse: parseMoneyLikeValue }
  if (label.includes('金利')) {
    if (category === 'loans') return { direction: 'min', parse: parsePercentMin }
    return { direction: 'max', parse: parsePercentMax }
  }
  return null
}

export default function ProductPage({ productInterestIds = [], toggleProductInterest }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialCategory = searchParams.get('category') || 'all'
  const [activeCategory, setActiveCategory] = useState(initialCategory)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState([])
  const [sortBy, setSortBy] = useState('default')
  const [compareList, setCompareList] = useState([])
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)
  const interestedIdSet = useMemo(
    () => new Set((Array.isArray(productInterestIds) ? productInterestIds : []).map((id) => String(id))),
    [productInterestIds]
  )

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
          const specs = Array.isArray(p.specs) ? p.specs : []
          const spec = specs[f.specIndex]
          if (!spec) return false
          return f.fn(spec.value)
        })
      })

  const sortOptions = activeCategory === 'all' ? SORT_OPTIONS : getCategorySortOptions(activeCategory)
  const sortFn = sortOptions.find((o) => o.id === sortBy)?.fn || SORT_OPTIONS[0].fn
  const filteredProducts = [...filteredBySpec].sort(sortFn)
  const theme = CATEGORY_THEME[activeCategory] || CATEGORY_THEME.all
  const hero = HERO_COPY[activeCategory] || HERO_COPY.all
  const bestSpecProductIdsByIndex = useMemo(() => {
    if (!Array.isArray(compareList) || compareList.length < 2) return {}
    const category = compareList[0]?.category
    const result = {}
    const maxSpecLen = Math.max(...compareList.map((p) => p.specs?.length || 0))

    for (let specIdx = 0; specIdx < maxSpecLen; specIdx += 1) {
      const label = compareList.find((p) => p.specs?.[specIdx])?.specs?.[specIdx]?.label || ''
      const rule = getCompareRule(category, label)
      if (!rule) continue

      const candidates = compareList
        .map((p) => {
          const rawValue = p.specs?.[specIdx]?.value
          const parsed = rule.parse(rawValue)
          return { productId: p.id, value: parsed }
        })
        .filter((x) => Number.isFinite(x.value))

      if (candidates.length < 2) continue
      const target = rule.direction === 'min'
        ? Math.min(...candidates.map((x) => x.value))
        : Math.max(...candidates.map((x) => x.value))

      result[specIdx] = new Set(
        candidates
          .filter((x) => x.value === target)
          .map((x) => x.productId)
      )
    }

    return result
  }, [compareList])

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
                className={`flex items-center gap-2.5 px-5 py-3 rounded-xl border font-bold text-sm whitespace-nowrap transition-all ${
                  activeCategory === cat.id ? theme.active : (CATEGORY_THEME[cat.id] || CATEGORY_THEME.all).idle
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
        <div className={`mb-7 rounded-3xl overflow-hidden bg-gradient-to-r ${theme.heroBg} text-white shadow-xl`}>
          <div className="grid lg:grid-cols-2 gap-6 p-6 md:p-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-bold mb-4">
                <Sparkles size={14} className="text-yellow-300" /> MoneyMart Product Hub
              </div>
              <h2 className="text-3xl md:text-5xl font-black leading-tight mb-3">{hero.title}</h2>
              <p className="text-sm md:text-base text-white/90 font-medium leading-relaxed mb-4">
                {hero.subtitle}
              </p>
              <div className="inline-flex items-center rounded-xl bg-white/15 border border-white/20 px-3 py-2 text-sm font-bold">
                {hero.promo}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-slate-900 font-black text-sm hover:bg-slate-100 transition shadow-lg">
                  条件で探す <ArrowRight size={16} />
                </button>
                <button className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 border border-white/20 font-bold text-sm hover:bg-white/20 transition">
                  比較を開始 <ArrowRight size={16} />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-white/90">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} /> 審査・申込は各社公式サイト</span>
                <span className="inline-flex items-center gap-1.5"><Clock3 size={14} /> 最短3分で比較完了</span>
              </div>
            </div>
            <div className="relative self-end">
              <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-white/10 backdrop-blur-sm">
                <img
                  src={HERO_IMAGE[activeCategory] || HERO_IMAGE.all}
                  alt="product hero"
                  className="w-full h-56 md:h-64 object-cover saturate-[0.9] contrast-105 brightness-[0.9]"
                />
                <div className={`absolute inset-0 bg-gradient-to-br ${HERO_IMAGE_OVERLAY[activeCategory] || HERO_IMAGE_OVERLAY.all}`} />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/10 pointer-events-none" />
              </div>
              <div className="absolute top-3 right-3 rounded-xl bg-white/95 backdrop-blur text-slate-900 px-3 py-2 shadow-lg border border-white">
                <p className="text-2xl font-black leading-none">{hero.metricA}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1">{hero.metricALabel}</p>
              </div>
              <div className="absolute bottom-3 left-3 rounded-xl bg-white/95 backdrop-blur text-slate-900 px-3 py-2 shadow-lg border border-white">
                <p className="text-2xl font-black leading-none">{hero.metricB}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1">{hero.metricBLabel}</p>
              </div>
            </div>
          </div>
        </div>

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
          <div className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">条件フィルター</p>
                {activeFilters.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 text-[11px] font-black">
                    {activeFilters.length}
                  </span>
                )}
              </div>
              {activeFilters.length > 0 && (
                <button
                  onClick={() => setActiveFilters([])}
                  className="text-xs font-bold text-slate-500 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-300"
                >
                  すべて解除
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
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

        {/* 商品リスト */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProducts.map((product) => {
            const isSelected = compareList.find((p) => p.id === product.id)
            const isInterested = interestedIdSet.has(String(product.id))
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
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    toggleProductInterest?.(product.id, {
                      name: product.name,
                      provider: product.provider,
                      category: product.category,
                    })
                  }}
                  className={`absolute top-4 right-28 p-2 rounded-full transition-all z-10 ${
                    isInterested
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-500'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title={isInterested ? '関心リストから削除' : '関心リストに追加'}
                >
                  <Star size={16} fill={isInterested ? 'currentColor' : 'none'} />
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
                  {(product.specs || []).map((spec, idx) => (
                    <div key={idx} className="text-center border-r border-slate-200 dark:border-slate-700 last:border-0">
                      <p className="text-[10px] text-slate-400 font-bold mb-1">{spec.label}</p>
                      <p className="font-black text-sm text-slate-700 dark:text-slate-300">{spec.value}</p>
                    </div>
                  ))}
                </div>
                {isInterested && (
                  <p className="text-[11px] font-bold text-amber-600 dark:text-amber-300">
                    ★ 関心リストに保存済み
                  </p>
                )}
              </Link>
            )
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-20 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
            <Filter size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-bold">該当する商品はまだありません。</p>
            <div className="mt-4 flex items-center justify-center gap-4">
              {activeFilters.length > 0 && (
                <button
                  onClick={() => setActiveFilters([])}
                  className="text-orange-500 font-bold hover:underline"
                >
                  条件を緩和
                </button>
              )}
              <button onClick={() => handleCategoryChange('all')} className="text-orange-500 font-bold hover:underline">
                すべての商品を見る
              </button>
            </div>
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
                  {(compareList[0]?.specs || []).map((spec, idx) => (
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
                    {(product.specs || []).map((spec, idx) => (
                      <div
                        key={idx}
                        className={`h-12 flex items-center justify-center font-black border-b border-slate-100 dark:border-slate-800 ${
                          bestSpecProductIdsByIndex[idx]?.has(product.id)
                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {spec.value}
                          {bestSpecProductIdsByIndex[idx]?.has(product.id) && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                              BEST
                            </span>
                          )}
                        </span>
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
