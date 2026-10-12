import { Component } from 'react'
import { trackAnalyticsEvent } from '../lib/analytics'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info?.componentStack)
    const message = String(error?.message || error || '').slice(0, 500)
    const stack = String(error?.stack || '').slice(0, 1500)
    const componentStack = String(info?.componentStack || '').slice(0, 1500)
    trackAnalyticsEvent('react_error_boundary', {
      message,
      stack,
      component_stack: componentStack,
      boundary_scope: String(this.props.boundaryScope || ''),
    })
  }

  render() {
    const { error } = this.state
    const heading = String(this.props.heading || '').trim() || '表示中に問題が発生しました'
    const hint = String(this.props.hint || '').trim() || 'ページを再読み込みするか、しばらく時間をおいて再度お試しください。'
    if (error) {
      return (
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">{heading}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
            {hint}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 dark:bg-orange-500 text-white text-sm font-black px-5 py-2.5 hover:opacity-90"
            >
              再読み込み
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm font-bold px-5 py-2.5 hover:opacity-90"
            >
              ホームへ
            </a>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
