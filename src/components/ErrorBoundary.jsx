import { Component } from 'react'

/**
 * Lightweight React error boundary for critical route islands (e.g. stocks).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message ? String(error.message) : 'Unexpected error',
    }
  }

  componentDidCatch(error, info) {
    if (typeof console !== 'undefined') {
      console.error('[ErrorBoundary]', this.props.boundaryScope || 'app', error, info)
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const heading = this.props.heading || '表示中に問題が発生しました'
    const hint = this.props.hint || '再読み込みするか、しばらく時間をおいて再度お試しください。'

    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{heading}</h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{hint}</p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          再試行
        </button>
      </div>
    )
  }
}
