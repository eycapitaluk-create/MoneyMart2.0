import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  CreditCard, Landmark, Plane, Banknote, Coins,
  ArrowLeft, ExternalLink, CheckCircle2, Shield, Star
} from 'lucide-react'
import { getProductById, PRODUCTS } from '../data/products'

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

export default function ProductDetailPage({ productInterestIds = [], toggleProductInterest }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const product = getProductById(id)

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400 font-bold mb-4">商品が見つかりませんでした</p>
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
  const relatedProducts = PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 3)

  const handleApply = () => {
    const url = product.apply_url || '#'
    if (url.startsWith('http')) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      alert('申込は各金融機関の公式サイトからお手続きください。')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 font-sans">
      {/* ヘッダー */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-16 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold text-sm mb-4"
          >
            <ArrowLeft size={20} />
            戻る
          </button>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2 flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={product.image}
                alt={product.provider}
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none'
                  const fb = e.target.nextElementSibling
                  if (fb) fb.classList.remove('hidden')
                }}
              />
              <div className="hidden w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-lg">
                <CategoryIcon size={32} className="text-slate-400" />
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 rounded">
                {categoryLabel}
              </span>
              <h1 className="text-xl font-black text-slate-900 dark:text-white mt-1">{product.name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">{product.provider}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* メインスペック */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          {product.badge && (
            <span className="inline-block text-xs font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full mb-4">
              {product.badge}
            </span>
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

        {/* 商品説明 */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <CheckCircle2 size={20} className="text-orange-500" />
            商品概要
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
        </div>

        {/* 注意事項 */}
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-[2rem] p-6 border border-amber-100 dark:border-amber-900/50">
          <h3 className="text-sm font-black text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
            <Shield size={16} />
            ご注意
          </h3>
          <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed">
            本ページの情報は2025年時点のものです。金利・手数料・条件等は変更される場合があります。申込前に必ず各金融機関の公式サイトで最新情報をご確認ください。
          </p>
        </div>

        {/* CTA: 申込ボタン */}
        <div className="sticky bottom-20 left-0 right-0 z-10">
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

        {/* 関連商品 */}
        {relatedProducts.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">同じカテゴリの商品</h2>
            <div className="space-y-3">
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
      </div>
    </div>
  )
}
