import TeacherAuthGate from '@/components/teacher/TeacherAuthGate';
import DebateStudio from '@/components/teacher/DebateStudio';

export default function DebatePage() {
  return (
    <TeacherAuthGate>
      <DebateStudio />
    </TeacherAuthGate>
  );
}
