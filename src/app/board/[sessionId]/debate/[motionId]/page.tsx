import DebateView from '@/components/board/DebateView';

export default async function StudentDebatePage({
  params,
}: {
  params: Promise<{ sessionId: string; motionId: string }>;
}) {
  const { sessionId, motionId } = await params;
  return <DebateView sessionId={sessionId} motionId={motionId} />;
}
