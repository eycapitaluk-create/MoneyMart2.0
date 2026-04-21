import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  CreditCard, Landmark, Plane, Banknote, Coins,
  ArrowLeft, ExternalLink, CheckCircle2, Shield, Star
} from 'lucide-react'
import AdBanner from '../components/AdBanner'
import { trackAffiliateClick } from '../lib/affiliateTracking'
import { trackAnalyticsEvent } from '../lib/analytics'
import { fetchActiveProducts } from '../lib/productCatalog'

const CATEGORY_ICONS = {
  savings: Landmark,
  cards: CreditCard,
  loans: Banknote,
  insurance: Plane,
  points: Coins,
}

const CATEGORY_LABELS = {
  savings: '銀行・預金',
  cards: 'カード',
  loans: 'ローン',
  insurance: '旅行保険',
  points: 'ポイ活',
}

const CATEGORY_COMPARE_GUIDES = {
  savings: [
    '金利条件（通常金利 / 条件達成後）を分けて確認する',
    'ATM・振込手数料の無料回数と適用条件を見る',
    'キャンペーン特典の受取条件と期間を確認する',
  ],
  cards: [
    '年会費の条件（初年度 / 翌年度 / 条件付き無料）を確認する',
    '還元率だけでなく、ポイント利用先の使いやすさを見る',
    '旅行保険・付帯特典が自分の利用目的に合うか比較する',
  ],
  loans: [
    '金利タイプ（固定 / 変動）と見直し条件を比較する',
    '事務手数料・繰上返済手数料を含めた総コストで判断する',
    '審査条件（年収・勤続・対象物件）を事前に確認する',
  ],
  insurance: [
    '補償範囲（疾病 / 携行品 / 賠償責任）を優先順位で確認する',
    '免責金額と保険金支払条件を必ず読む',
    '家族特約・長期旅行時の対応可否を比較する',
  ],
  points: [
    '還元率の上限と対象外条件をチェックする',
    'ポイント失効期限と最低交換単位を確認する',
    '普段使うサービスで還元効率が高いか見る',
  ],
}

const PRODUCT_DETAIL_FAQ = [
  {
    q: '表示条件はいつ更新されますか？',
    a: '原則として定期的に見直していますが、急な変更があるため、最終的には公式サイトの最新情報をご確認ください。',
  },
  {
    q: 'このページから直接契約できますか？',
    a: '契約自体は各金融機関の公式ページで行います。本ページでは比較・検討に必要な情報を提供します。',
  },
  {
    q: '表示順は何を基準にしていますか？',
    a: '条件のわかりやすさ、使いやすさ、コスト構造など複数観点で整理しています。特定商品の提案ではなく、比較しやすい形で情報を表示しています。',
  },
]

export default function ProductDetailPage({ productInterestIds = [], toggleProductInterest }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productLoadError, setProductLoadError] = useState('')
  const product = useMemo(() => {
    const raw = String(id ?? '').trim()
    return products.find((item) => String(item.id) === raw) || null
  }, [id, products])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

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

  useEffect(() => {
    if (!product?.id) return
    trackAnalyticsEvent('product_detail_view', {
      product_type: product.category || 'product',
      product_id: String(product.id),
      product_name: product.name,
      provider: product.provider || '',
    })
  }, [product?.id])

  if (productsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400 font-bold">商品データを読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400 font-bold mb-4">
            {productLoadError || '商品が見つかりませんでした'}
          </p>
          <Link to="/products" className="text-orange-500 font-bold hover:underline">一覧に戻る</Link>
        </div>
      </div>
    )
  }

  const CategoryIcon = CATEGORY_ICONS[product.category] || CreditCard
  const categoryLabel = CATEGORY_LABELS[product.category] || '金融商品'
  const description = product.description || `${product.name}の詳細情報です。各金融機関の公式サイトで最新の条件をご確認ください。`
  const interestedIdSet = new Set((Array.isArray(productInterestIds) ? productInterestIds : []).map((v) => String(v)))
  const isInterested = interestedIdSet.has(String(product.id))

  // 同カテゴリの他商品（最大3件）
  const relatedProducts = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 3)
  const compareGuides = CATEGORY_COMPARE_GUIDES[product.category] || CATEGORY_COMPARE_GUIDES.cards
  const isSavingsCategory = product.category === 'savings'
  const applicationChecklist = [
    '適用条件（年齢・居住地・利用実績）を満たしている',
    '手数料・特典の適用期限を確認した',
    '公式サイトで最新条件を最終確認した',
  ]

  const handleApply = () => {
    const url = product.affiliate_url || product.apply_url || '#'
    if (url.startsWith('http')) {
      trackAnalyticsEvent('product_apply_click', {
        product_type: product.category || 'product',
        product_id: String(product.id),
        product_name: product.name,
        provider: product.provider || '',
        destination_url: url,
        sponsored: Boolean(product.is_sponsored),
      })
      if (product.is_sponsored) {
        trackAffiliateClick({ product, source: 'product_detail_apply' })
      }
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      alert('申込は各金融機関の公式サイトからお手続きください。')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 font-sans">
      {/* ヘッダー */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-16 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold text-sm mb-4"
          >
            <ArrowLeft size={20} />
            戻る
          </button>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2 flex items-center justify-center overflow-hidden shrink-0">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.provider}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-lg">
                  <CategoryIcon size={32} className="text-slate-400" />
                </div>
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 rounded">
                {categoryLabel}
              </span>
              {product.is_sponsored && (
                <span className="ml-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-300 px-2 py-0.5 rounded">
                  PR / Sponsored
                </span>
              )}
              <h1 className="text-xl font-black text-slate-900 dark:text-white mt-1">{product.name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">{product.provider}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800">
              {product.badge && (
                <span className="inline-block text-xs font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full mb-4">
                  {product.badge}
                </span>
              )}
              {product.is_sponsored && (
                <div className="mb-4 text-xs text-indigo-700 dark:text-indigo-300 font-bold">
                  広告提携: {product.ad_provider || 'Partner'}
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {(product.specs || []).map((spec, idx) => (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1">{spec.label}</p>
                    <p className="font-black text-slate-900 dark:text-white text-lg">{spec.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <CheckCircle2 size={20} className="text-orange-500" />
                商品概要
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">比較チェックポイント</h3>
                <ul className="space-y-2">
                  {compareGuides.map((item) => (
                    <li key={item} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed flex gap-2">
                      <span className="text-orange-500 font-black">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">申込前チェックリスト</h3>
                <div className="space-y-2">
                  {applicationChecklist.map((item) => (
                    <div key={item} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed flex gap-2 items-start">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {relatedProducts.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">同じカテゴリの商品</h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {relatedProducts.map((p) => (
                    <Link
                      key={p.id}
                      to={`/products/${p.id}`}
                      className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                    >
                      <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-700 p-2 flex items-center justify-center overflow-hidden shrink-0">
                        <img
                          src={p.image}
                          alt=""
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{p.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{p.provider}</p>
                      </div>
                      <span className="text-orange-500 text-xs font-bold">詳細 →</span>
                    </Link>
                  ))}
                </div>
                <Link
                  to={`/products?category=${product.category}`}
                  className="block mt-4 text-center text-orange-500 font-bold text-sm hover:underline"
                >
                  {categoryLabel}をすべて見る
                </Link>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">よくある質問</h2>
              <div className="space-y-3">
                {PRODUCT_DETAIL_FAQ.map((item) => (
                  <div key={item.q} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4">
                    <p className="text-sm font-black text-slate-900 dark:text-white">Q. {item.q}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">A. {item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24 self-start">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 shadow-sm border border-slate-100 dark:border-slate-800">
              <button
                onClick={() => toggleProductInterest?.(product.id, {
                  name: product.name,
                  provider: product.provider,
                  category: product.category,
                })}
                className={`w-full mb-3 py-3 border font-black text-sm rounded-2xl transition flex items-center justify-center gap-2 ${
                  isInterested
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Star size={18} fill={isInterested ? 'currentColor' : 'none'} />
                {isInterested ? '関心リストから削除' : '関心リストに追加'}
              </button>
              <button
                onClick={handleApply}
                className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-black text-lg rounded-2xl shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 transition"
              >
                この商品の申込へ <ExternalLink size={20} />
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-[2rem] p-6 border border-amber-100 dark:border-amber-900/50">
              <h3 className="text-sm font-black text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                <Shield size={16} />
                ご注意
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed">
                本ページの情報は2025年時点のものです。金利・手数料・条件等は変更される場合があります。申込前に必ず各金融機関の公式サイトで最新情報をご確認ください。
              </p>
            </div>

            {isSavingsCategory && (
              <>
                <AdBanner
                  variant="horizontal"
                  className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                />
                <AdBanner
                  variant="compact"
                  className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                />
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
