'use client';

import type { Motion, Argument } from '@/types';
import type { FormState, Cluster } from './MotionRiver';
import { i18n } from '@/lib/i18n';
import ArgumentForm from './ArgumentForm';
import ArgumentCluster from './ArgumentCluster';
import AIDiscussionModal from './AIDiscussionModal';

interface Props {
  motion: Motion;
  sessionId: string;
  studentId: string;
  clusters: Cluster[];
  form: FormState;
  onFormChange: (state: FormState) => void;
  onSubmitted: (arg: Argument) => void;
  onVoteChange: (argumentId: string, voted: boolean) => void;
}

export default function MotionLane({
  motion,
  sessionId,
  studentId,
  clusters,
  form,
  onFormChange,
  onSubmitted,
  onVoteChange,
}: Props) {
  const isClaimFormOpen = form.kind === 'claim' && form.motionId === motion.id;
  const isAnyFormOpen = form.kind !== 'closed';
  const isModalOpen =
    (form.kind === 'modal-claim' || form.kind === 'modal-response') &&
    form.motionId === motion.id;

  return (
    <div className="flex-shrink-0 w-80 flex flex-col gap-2 h-full overflow-y-auto pr-0.5">

      {/* Motion header — slim, sticky within lane scroll */}
      <div className="bg-white/90 rounded-lg border border-slate-200 px-3 py-2 sticky top-0 z-10 shadow-sm shrink-0">
        <p className="text-xs font-semibold text-slate-700 leading-tight">{motion.motion_text}</p>
      </div>

      {/* Claim form */}
      {isClaimFormOpen && (
        <ArgumentForm
          sessionId={sessionId}
          motionId={motion.id}
          studentId={studentId}
          mode="claim"
          onSubmitted={onSubmitted}
          onCancel={() => onFormChange({ kind: 'closed' })}
        />
      )}

      {/* Contribution prompt — opens AI modal */}
      {!isAnyFormOpen && (
        <button
          onClick={() => onFormChange({ kind: 'modal-claim', motionId: motion.id })}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400 text-left hover:border-indigo-300 hover:text-slate-500 transition-colors shrink-0"
        >
          {i18n.board.promptMotion}
        </button>
      )}

      {/* Empty state */}
      {clusters.length === 0 && !isClaimFormOpen && (
        <p className="text-xs text-slate-400 text-center py-4 px-2">{i18n.board.noArguments}</p>
      )}

      {/* Argument clusters */}
      <div className="flex flex-col gap-1.5 pb-2">
        {clusters.map(({ claim, responses }) => (
          <ArgumentCluster
            key={claim.id}
            claim={claim}
            responses={responses}
            sessionId={sessionId}
            motionId={motion.id}
            studentId={studentId}
            form={form}
            onFormChange={onFormChange}
            onSubmitted={onSubmitted}
            onVoteChange={onVoteChange}
          />
        ))}
      </div>

      {/* AI discussion modal — renders as a fixed overlay */}
      {isModalOpen && (
        <AIDiscussionModal
          motionText={motion.motion_text}
          parentContent={form.kind === 'modal-response' ? form.parent.content : undefined}
          parentId={form.kind === 'modal-response' ? form.parent.id : undefined}
          mode={form.kind === 'modal-claim' ? 'claim' : 'response'}
          sessionId={sessionId}
          motionId={motion.id}
          studentId={studentId}
          onSubmitted={(arg) => { onFormChange({ kind: 'closed' }); onSubmitted(arg); }}
          onCancel={() => onFormChange({ kind: 'closed' })}
        />
      )}
    </div>
  );
}
