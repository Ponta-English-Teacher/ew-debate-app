import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
         style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F8F9FF 60%, #FFF7ED 100%)' }}>
      <div className="mb-6 w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">
        EW Debate
      </h1>
      <p className="text-slate-500 text-sm max-w-xs mb-8">
        Enter your class code to join a debate session.
      </p>

      <Link
        href="/join"
        className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl px-6 py-2.5 mb-4 transition-colors"
      >
        Join Session
      </Link>

      <Link
        href="/teacher"
        className="text-xs text-slate-400 hover:text-indigo-600 transition-colors"
      >
        Teacher panel
      </Link>
    </div>
  );
}
