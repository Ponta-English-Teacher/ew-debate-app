import TeacherAuthGate from '@/components/teacher/TeacherAuthGate';
import SessionDetail from '@/components/teacher/SessionDetail';

export default function SessionDetailPage() {
  return (
    <TeacherAuthGate>
      <SessionDetail />
    </TeacherAuthGate>
  );
}
