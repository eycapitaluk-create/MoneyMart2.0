import { Sparkles } from 'lucide-react'

export default function RoboPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Sparkles className="mx-auto text-orange-500 mb-6" size={64} />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">ロボアドバイザー</h1>
        <p className="text-slate-600 dark:text-slate-400">AIによる資産運用アドバイス機能を準備中です。</p>
      </div>
    </div>
  )
}
