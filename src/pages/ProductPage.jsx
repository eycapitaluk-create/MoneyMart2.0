import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CreditCard, Landmark, Plane, Banknote, Coins,
  Filter, Plus, Check, ArrowRightLeft, Trash2, X
} from 'lucide-react'
import AdBanner from '../components/AdBanner'

const CATEGORIES = [
  { id: 'all', name: 'すべて', icon: Filter },
  { id: 'savings', name: '銀行・預金', icon: Landmark },
  { id: 'cards', name: 'カード', icon: CreditCard },
  { id: 'loans', name: 'ローン', icon: Banknote },
  { id: 'insurance', name: '旅行保険', icon: Plane },
  { id: 'points', name: 'ポイ活', icon: Coins },
]

const PRODUCTS = [
  // 銀行・預金 (savings)
  { id: 1, category: 'savings', name: '楽天銀行 スーパー定期', provider: '楽天銀行', image: 'https://companieslogo.com/img/orig/4755.T-1160655a.png', badge: '金利UP', specs: [{ label: '金利', value: '0.25%' }, { label: '期間', value: '1年' }, { label: '最低預入', value: '1万円' }] },
  { id: 2, category: 'savings', name: 'SBJ銀行 定期預金', provider: 'SBJ銀行', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Shinhan_Financial_Group_Logo.svg/2560px-Shinhan_Financial_Group_Logo.svg.png', badge: '高金利', specs: [{ label: '金利', value: '0.35%' }, { label: '期間', value: '3年' }, { label: '最低預入', value: '10万円' }] },
  { id: 3, category: 'savings', name: 'ソニー銀行 定期預金', provider: 'ソニー銀行', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Sony_Group_Logo_2024.svg/2560px-Sony_Group_Logo_2024.svg.png', badge: 'ネット銀行', specs: [{ label: '金利', value: '0.20%' }, { label: '期間', value: '1年' }, { label: '最低預入', value: '1万円' }] },
  { id: 4, category: 'savings', name: '住信SBIネット銀行 定期預金', provider: '住信SBIネット銀行', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/SBI_Group_logo.svg/2560px-SBI_Group_logo.svg.png', badge: '業界トップ', specs: [{ label: '金利', value: '0.30%' }, { label: '期間', value: '2年' }, { label: '最低預入', value: '1万円' }] },
  { id: 5, category: 'savings', name: '三菱UFJ銀行 スーパー定期', provider: '三菱UFJ銀行', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Mitsubishi_UFJ_Financial_Group_logo.svg/2560px-Mitsubishi_UFJ_Financial_Group_logo.svg.png', badge: 'メガバンク', specs: [{ label: '金利', value: '0.15%' }, { label: '期間', value: '1年' }, { label: '最低預入', value: '10万円' }] },
  // カード (cards)
  { id: 6, category: 'cards', name: '楽天カード', provider: '楽天カード', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Rakuten_Card_logo.svg/2560px-Rakuten_Card_logo.svg.png', badge: '人気No.1', specs: [{ label: '年会費', value: '無料' }, { label: '還元率', value: '1.0%' }, { label: '保険', value: '利用付帯' }] },
  { id: 7, category: 'cards', name: '三井住友カード (NL)', provider: '三井住友カード', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Sumitomo_Mitsui_Financial_Group_logo.svg/1200px-Sumitomo_Mitsui_Financial_Group_logo.svg.png', badge: '即時発行', specs: [{ label: '年会費', value: '無料' }, { label: '還元率', value: '0.5%' }, { label: '保険', value: '最高2000万' }] },
  { id: 8, category: 'cards', name: 'JCB CARD W', provider: 'JCB', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/JCB_logo.svg/1200px-JCB_logo.svg.png', badge: '39歳以下', specs: [{ label: '年会費', value: '無料' }, { label: '還元率', value: '1.0%~5.5%' }, { label: '保険', value: '最高2000万' }] },
  { id: 9, category: 'cards', name: 'PayPayカード', provider: 'PayPay', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/PayPay_logo.svg/2560px-PayPay_logo.svg.png', badge: '還元率最高', specs: [{ label: '年会費', value: '無料' }, { label: '還元率', value: '0.5%~3.0%' }, { label: '保険', value: '海外旅行' }] },
  { id: 10, category: 'cards', name: 'アメリカン・エキスプレス・ゴールド', provider: 'アメリゴ', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/American_Express_logo.svg/2560px-American_Express_logo.svg.png', badge: '上級者向け', specs: [{ label: '年会費', value: '33,000円' }, { label: '還元率', value: '1.0%' }, { label: '保険', value: '最高5億円' }] },
  // ローン (loans)
  { id: 11, category: 'loans', name: 'auじぶん銀行 住宅ローン', provider: 'auじぶん銀行', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Kddi_logo.svg/2560px-Kddi_logo.svg.png', badge: '金利引下', specs: [{ label: '変動金利', value: '0.219%' }, { label: '団信', value: 'がん50%' }, { label: '手数料', value: '2.20%' }] },
  { id: 12, category: 'loans', name: 'ソニー銀行 住宅ローン', provider: 'ソニー銀行', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Sony_Group_Logo_2024.svg/2560px-Sony_Group_Logo_2024.svg.png', badge: 'ネット専用', specs: [{ label: '変動金利', value: '0.249%' }, { label: '団信', value: 'がん100%' }, { label: '手数料', value: '2.20%' }] },
  { id: 13, category: 'loans', name: 'プロミス カードローン', provider: 'SMBCコンシューマーファイナンス', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Sumitomo_Mitsui_Financial_Group_logo.svg/1200px-Sumitomo_Mitsui_Financial_Group_logo.svg.png', badge: '即日融資', specs: [{ label: '金利', value: '3.0%~18.0%' }, { label: '限度額', value: '500万円' }, { label: '審査', value: '最短30分' }] },
  { id: 14, category: 'loans', name: '楽天銀行 住宅ローン', provider: '楽天銀行', image: 'https://companieslogo.com/img/orig/4755.T-1160655a.png', badge: '楽天ポイント', specs: [{ label: '変動金利', value: '0.239%' }, { label: '団信', value: 'がん50%' }, { label: '手数料', value: '2.20%' }] },
  // 旅行保険 (insurance)
  { id: 15, category: 'insurance', name: 'ソニー損保の海外旅行保険', provider: 'ソニー損保', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Sony_Group_Logo_2024.svg/2560px-Sony_Group_Logo_2024.svg.png', badge: 'リピート率No.1', specs: [{ label: '保険料', value: '1,200円~' }, { label: '治療救援', value: '無制限' }, { label: 'サポート', value: '24時間日本語' }] },
  { id: 16, category: 'insurance', name: '楽天の海外旅行保険', provider: '楽天損保', image: 'https://companieslogo.com/img/orig/4755.T-1160655a.png', badge: 'ポイント還元', specs: [{ label: '保険料', value: '980円~' }, { label: '治療救援', value: '3,000万円' }, { label: 'サポート', value: '24時間対応' }] },
  { id: 17, category: 'insurance', name: 'あいおいニッセイ 海外旅行保険', provider: 'あいおいニッセイ', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Mitsubishi_UFJ_Financial_Group_logo.svg/2560px-Mitsubishi_UFJ_Financial_Group_logo.svg.png', badge: '空港申込可', specs: [{ label: '保険料', value: '1,500円~' }, { label: '治療救援', value: '無制限' }, { label: 'サポート', value: '年中無休' }] },
  { id: 18, category: 'insurance', name: 'アクサダイレクト 海外旅行保険', provider: 'アクサ損保', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/AXA_Logo.svg/2560px-AXA_Logo.svg.png', badge: 'シンプル', specs: [{ label: '保険料', value: '1,080円~' }, { label: '治療救援', value: '5,000万円' }, { label: 'サポート', value: '24時間' }] },
  // ポイ活 (points)
  { id: 19, category: 'points', name: '楽天ポイントカード', provider: '楽天', image: 'https://companieslogo.com/img/orig/4755.T-1160655a.png', badge: 'ポイント2倍', specs: [{ label: '還元率', value: '1.0%' }, { label: '提携', value: '楽天市場' }, { label: '特典', value: '株主優待' }] },
  { id: 20, category: 'points', name: 'PayPay ポイント', provider: 'PayPay', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/PayPay_logo.svg/2560px-PayPay_logo.svg.png', badge: 'キャッシュバック', specs: [{ label: '還元率', value: '0.5%~5.0%' }, { label: '提携', value: '全国店舗' }, { label: '特典', value: 'PayPayボーナス' }] },
  { id: 21, category: 'points', name: 'dポイント クラブ', provider: 'NTTドコモ', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/NTT_Docomo_logo.svg/2560px-NTT_Docomo_logo.svg.png', badge: 'd払い連携', specs: [{ label: '還元率', value: '0.5%~2.0%' }, { label: '提携', value: 'ドコモ系' }, { label: '特典', value: 'dポイント2倍' }] },
  { id: 22, category: 'points', name: 'Tポイントカード', provider: 'カルチュア・コンビニエンス・クラブ', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/T-Point_logo.svg/2560px-T-Point_logo.svg.png', badge: '全国展開', specs: [{ label: '還元率', value: '0.5%~1.0%' }, { label: '提携', value: 'コンビニ・飲食' }, { label: '特典', value: 'Tカード統合' }] },
  // 追加: 銀行・預金
  { id: 23, category: 'savings', name: 'りそな銀行 ムーディーズ預金', provider: 'りそな銀行', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Resona_Holdings_logo.svg/2560px-Resona_Holdings_logo.svg.png', badge: '金利変動', specs: [{ label: '金利', value: '0.20%' }, { label: '期間', value: '1年' }, { label: '最低預入', value: '1万円' }] },
  { id: 24, category: 'savings', name: 'セブン銀行 定期預金', provider: 'セブン銀行', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Seven_%26_I_Holdings_logo.svg/2560px-Seven_%26_I_Holdings_logo.svg.png', badge: 'コンビニ窓口', specs: [{ label: '金利', value: '0.25%' }, { label: '期間', value: '1年' }, { label: '最低預入', value: '1万円' }] },
  // 追加: カード
  { id: 25, category: 'cards', name: 'EPOSカード ゴールド', provider: 'エポスカード', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Seven_%26_I_Holdings_logo.svg/2560px-Seven_%26_I_Holdings_logo.svg.png', badge: 'マルイ提携', specs: [{ label: '年会費', value: '無料' }, { label: '還元率', value: '0.5%~1.0%' }, { label: '保険', value: '海外旅行' }] },
  { id: 26, category: 'cards', name: 'オリコカード', provider: 'オリエントコーポレーション', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Orico_logo.svg/2560px-Orico_logo.svg.png', badge: '分割手数料無料', specs: [{ label: '年会費', value: '無料' }, { label: '還元率', value: '0.5%' }, { label: '特典', value: 'ポイント2倍' }] },
  // 追加: ローン
  { id: 27, category: 'loans', name: 'イオン銀行 住宅ローン', provider: 'イオン銀行', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Aeon_logo.svg/2560px-Aeon_logo.svg.png', badge: 'イオン優遇', specs: [{ label: '変動金利', value: '0.239%' }, { label: '団信', value: 'がん100%' }, { label: '手数料', value: '2.20%' }] },
  { id: 28, category: 'loans', name: 'みずほ銀行 住宅ローン', provider: 'みずほ銀行', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Mizuho_Financial_Group_logo.svg/2560px-Mizuho_Financial_Group_logo.svg.png', badge: 'メガバンク', specs: [{ label: '変動金利', value: '0.265%' }, { label: '団信', value: 'がん50%' }, { label: '手数料', value: '2.20%' }] },
  // 追加: 保険
  { id: 29, category: 'insurance', name: '三井住友海上 海外旅行保険', provider: '三井住友海上', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Sumitomo_Mitsui_Financial_Group_logo.svg/1200px-Sumitomo_Mitsui_Financial_Group_logo.svg.png', badge: '24時間サポート', specs: [{ label: '保険料', value: '1,350円~' }, { label: '治療救援', value: '無制限' }, { label: 'サポート', value: '日本語対応' }] },
  { id: 30, category: 'insurance', name: '損保ジャパン 海外旅行保険', provider: '損保ジャパン', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Mitsubishi_UFJ_Financial_Group_logo.svg/2560px-Mitsubishi_UFJ_Financial_Group_logo.svg.png', badge: 'Web割引', specs: [{ label: '保険料', value: '1,100円~' }, { label: '治療救援', value: '5,000万円' }, { label: 'サポート', value: '24時間' }] },
  // 追加: ポイント
  { id: 31, category: 'points', name: 'Pontaポイント', provider: 'ロイヤリティマーケティング', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Ponta_logo.svg/2560px-Ponta_logo.svg.png', badge: '全国展開', specs: [{ label: '還元率', value: '0.5%~2.0%' }, { label: '提携', value: 'ガソリンスタンド' }, { label: '特典', value: 'Ponta倍' }] },
]

export default function ProductPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialCategory = searchParams.get('category') || 'all'
  const [activeCategory, setActiveCategory] = useState(initialCategory)
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

  const filteredProducts = activeCategory === 'all'
    ? PRODUCTS
    : PRODUCTS.filter((p) => p.category === activeCategory)

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
        {/* 広告バナー */}
        <div className="mb-8">
          <AdBanner variant="horizontal" />
        </div>

        {/* 商品リスト */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProducts.map((product) => {
            const isSelected = compareList.find((p) => p.id === product.id)
            return (
              <div
                key={product.id}
                className={`group relative bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border transition-all duration-300 ${
                  isSelected
                    ? 'border-orange-500 ring-2 ring-orange-500/20 shadow-xl transform -translate-y-1'
                    : 'border-slate-200 dark:border-slate-800 hover:border-orange-500 hover:shadow-lg'
                }`}
              >
                <button
                  onClick={() => toggleCompare(product)}
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
              </div>
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
                      <button className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-bold text-sm shadow-md transition">
                        選択
                      </button>
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
