import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Loader2, Send, X } from 'lucide-react'
import { sendChatbotMessage } from '../lib/chatbotApi'

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function CustomerChatbot() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)

  const hidden = location.pathname?.startsWith('/admin')

  useEffect(() => {
    if (!open || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [open, messages, loading])

  const handleSend = async () => {
    const text = String(input || '').trim()
    if (!text || loading) return
    setInput('')
    setError('')
    const userMsg = { id: nextId(), sender: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)
    try {
      const prior = messages.map(({ sender, text: t }) => ({ sender, text: t }))
      const { reply } = await sendChatbotMessage(text, prior)
      setMessages((prev) => [...prev, { id: nextId(), sender: 'bot', text: reply }])
    } catch (e) {
      const msg = String(e?.message || 'エラーが発生しました')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (hidden) return null

  return (
    <div className="pointer-events-none fixed right-4 z-40 flex flex-col items-end gap-2 max-md:bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 sm:right-6">
      {open ? (
        <div
          className="pointer-events-auto flex max-h-[min(480px,70vh)] w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          role="dialog"
          aria-label="お問い合わせチャット"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/80">
            <p className="text-sm font-black text-slate-800 dark:text-slate-100">MoneyMart サポート</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
              aria-label="閉じる"
            >
              <X size={18} />
            </button>
          </div>
          <p className="border-b border-slate-100 px-3 py-2 text-[11px] leading-snug text-slate-500 dark:border-slate-800 dark:text-slate-400">
            金融に関する一般的なご質問にお答えするサービスです。税務・投資判断につきましては、専門家へのご相談または公式情報のご確認をお勧めいたします。ご質問は日本語にてご入力ください（例：新NISAの種類、ETFの確認方法 など）。
          </p>
          <div
            ref={scrollRef}
            className="min-h-[200px] flex-1 space-y-3 overflow-y-auto px-3 py-3"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-amber-500 text-white dark:bg-amber-600'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400" aria-hidden />
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">回答を生成中…</span>
                </div>
              </div>
            ) : null}
          </div>
          {error ? (
            <p className="px-3 pb-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">{error}</p>
          ) : null}
          <form
            className="border-t border-slate-100 p-2 dark:border-slate-700"
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="メッセージを入力…"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                disabled={loading}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={loading || !String(input || '').trim()}
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-white disabled:opacity-50 dark:bg-amber-600"
                aria-label="送信"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-2xl shadow-lg ring-2 ring-white transition hover:opacity-90 dark:bg-amber-600 dark:ring-slate-900"
        aria-label={open ? 'チャットを閉じる' : 'チャットを開く'}
        aria-expanded={open}
      >
        {open ? <X className="text-white" size={24} /> : <span className="select-none text-2xl leading-none" aria-hidden>💬</span>}
      </button>
    </div>
  )
}
