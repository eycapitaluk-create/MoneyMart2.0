import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  CreditCard, Landmark, Plane, Banknote, Coins,
  Filter, Plus, Check, ArrowRightLeft, X,
  ArrowUpDown, Sparkles, ShieldCheck, Clock3, Star
} from 'lucide-react'
import { CATEGORIES } from '../data/products'
import { trackAnalyticsEvent } from '../lib/analytics'
import { fetchActiveProducts } from '../lib/productCatalog'

// スペック値から数値を抽出 (金利・還元率・保険料など)
const parseSpecValue = (val) => {
  if (!val || val === '無料') return 0
  const cleaned = String(val).replace(/,/g, '')
  const m = cleaned.match(/([\d.]+)/)
  return m ? parseFloat(m[1]) : 0
}

const CONSULT_QUESTIONS = [
  {
    id: 'q1',
    q: '価格変動が大きい商品への許容度は？',
    options: [
      { label: 'できるだけ低い方が安心', score: 0 },
      { label: 'ある程度なら受け入れられる', score: 1 },
      { label: '高くても成長性を重視', score: 2 },
    ],
  },
  {
    id: 'q2',
    q: '投資・運用の主な目的は？',
    options: [
      { label: '元本に近い安定運用', score: 0 },
      { label: '安定と成長のバランス', score: 1 },
      { label: '中長期の成長重視', score: 2 },
    ],
  },
  {
    id: 'q3',
    q: 'どのくらいの期間で考えますか？',
    options: [
      { label: '1年以内', score: 0 },
      { label: '1〜3年', score: 1 },
      { label: '3年以上', score: 2 },
    ],
  },
]

// カテゴリ別フィルター (金利・手数料・ポイント等で絞り込み)
// 上段タブごとに意味のある条件だけを出す（例: NISA は証券・預金系のみ。保険/カードでは出さない）。
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

/** 複数カテゴリにまたがる条件を追加するときは categories で表示先を限定する（全タブ共通に出さない） */
const EXTRA_SPEC_FILTERS = [
  // 例: スペック列「NISA」がある場合のみ savings タブに表示
  // { id: 'nisa', label: 'NISA対応', categories: ['savings'], specIndex: 2, fn: (v) => String(v).includes('対応') },
]

function getSpecFiltersForCategory(category) {
  if (!category || category === 'all') return []
  const base = CATEGORY_FILTERS[category] || []
  const extra = EXTRA_SPEC_FILTERS.filter((f) => Array.isArray(f.categories) && f.categories.includes(category))
  return [...base, ...extra]
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

const PRODUCT_FAQ_ITEMS = [
  { q: 'ランキングは広告順ですか？', a: '広告順ではありません。選択した条件・並び替え基準で表示順が決まります。' },
  { q: 'このページで申込できますか？', a: '申込は各社の公式サイトで行われます。当ページは比較・検討支援を目的としています。' },
  { q: '比較結果は将来の成果を保証しますか？', a: '保証しません。最新の公式情報や契約条件を必ず確認して判断してください。' },
]

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
  const activeCategory = searchParams.get('category') || 'all'
  const searchQuery = ''
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productLoadError, setProductLoadError] = useState('')
  const [activeFilters, setActiveFilters] = useState([])
  const [sortBy, setSortBy] = useState('default')
  const [compareList, setCompareList] = useState([])
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)
  const [isConsultOpen, setIsConsultOpen] = useState(false)
  const [consultStep, setConsultStep] = useState(0)
  const [consultAnswers, setConsultAnswers] = useState([])
  const [quizSelected, setQuizSelected] = useState(null)
  const [quizDone, setQuizDone] = useState(false)
  const interestedIdSet = useMemo(
    () => new Set((Array.isArray(productInterestIds) ? productInterestIds : []).map((id) => String(id))),
    [productInterestIds]
  )
  const dailyQuiz = useMemo(() => ({
    id: 'daily-fin-quiz',
    question: '「分散投資」の主な目的として最も適切なのはどれ？',
    options: [
      { id: 'a', label: '必ず高いリターンを得るため', correct: false },
      { id: 'b', label: 'リスクを分散し値動きをならすため', correct: true },
      { id: 'c', label: '短期で一気に利益を狙うため', correct: false },
    ],
    explanation: '分散投資は値動きの異なる資産を組み合わせ、価格変動リスクの偏りを抑える目的で使います。',
  }), [])

  useEffect(() => {
    let alive = true
    const loadProducts = async () => {
      try {
        setProductsLoading(true)
        setProductLoadError('')
        const rows = await fetchActiveProducts()
        if (!alive) return
        setProducts(rows)
      } catch (error) {
        if (!alive) return
        setProducts([])
        setProductLoadError(error?.message || '商品データの取得に失敗しました。')
      } finally {
        if (alive) setProductsLoading(false)
      }
    }
    loadProducts()
    return () => { alive = false }
  }, [])

  const handleCategoryChange = (catId) => {
    if (compareList.length > 0 && !window.confirm('カテゴリーを変更すると比較リストがリセットされます。よろしいですか？')) {
      return
    }
    if (compareList.length > 0) setCompareList([])
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
    ? products
    : products.filter((p) => p.category === activeCategory)

  const filteredBySearch = searchQuery.trim()
    ? categoryProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.provider.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categoryProducts

  const filters = getSpecFiltersForCategory(activeCategory)
  const filteredBySpec = activeFilters.length === 0
    ? filteredBySearch
    : filteredBySearch.filter((p) => {
        return activeFilters.every((filterId) => {
          const f = filters.find((x) => x.id === filterId)
          if (!f) return true
          const specs = Array.isArray(p.specs) ? p.specs : []
          const spec = specs[f.specIndex]
          if (!spec) return false
          if (spec.value === '要確認') return true
          return f.fn(spec.value)
        })
      })

  const sortOptions = activeCategory === 'all' ? SORT_OPTIONS : getCategorySortOptions(activeCategory)
  const sortFn = sortOptions.find((o) => o.id === sortBy)?.fn || SORT_OPTIONS[0].fn
  const filteredProducts = [...filteredBySpec].sort(sortFn)
  const consultResult = useMemo(() => {
    if (consultAnswers.length < CONSULT_QUESTIONS.length) return null
    const total = consultAnswers.reduce((acc, v) => acc + Number(v || 0), 0)
    if (total <= 2) {
      return {
        type: '安定重視タイプ',
        comment: '価格変動を抑えながら、継続しやすい設計が向いています。',
        categories: ['savings', 'insurance', 'points'],
      }
    }
    if (total <= 4) {
      return {
        type: 'バランスタイプ',
        comment: '安定性と成長性をバランス良く組み合わせる運用が向いています。',
        categories: ['savings', 'cards', 'points'],
      }
    }
    return {
      type: '成長重視タイプ',
      comment: '中長期で成長性を重視した候補を中心に検討する傾向があります。',
      categories: ['cards', 'points', 'loans'],
    }
  }, [consultAnswers])
  const consultCandidates = useMemo(() => {
    if (!consultResult) return []
    const picked = products.filter((p) => consultResult.categories.includes(p.category)).slice(0, 3)
    return picked
  }, [consultResult, products])
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
          if (rawValue === '要確認') return { productId: p.id, value: NaN }
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12 font-sans">
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

        {Boolean(globalThis?.__MM_DEV__) && (
        <div className="mb-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 md:p-4">
            <div className="grid md:grid-cols-[210px,1fr] gap-3 items-stretch">
              <div className="relative rounded-2xl bg-gradient-to-b from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 border border-slate-200 dark:border-slate-700 flex items-end justify-center overflow-hidden min-h-[150px]">
                <div className="absolute top-3 right-3 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1 text-[11px] font-black text-slate-700 dark:text-slate-200">
                  たぬき診断！
                </div>
                <div className="h-36 w-36 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-black text-slate-500 dark:text-slate-300">
                  AI GUIDE
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-r from-cyan-50 via-blue-50 to-yellow-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800 p-3 md:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black text-blue-600 dark:text-blue-300">AIコンテンツ</p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight mt-1">今日の金融クイズに挑戦！</h3>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setConsultAnswers([])
                      setConsultStep(0)
                      setIsConsultOpen(true)
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-black"
                  >
                    1. 質問に答える
                  </button>
                  <button
                    onClick={() => document.getElementById('daily-fin-quiz')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-black"
                  >
                    2. クイズに挑戦
                  </button>
                  <button
                    onClick={() => {
                      setConsultAnswers([])
                      setConsultStep(0)
                      setIsConsultOpen(true)
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-black"
                  >
                    3. 候補を見る
                  </button>
                </div>
                <p className="mt-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                  正解してポイントGET！診断結果は候補提示であり、投資助言ではありません。
                </p>
              </div>
            </div>

            <div className="mt-3 flex justify-center">
              <button
                onClick={() => {
                  setConsultAnswers([])
                  setConsultStep(0)
                  setIsConsultOpen(true)
                }}
                className="w-full max-w-xl py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xl font-black shadow-lg"
              >
                今すぐ無料相談！
              </button>
            </div>
          </div>
        </div>
        )}

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

        {/* 並び替え + 比較（ファンド一覧と同様、一覧直上で操作） */}
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
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
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {filteredProducts.length}件
            </span>
          </div>
          {compareList.length > 0 && (
            <button
              type="button"
              onClick={() => compareList.length >= 2 && setIsCompareModalOpen(true)}
              disabled={compareList.length < 2}
              className={`inline-flex items-center gap-1.5 self-start rounded-lg px-3 py-1.5 text-xs font-black transition sm:self-auto ${
                compareList.length < 2
                  ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                  : 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm'
              }`}
            >
              <ArrowRightLeft size={14} />
              比較する ({compareList.length}/3)
            </button>
          )}
        </div>

        {compareList.length > 0 && (
          <div
            className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-900 text-white shadow-lg dark:bg-slate-950 px-4 py-3"
            role="region"
            aria-label="比較リスト"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs font-black text-white/80">比較選択中</span>
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-orange-500 px-2 text-xs font-black text-white">
                  {compareList.length}
                </span>
                <span className="text-xs font-bold text-white/70">
                  {compareList.length === 1 ? 'あと2つ選べます' : '比較する準備OK'}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:justify-start">
                {compareList.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex max-w-full items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-bold"
                  >
                    <span className="truncate">{p.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleCompare(p)}
                      className="shrink-0 rounded-md p-0.5 hover:bg-white/15"
                      aria-label={`${p.name}を比較から外す`}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCompareList([])}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-300 hover:text-white"
                >
                  <X size={14} />
                  全選択解除
                </button>
                <button
                  type="button"
                  onClick={() => setIsCompareModalOpen(true)}
                  disabled={compareList.length < 2}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black sm:text-sm ${
                    compareList.length < 2
                      ? 'cursor-not-allowed bg-slate-700 text-slate-500'
                      : 'bg-orange-500 text-white hover:bg-orange-600'
                  }`}
                >
                  比較する
                  <ArrowRightLeft size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {productsLoading ? (
          <div className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-bold text-slate-500 dark:text-slate-300">
            商品データを読み込み中...
          </div>
        ) : productLoadError ? (
          <div className="mb-6 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/10 px-4 py-3 text-sm font-bold text-rose-700 dark:text-rose-300">
            {productLoadError}
          </div>
        ) : null}

        {/* 商品リスト */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredProducts.flatMap((product, idx) => {
            const isSelected = compareList.find((p) => p.id === product.id)
            const isInterested = interestedIdSet.has(String(product.id))
            const nodes = [
              <Link
                  key={`product-card-${product.id}`}
                to={`/products/${product.id}`}
                onClick={() => {
                  trackAnalyticsEvent('product_select', {
                    product_type: product.category || 'product',
                    product_id: String(product.id),
                    product_name: product.name,
                    provider: product.provider || '',
                    source: 'product_list',
                  })
                }}
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
                    className={`absolute top-16 right-4 p-2 rounded-full transition-all z-10 ${
                      isInterested
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-500'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                    title={isInterested ? '関心リストから削除' : '関心リストに追加'}
                  >
                    <Star size={16} fill={isInterested ? 'currentColor' : 'none'} />
                  </button>

                  <div className="flex items-center gap-4 mb-6 pr-28">
                  <div className="w-14 h-14 rounded-full bg-white border border-slate-100 dark:border-slate-700 p-2 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                      {product.image ? (
                    <img
                      src={product.image}
                      alt={product.provider}
                      className="w-full h-full object-contain"
                    />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg">
                      {product.category === 'cards' && <CreditCard size={28} className="text-slate-400" />}
                      {product.category === 'insurance' && <Plane size={28} className="text-slate-400" />}
                      {product.category === 'loans' && <Banknote size={28} className="text-slate-400" />}
                      {product.category === 'savings' && <Landmark size={28} className="text-slate-400" />}
                      {product.category === 'points' && <Coins size={28} className="text-slate-400" />}
                    </div>
                      )}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{product.name}</h3>
                    <p className="text-xs text-slate-400 font-bold mt-1">{product.provider}</p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 grid grid-cols-3 gap-2 mb-4">
                    {(product.specs || []).map((spec, idx2) => (
                      <div key={idx2} className="text-center border-r border-slate-200 dark:border-slate-700 last:border-0">
                      <p className="text-[10px] text-slate-400 font-bold mb-1">{spec.label}</p>
                      <p className="font-black text-sm text-slate-700 dark:text-slate-300">{spec.value}</p>
                    </div>
                  ))}
                </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2 line-clamp-2">
                    {product.description || '主要条件をそろえて比較できるよう、基本情報を整理して掲載しています。'}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-1">
                    {product.badge && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-[10px] font-black">
                        {product.badge}
                      </span>
                    )}
                    {product.is_sponsored && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-[10px] font-black">
                        PR / Sponsored
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-bold">
                      公式サイト申込
                    </span>
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-bold">
                      比較対応
                    </span>
                  </div>
                  {isInterested && (
                    <p className="text-[11px] font-bold text-amber-600 dark:text-amber-300">
                      ★ 関心リストに保存済み
                    </p>
                  )}
              </Link>
            ]
            if (idx === 2) {
              nodes.push(
                <div
                  key="daily-fin-quiz-block"
                  id="daily-fin-quiz"
                  className="md:col-span-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-sky-50 via-blue-50 to-emerald-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 p-5 shadow-sm"
                >
                  <p className="text-xs font-black text-blue-600 dark:text-blue-300 mb-1">今日の金融クイズ</p>
                  <h4 className="text-lg font-black text-slate-900 dark:text-white">{dailyQuiz.question}</h4>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    {dailyQuiz.options.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          if (quizDone) return
                          setQuizSelected(opt.id)
                          setQuizDone(true)
                        }}
                        className={`px-3 py-2 rounded-xl text-sm font-bold border transition ${
                          quizDone && quizSelected === opt.id
                            ? (opt.correct ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-rose-500 text-white border-rose-500')
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {quizDone && (
                    <div className="mt-3 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3">
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {dailyQuiz.options.find((x) => x.id === quizSelected)?.correct ? '正解！ +10 ポイント（MVP表示）' : '今回は不正解。'}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{dailyQuiz.explanation}</p>
                    </div>
                  )}
                </div>
              )
            }
            return nodes
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

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm font-black text-slate-900 dark:text-white mb-3">よくある質問（比較の見方）</p>
            <div className="space-y-3">
              {PRODUCT_FAQ_ITEMS.map((item) => (
                <div key={item.q} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-200">Q. {item.q}</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">A. {item.a}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm font-black text-slate-900 dark:text-white mb-2">重要なお知らせ</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              本ページは情報提供を目的とした比較画面であり、特定商品の提案・ご案内を目的とするものではありません。
              実際の申込前には、各社公式サイトで最新の金利・手数料・キャンペーン・契約条件をご確認ください。
            </p>
            <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">広告方針: 表示順と広告掲載枠は区別して運用します</p>
            </div>
          </div>
        </div>
      </div>

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
                      {product.image ? (
                        <img src={product.image} className="h-12 object-contain" alt={product.provider} />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          {product.category === 'cards' && <CreditCard size={22} className="text-slate-400" />}
                          {product.category === 'insurance' && <Plane size={22} className="text-slate-400" />}
                          {product.category === 'loans' && <Banknote size={22} className="text-slate-400" />}
                          {product.category === 'savings' && <Landmark size={22} className="text-slate-400" />}
                          {product.category === 'points' && <Coins size={22} className="text-slate-400" />}
                        </div>
                      )}
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
                        onClick={() => {
                          trackAnalyticsEvent('product_select', {
                            product_type: product.category || 'product',
                            product_id: String(product.id),
                            product_name: product.name,
                            provider: product.provider || '',
                            source: 'product_compare_modal',
                          })
                          setIsCompareModalOpen(false)
                        }}
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

      {isConsultOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-slate-900 dark:text-white">AIキャラ診断（MVP）</h3>
              <button
                onClick={() => setIsConsultOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="p-5">
              {consultResult ? (
                <div>
                  <p className="text-sm font-black text-blue-600 dark:text-blue-300">あなたは「{consultResult.type}」</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{consultResult.comment}</p>
                  <div className="mt-4 space-y-2">
                    {consultCandidates.map((p) => (
                      <Link
                        key={`candidate-${p.id}`}
                        to={`/products/${p.id}`}
                        onClick={() => {
                          trackAnalyticsEvent('product_select', {
                            product_type: p.category || 'product',
                            product_id: String(p.id),
                            product_name: p.name,
                            provider: p.provider || '',
                            source: 'product_consult_modal',
                          })
                          setIsConsultOpen(false)
                        }}
                        className="block rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 hover:border-blue-400"
                      >
                        <p className="text-sm font-black text-slate-900 dark:text-white">{p.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{p.provider}</p>
                      </Link>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-4">
                    ※ 本表示は情報提供を目的とした候補提示であり、投資助言・提案ではありません。
                  </p>
                  <button
                    onClick={() => {
                      setConsultAnswers([])
                      setConsultStep(0)
                    }}
                    className="mt-4 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold"
                  >
                    もう一度診断する
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2">質問 {consultStep + 1}/{CONSULT_QUESTIONS.length}</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white mb-3">{CONSULT_QUESTIONS[consultStep].q}</p>
                  <div className="space-y-2">
                    {CONSULT_QUESTIONS[consultStep].options.map((opt, idx3) => (
                      <button
                        key={`opt-${idx3}`}
                        onClick={() => {
                          const next = [...consultAnswers, opt.score]
                          setConsultAnswers(next)
                          if (consultStep < CONSULT_QUESTIONS.length - 1) {
                            setConsultStep((prev) => prev + 1)
                          }
                        }}
                        className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 text-sm font-bold text-slate-800 dark:text-slate-200"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
