import { Component } from 'react'

// Catches a render error in one part of the games UI so it can't blank the
// whole page. The real error is logged to the console for debugging.
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', this.props.label || 'section', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    if (this.props.fallback) return this.props.fallback({ reset: () => this.setState({ error: null }) })
    return (
      <div role="alert" className="fixed inset-0 z-[10020] flex flex-col items-center justify-center gap-4 bg-[rgba(30,60,100,0.45)] p-6 text-center" style={{ fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }}>
        <div className="w-full max-w-[420px] rounded-[28px] bg-[#FFFDF8] p-7 shadow-xl">
          <h2 className="text-[26px] font-extrabold text-[#2B2A4C]" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>Something went wrong</h2>
          <p className="mt-2 text-[15px] text-[#5A5670]">Your progress up to this point is safe. Let's go back to the games.</p>
          <button
            type="button"
            onClick={() => { this.setState({ error: null }); this.props.onReset?.() }}
            className="mt-5 h-14 w-full rounded-2xl bg-[#F59E0B] text-[18px] font-extrabold text-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]"
          >
            Back to games
          </button>
        </div>
      </div>
    )
  }
}
