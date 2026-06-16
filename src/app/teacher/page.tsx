import TeacherAuthGate from '@/components/teacher/TeacherAuthGate';
import TeacherPanel from '@/components/teacher/TeacherPanel';

export default function TeacherPage() {
  return (
    <TeacherAuthGate>
      <TeacherPanel />
    </TeacherAuthGate>
  );
}
