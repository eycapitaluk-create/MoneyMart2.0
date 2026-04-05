import { useState, useRef, useEffect } from 'react'
import { Send, MessageCircle, X } from 'lucide-react'
import { sendMessage } from '../lib/chatbotApi'

export default function CustomerChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'MoneyMart입니다. 어떻게 도와드릴까요? 📈',
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setError(null)

    // Add user message to chat
    const updatedMessages = [
      ...messages,
      { role: 'user', content: userMessage },
    ]
    setMessages(updatedMessages)

    // Send to API
    setIsLoading(true)
    const result = await sendMessage(updatedMessages)
    setIsLoading(false)

    if (result.success) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: result.message },
      ])
    } else {
      setError(result.message)
      // Remove the user message if failed
      setMessages(updatedMessages.slice(0, -1))
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors z-40"
        aria-label="Open chat"
      >
        <MessageCircle size={24} />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 max-h-96 bg-white rounded-lg shadow-xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-blue-600 text-white rounded-t-lg">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageCircle size={20} />
          MoneyMart 고객 상담
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="hover:bg-blue-700 p-1 rounded transition-colors"
          aria-label="Close chat"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-800 rounded-bl-none'
              }`}
            >
              <p className="text-sm">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg rounded-bl-none">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="flex justify-start">
            <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg rounded-bl-none text-sm">
              {error}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSendMessage}
        className="border-t p-4 flex gap-2 bg-white rounded-b-lg"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요..."
          disabled={isLoading}
          className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          aria-label="Send message"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  )
}
