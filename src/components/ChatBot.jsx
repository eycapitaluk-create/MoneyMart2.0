import { useState, useRef, useEffect } from 'react'
import {
  MessageCircle, X, Send, Mail, Bot,
  ChevronLeft, Loader2
} from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState('chat') // 'chat' | 'contact'
  const [isTyping, setIsTyping] = useState(false)

  const [messages, setMessages] = useState([
    { id: 1, sender: 'bot', text: 'こんにちは！MoneyMart AI アシスタントです。資産運用やローンについて、何かお手伝いしましょうか？' }
  ])
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef(null)

  const [contactForm, setContactForm] = useState({ email: '', message: '' })
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen, mode])

  useEffect(() => {
    const openChat = () => {
      setIsOpen(true)
      setMode('chat')
    }
    const openContact = () => {
      setIsOpen(true)
      setMode('contact')
    }
    window.addEventListener('mm:open-chat', openChat)
    window.addEventListener('mm:open-contact', openContact)
    return () => {
      window.removeEventListener('mm:open-chat', openChat)
      window.removeEventListener('mm:open-contact', openContact)
    }
  }, [])

  const handleSendMessage = () => {
    if (!inputText.trim()) return

    const userMsg = { id: Date.now(), sender: 'user', text: inputText }
    setMessages(prev => [...prev, userMsg])
    setInputText('')
    setIsTyping(true)

    setTimeout(() => {
      let botResponse = '申し訳ありません。その質問にはまだ答えられません。右上のメールアイコンから担当者へご連絡ください。'

      if (inputText.includes('NISA')) botResponse = '新NISAについては、年間360万円まで非課税で投資可能です。つみたて投資枠と成長投資枠があります。'
      else if (inputText.includes('ローン') || inputText.includes('金利')) botResponse = '住宅ローンシミュレーターは「ローン診断」ページからご利用いただけます。最新の変動金利は0.3%台からです。'
      else if (inputText.includes('こんにちは')) botResponse = 'こんにちは！今日も資産運用頑張りましょう。'
      else if (inputText.includes('プレミアム')) botResponse = 'プレミアムプランでは、AIによるポートフォリオ診断や限定レポートが見放題になります。'

      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'bot', text: botResponse }])
      setIsTyping(false)
    }, 1000)
  }

  const handleContactSubmit = async (e) => {
    e.preventDefault()
    if (!contactForm.email || !contactForm.message) return

    setIsSending(true)
    try {
      const { error } = await supabase
        .from('support_inquiries')
        .insert({
          email: contactForm.email,
          message: contactForm.message,
          source: 'chatbot',
          status: 'new',
        })
      if (error) throw error
      alert('お問い合わせを受け付けました。\n担当者より24時間以内にメールでご連絡いたします。')
      setContactForm({ email: '', message: '' })
      setMode('chat')
      setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: 'お問い合わせありがとうございます。担当者からの連絡をお待ちください。' }])
    } catch {
      alert('送信に失敗しました。しばらくしてから再度お試しください。')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed bottom-24 md:bottom-6 right-6 z-[9999] font-sans">
      <button
        id="chatbot-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative ${isOpen ? 'bg-slate-800 dark:bg-slate-200 rotate-90' : 'bg-gradient-to-r from-orange-500 to-red-500'} w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-white dark:text-slate-900 hover:scale-110 transition duration-300 group`}
        aria-label="チャット"
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={32} className="group-hover:rotate-12 transition" />}
        {!isOpen && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-600 rounded-full border-2 border-white" />
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-20 right-0 w-[90vw] md:w-96 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col transition-all duration-300 animate-slideUp origin-bottom-right h-[600px] max-h-[80vh]">
          <div className="bg-slate-900 dark:bg-slate-800 p-4 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center gap-3">
              {mode === 'contact' ? (
                <button onClick={() => setMode('chat')} className="hover:bg-white/10 p-1 rounded-full transition">
                  <ChevronLeft size={20} />
                </button>
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-pink-500 rounded-full flex items-center justify-center shadow-inner">
                  <Bot size={24} className="text-white" />
                </div>
              )}
              <div>
                <h3 className="font-bold text-lg leading-tight">
                  {mode === 'chat' ? 'MoneyMart AI' : 'お問い合わせ'}
                </h3>
                <p className="text-[10px] text-slate-300 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  {mode === 'chat' ? 'Online' : 'Support Team'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {mode === 'chat' && (
                <button
                  onClick={() => setMode('contact')}
                  className="p-2 hover:bg-white/10 rounded-full transition text-slate-300 hover:text-white"
                  title="メールで問い合わせ"
                >
                  <Mail size={20} />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition text-slate-300 hover:text-white">
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4">
            {mode === 'chat' && (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.sender === 'user'
                        ? 'bg-orange-500 text-white rounded-br-none'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-100 dark:border-slate-700'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-bl-none border border-slate-100 dark:border-slate-700 flex gap-1">
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '75ms' }} />
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {mode === 'contact' && (
              <div className="animate-fadeIn">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mb-6 text-sm text-blue-800 dark:text-blue-200 leading-relaxed border border-blue-100 dark:border-blue-800">
                  AIで解決しない場合は、こちらから担当者へ直接メッセージを送信できます。<br />
                  <span className="text-xs opacity-70 mt-1 block">※ 原則24時間以内に返信いたします。</span>
                </div>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">メールアドレス</label>
                    <input
                      required
                      type="email"
                      placeholder="example@email.com"
                      value={contactForm.email}
                      onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-orange-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">お問い合わせ内容</label>
                    <textarea
                      required
                      rows={6}
                      placeholder="具体的な内容をご記入ください..."
                      value={contactForm.message}
                      onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-orange-500 transition resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSending}
                    className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                  >
                    {isSending ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /> 送信する</>}
                  </button>
                </form>
              </div>
            )}
          </div>

          {mode === 'chat' && (
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="メッセージを入力..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendMessage(); } }}
                  className="w-full pl-4 pr-12 py-3.5 bg-slate-100 dark:bg-slate-800 rounded-full text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/50 transition dark:text-white"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim()}
                  className="absolute right-2 top-2 p-1.5 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  <Send size={18} className="ml-0.5" />
                </button>
              </div>
              <p className="text-center mt-2 text-[10px] text-slate-400">Powered by MoneyMart AI</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
