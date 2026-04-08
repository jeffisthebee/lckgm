import React from 'react';
import { Link } from 'react-router-dom';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Keep console output for debugging white-screen crashes
    // (Do not throw; boundary UI will render)
    console.error('[UI Crash]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message || String(this.state.error || 'Unknown error');
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-white rounded-2xl border shadow-lg p-6">
          <div className="text-2xl font-black text-gray-900 mb-2">화면 오류가 발생했습니다</div>
          <div className="text-sm text-gray-600 mb-4">
            아래 버튼으로 홈으로 이동하거나 새로고침하면 대부분 복구됩니다.
          </div>

          <div className="bg-gray-50 border rounded-lg p-3 text-xs font-mono text-gray-700 mb-5 overflow-auto max-h-40">
            {msg}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white font-bold hover:bg-black transition"
            >
              새로고침
            </button>
            <Link
              to="/"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition text-center"
            >
              홈으로 이동
            </Link>
          </div>
        </div>
      </div>
    );
  }
}

