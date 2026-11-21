import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('OtherSide crashed:', error)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center shadow-2xl">
          <h1 className="font-display text-2xl font-bold">OtherSide paused</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Something went wrong on the stage. Restart the demo to return to a clean state.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-rose-400"
          >
            Restart demo
          </button>
        </div>
      </main>
    )
  }
}

