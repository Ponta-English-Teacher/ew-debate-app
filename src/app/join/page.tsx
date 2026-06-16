import StudentJoinForm from '@/components/student/StudentJoinForm';
import { i18n } from '@/lib/i18n';

export default function JoinPage() {
  const t = i18n.landing;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F8F9FF 60%, #FFF7ED 100%)' }}
    >
      <div className="mb-3 w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-slate-800 mb-1 tracking-tight">{t.title}</h1>
      <p className="text-slate-500 text-sm mb-8">{t.subtitle}</p>

      <div className="w-full max-w-sm">
        <StudentJoinForm />
      </div>
    </div>
  );
}
