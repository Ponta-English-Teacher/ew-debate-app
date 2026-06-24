'use client';

import type { Argument, ReactionType } from '@/types';
import type { FormState } from './MotionRiver';
import ArgumentNode from './ArgumentNode';

interface Props {
  claim: Argument;
  responses: Argument[];
  sessionId: string;
  motionId: string;
  motionText: string;
  studentId: string;
  form: FormState;
  onFormChange: (state: FormState) => void;
  onSubmitted: (arg: Argument) => void;
  onReactionChange: (argumentId: string, reactionType: ReactionType, active: boolean) => void;
  onExplain?: (id: string) => void;
  onDeleted?: (argumentId: string) => void;
}

export default function ArgumentCluster({
  claim,
  responses,
  motionId,
  motionText,
  studentId,
  form,
  onFormChange,
  onReactionChange,
  onExplain,
  onDeleted,
}: Props) {
  const isAnyFormOpen = form.kind !== 'closed';

  // Parent → direct-children map from flat descendants list
  const childrenMap = new Map<string, Argument[]>();
  responses.forEach(r => {
    const pid = r.parent_id!;
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid)!.push(r);
  });

  function renderThread(parentId: string, depth: number): React.ReactNode {
    const children = childrenMap.get(parentId);
    if (!children?.length) return null;

    return (
      <div className={`mt-2 ${depth === 0 ? 'ml-4 pl-3' : 'ml-3 pl-2.5'} border-l border-slate-200 flex flex-col gap-2.5`}>
        {children.map(response => {
          const directChildCount = childrenMap.get(response.id)?.length ?? 0;
          return (
            <div key={response.id}>
              <ArgumentNode
                argument={response}
                studentId={studentId}
                motionText={motionText}
                replyCount={directChildCount > 0 ? directChildCount : undefined}
                onReactionChange={onReactionChange}
                onBuildOn={
                  !isAnyFormOpen
                    ? (arg) => onFormChange({ kind: 'modal-response', motionId, parent: arg })
                    : undefined
                }
                onExplain={onExplain}
                onDeleted={onDeleted}
              />
              {renderThread(response.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <ArgumentNode
        argument={claim}
        studentId={studentId}
        motionText={motionText}
        replyCount={responses.length > 0 ? responses.length : undefined}
        onReactionChange={onReactionChange}
        onBuildOn={
          !isAnyFormOpen
            ? (arg) => onFormChange({ kind: 'modal-response', motionId, parent: arg })
            : undefined
        }
        onExplain={onExplain}
        onDeleted={onDeleted}
      />
      {renderThread(claim.id, 0)}
    </div>
  );
}
