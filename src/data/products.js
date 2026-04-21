import { CreditCard, Landmark, Plane, Banknote, Coins, Filter } from 'lucide-react'

export const CATEGORIES = [
  { id: 'all', name: 'すべて', icon: Filter },
  { id: 'savings', name: '銀行・預金', icon: Landmark },
  { id: 'cards', name: 'カード', icon: CreditCard },
  { id: 'loans', name: 'ローン', icon: Banknote },
  { id: 'insurance', name: '旅行保険', icon: Plane },
  { id: 'points', name: 'ポイ活', icon: Coins },
]

export const PRODUCTS = [
  // CSV: /Users/justinnam/Desktop/moneymart_data/Untitled 2.csv
  { id: 1, category: 'savings', name: '楽天銀行 スーパー定期', provider: '楽天銀行', image: '', badge: '公式', specs: [{ label: '金利', value: '0.30%' }, { label: '期間', value: '1年' }, { label: '最低預入', value: '¥10,000' }], description: '楽天ポイントと連動', apply_url: 'https://www.rakuten-bank.co.jp/assets/fixeddep/term/' },
  { id: 2, category: 'savings', name: '住信SBIネット銀行', provider: '住信SBIネット銀行', image: '', badge: '公式', specs: [{ label: '金利', value: '0.28%' }, { label: '期間', value: '1年' }, { label: '最低預入', value: '¥1' }], description: 'SBI証券との自動連携機能', apply_url: 'https://www.netbk.co.jp/contents/lineup/yen/hybrid/' },
  { id: 3, category: 'savings', name: 'auじぶん銀行', provider: 'auじぶん銀行', image: '', badge: '公式', specs: [{ label: '金利', value: '0.35%' }, { label: '期間', value: '6か月' }, { label: '最低預入', value: '¥10,000' }], description: 'au関連サービス利用での金利優遇', apply_url: 'https://www.jibunbank.co.jp/interest/' },
  { id: 4, category: 'savings', name: 'ソニー銀行', provider: 'ソニー銀行', image: '', badge: '公式', specs: [{ label: '金利', value: '0.22%' }, { label: '期間', value: '1年' }, { label: '最低預入', value: '¥10,000' }], description: '24時間即時手続き可能', apply_url: 'https://moneykit.net/visitor/fx_fixed/' },
  { id: 5, category: 'savings', name: 'UI銀行', provider: 'UI銀行', image: '', badge: '公式', specs: [{ label: '金利', value: '0.40%' }, { label: '期間', value: '1年' }, { label: '最低預入', value: '¥10,000' }], description: 'デジタルバンクならではの高金利', apply_url: 'https://www.uibank.co.jp/service/deposit/fixed/' },
  { id: 6, category: 'savings', name: 'PayPay銀行', provider: 'PayPay銀行', image: '', badge: '公式', specs: [{ label: '金利', value: '0.27%' }, { label: '期間', value: '6か月' }, { label: '最低預入', value: '¥1,000' }], description: 'PayPay連携キャンペーン充実', apply_url: 'https://www.paypay-bank.co.jp/campaign/index.html' },
  { id: 7, category: 'savings', name: 'GMOあおぞらネット銀行', provider: 'GMOあおぞらネット銀行', image: '', badge: '公式', specs: [{ label: '金利', value: '0.33%' }, { label: '期間', value: '1年' }, { label: '最低預入', value: '¥100,000' }], description: '証券コネクト口座の利便性', apply_url: 'https://gmo-aozora.com/promotion/lp/connect/' },

  { id: 8, category: 'cards', name: '楽天カード', provider: '楽天カード', image: '', badge: '公式', specs: [{ label: '年会費', value: '無料' }, { label: '還元率', value: '1.0%' }, { label: '特典', value: '入会+利用で5,000pt' }], description: '新規入会ポイント特典', apply_url: 'https://www.rakuten-card.co.jp/campaign/' },
  { id: 9, category: 'cards', name: '三井住友カード(NL)', provider: '三井住友カード', image: '', badge: '公式', specs: [{ label: '年会費', value: '永年無料' }, { label: '還元率', value: '0.5%' }, { label: '特典', value: '対象店舗で最大7%' }], description: 'ナンバーレスで高セキュリティ', apply_url: 'https://www.smbc-card.com/nyukai/card/numberless.jsp' },
  { id: 10, category: 'cards', name: 'JCB CARD W', provider: 'JCB', image: '', badge: '公式', specs: [{ label: '年会費', value: '無料' }, { label: '還元率', value: '1.0%' }, { label: '特典', value: 'Amazon利用で2.0%' }], description: '39歳以下限定の高還元', apply_url: 'https://www.jcb.co.jp/promotion/jcb_card_w/' },
  { id: 11, category: 'cards', name: 'PayPayカード', provider: 'PayPayカード', image: '', badge: '公式', specs: [{ label: '年会費', value: '無料' }, { label: '還元率', value: '1.0%' }, { label: '特典', value: 'PayPay利用で1.5%' }], description: 'PayPayポイント還元に特化', apply_url: 'https://www.paypay-card.co.jp/service/000001.html' },
  { id: 12, category: 'cards', name: 'dカード', provider: 'dカード', image: '', badge: '公式', specs: [{ label: '年会費', value: '無料' }, { label: '還元率', value: '1.0%' }, { label: '特典', value: 'd払い連携で優遇' }], description: 'ドコモユーザー向けの還元', apply_url: 'https://dcard.docomo.ne.jp/st/guide/index.html' },
  { id: 13, category: 'cards', name: '三菱UFJカード', provider: '三菱UFJカード', image: '', badge: '公式', specs: [{ label: '年会費', value: '無料' }, { label: '還元率', value: '0.8%' }, { label: '特典', value: '対象店で最大10%' }], description: '特定店舗でのポイント優遇', apply_url: 'https://www.cr.mufg.jp/apply/card/mufgcard_vi/index.html' },
  { id: 14, category: 'cards', name: 'イオンカードセレクト', provider: 'イオンカード', image: '', badge: '公式', specs: [{ label: '年会費', value: '無料' }, { label: '還元率', value: '0.5%' }, { label: '特典', value: 'イオンでポイント2倍' }], description: 'イオングループでの買い物特典', apply_url: 'https://www.aeon.co.jp/card/lineup/select/' },

  { id: 15, category: 'loans', name: '三菱UFJ銀行 バンクイック', provider: '三菱UFJ銀行', image: '', badge: '公式', specs: [{ label: '金利', value: '1.4%〜14.6%' }, { label: '限度額', value: '500万円' }, { label: '無利息期間', value: 'なし' }], description: '銀行ならではの安心感', apply_url: 'https://www.bk.mufg.jp/kariru/card/banquic/index.html' },
  { id: 16, category: 'loans', name: 'アイフル', provider: 'アイフル', image: '', badge: '公式', specs: [{ label: '金利', value: '3.0%〜18.0%' }, { label: '限度額', value: '800万円' }, { label: '無利息期間', value: '最大30日' }], description: '最短20分の即日融資審査', apply_url: 'https://www.aiful.co.jp/first/' },
  { id: 17, category: 'loans', name: 'プロミス', provider: 'プロミス', image: '', badge: '公式', specs: [{ label: '金利', value: '4.5%〜17.8%' }, { label: '限度額', value: '500万円' }, { label: '無利息期間', value: '最大30日' }], description: '30日間無利息サービス', apply_url: 'https://cyber.promise.co.jp/CP01/CP0101_01.do' },
  { id: 18, category: 'loans', name: '三井住友銀行 カードローン', provider: '三井住友銀行', image: '', badge: '公式', specs: [{ label: '金利', value: '1.5%〜14.5%' }, { label: '限度額', value: '800万円' }, { label: '無利息期間', value: 'なし' }], description: '24時間オンライン申込可能', apply_url: 'https://www.smbc.co.jp/kojin/cardloan/shouhin/' },
  { id: 19, category: 'loans', name: 'アコム', provider: 'アコム', image: '', badge: '公式', specs: [{ label: '金利', value: '3.0%〜18.0%' }, { label: '限度額', value: '800万円' }, { label: '無利息期間', value: '最大30日' }], description: '審査スピードと高い成約率', apply_url: 'https://www.acom.co.jp/lineup/cardloan/' },
  { id: 20, category: 'loans', name: 'レイク', provider: 'レイク', image: '', badge: '公式', specs: [{ label: '金利', value: '4.5%〜18.0%' }, { label: '限度額', value: '500万円' }, { label: '無利息期間', value: '最大60日' }], description: '選べる無利息期間が特徴', apply_url: 'https://lakealsa.com/service/check/' },
  { id: 21, category: 'loans', name: 'オリックス銀行', provider: 'オリックス銀行', image: '', badge: '公式', specs: [{ label: '金利', value: '1.7%〜14.8%' }, { label: '限度額', value: '800万円' }, { label: '無利息期間', value: 'なし' }], description: 'ガン保障付きプランの提供', apply_url: 'https://www.orixbank.co.jp/personal/cardloan/' },

  { id: 22, category: 'insurance', name: '損保ジャパン (off!)', provider: '損保ジャパン', image: '', badge: '公式', specs: [{ label: '保険料', value: '¥1,450〜' }, { label: '治療救援', value: '無制限' }, { label: 'サポート', value: '24時間日本語' }], description: 'ネット申込専用割引価格', apply_url: 'https://www.sompo-japan.co.jp/kinsurance/leisure/off/' },
  { id: 23, category: 'insurance', name: '三井住友海上', provider: '三井住友海上', image: '', badge: '公式', specs: [{ label: '保険料', value: '¥1,620〜' }, { label: '治療救援', value: '5,000万円' }, { label: 'サポート', value: '24時間日本語' }], description: '24時間日本語サポート体制', apply_url: 'https://www.ms-ins.com/personal/travel/kaigai/' },
  { id: 24, category: 'insurance', name: 'エイチ・エス損保', provider: 'エイチ・エス損保', image: '', badge: '公式', specs: [{ label: '保険料', value: '¥1,280〜' }, { label: '治療救援', value: '3,000万円' }, { label: 'サポート', value: 'LINE相談対応' }], description: '業界最安水準の保険料', apply_url: 'https://www.hs-sonpo.co.jp/travel/' },
  { id: 25, category: 'insurance', name: '東京海上日動', provider: '東京海上日動', image: '', badge: '公式', specs: [{ label: '保険料', value: '¥1,780〜' }, { label: '治療救援', value: '無制限' }, { label: 'サポート', value: '家族特約あり' }], description: '大手ならではの多様なプラン', apply_url: 'https://www.tokiomarine-nichido.co.jp/service/travel/kaigai/' },
  { id: 26, category: 'insurance', name: 'au損保', provider: 'au損保', image: '', badge: '公式', specs: [{ label: '保険料', value: '¥1,500〜' }, { label: '治療救援', value: '2,000万円' }, { label: 'サポート', value: '当日申込可' }], description: '当日申込可能な利便性', apply_url: 'https://www.au-sonpo.co.jp/pc/kaigai/' },
  { id: 27, category: 'insurance', name: '楽天損保', provider: '楽天損保', image: '', badge: '公式', specs: [{ label: '保険料', value: '¥1,560〜' }, { label: '治療救援', value: '5,000万円' }, { label: 'サポート', value: '楽天ポイント利用可' }], description: '楽天ポイントでの支払対応', apply_url: 'https://www.rakuten-sonpo.co.jp/family/tabi/' },
  { id: 28, category: 'insurance', name: 'AIG損保', provider: 'AIG損保', image: '', badge: '公式', specs: [{ label: '保険料', value: '¥1,980〜' }, { label: '治療救援', value: '無制限' }, { label: 'サポート', value: '世界90拠点サポート' }], description: '世界最大級のサポート網', apply_url: 'https://www.aig.co.jp/sonpo/personal/product/travel' },

  { id: 29, category: 'points', name: 'Hapitas (楽天カード)', provider: 'Hapitas', image: '', badge: '公式', specs: [{ label: '還元率', value: '10.0%' }, { label: '獲得条件', value: '新規カード発行' }, { label: '付与時期', value: '判定後45日' }], description: '高還元カード発行案件', apply_url: 'https://hapitas.jp/item/detail/itemid/35520/' },
  { id: 30, category: 'points', name: 'Moppy (SBI証券)', provider: 'Moppy', image: '', badge: '公式', specs: [{ label: '還元率', value: '12.0%' }, { label: '獲得条件', value: '証券口座開設' }, { label: '付与時期', value: '判定後60日' }], description: '証券口座開設の高額還元', apply_url: 'https://pc.moppy.jp/ad/detail.php?s_id=141113' },
  { id: 31, category: 'points', name: 'Point Town (U-NEXT)', provider: 'Point Town', image: '', badge: '公式', specs: [{ label: '還元率', value: '8.0%' }, { label: '獲得条件', value: '無料体験申込' }, { label: '付与時期', value: '判定後30日' }], description: '無料体験で即時ポイント', apply_url: 'https://www.pointtown.com/ads/10101' },
  { id: 32, category: 'points', name: 'Point Income', provider: 'Point Income', image: '', badge: '公式', specs: [{ label: '還元率', value: '6.0%' }, { label: '獲得条件', value: 'アプリ新規登録' }, { label: '付与時期', value: '判定後30日' }], description: 'TikTok Lite連携案件', apply_url: 'https://pointi.jp/ad/162818/' },
  { id: 33, category: 'points', name: 'ECNavi (Recruit)', provider: 'ECNavi', image: '', badge: '公式', specs: [{ label: '還元率', value: '9.0%' }, { label: '獲得条件', value: 'カード発行完了' }, { label: '付与時期', value: '判定後45日' }], description: 'リクルートカード発行特典', apply_url: 'https://ecnavi.jp/ad/100465/' },
  { id: 34, category: 'points', name: 'Chobi Rich', provider: 'Chobi Rich', image: '', badge: '公式', specs: [{ label: '還元率', value: '7.0%' }, { label: '獲得条件', value: '口座+カード申込' }, { label: '付与時期', value: '判定後60日' }], description: 'ファミマTカード発行キャンペーン', apply_url: 'https://www.chobirich.com/ad/2290/' },
  { id: 35, category: 'points', name: 'Gendama (Olive)', provider: 'Gendama', image: '', badge: '公式', specs: [{ label: '還元率', value: '11.0%' }, { label: '獲得条件', value: 'Olive口座開設' }, { label: '付与時期', value: '判定後45日' }], description: 'Olive口座開設キャンペーン', apply_url: 'https://www.gendama.jp/service/item/200000000/' },
]

export const getProductById = (id) => {
  const raw = String(id ?? '').trim()
  const parsed = Number(raw)
  return PRODUCTS.find((p) => String(p.id) === raw || (!Number.isNaN(parsed) && p.id === parsed))
}

