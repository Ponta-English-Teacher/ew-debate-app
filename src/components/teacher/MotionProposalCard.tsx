'use client';

import { CHECK_LABELS, type MotionProposal } from '@/lib/motionDesigner';

interface Props {
  proposal:       MotionProposal;
  // When set, every motion slot is full and the teacher must pick one to replace
  replaceChoices?: string[];
  disabledReason?: string;
  onUse:          (replaceIndex?: number) => void;
  onRefine:       () => void;
}

export default function MotionProposalCard({ proposal, replaceChoices, disabledReason, onUse, onRefine }: Props) {
  const checks = Object.entries(proposal.checks) as Array<[keyof MotionProposal['checks'], MotionProposal['checks'][keyof MotionProposal['checks']]]>;
  const warnings = checks.filter(([, c]) => !c.ok);

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5">
      <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mb-1">Proposed motion</p>
      <p className="text-sm font-semibold text-slate-800 leading-snug mb-3">&ldquo;{proposal.motion}&rdquo;</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-white border border-emerald-100 px-2.5 py-2">
          <p className="text-[10px] font-bold text-emerald-600 mb-1">PRO</p>
          <ul className="space-y-0.5">
            {proposal.pro.map((p, i) => (
              <li key={i} className="text-xs text-slate-600 leading-snug">• {p}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg bg-white border border-rose-100 px-2.5 py-2">
          <p className="text-[10px] font-bold text-rose-600 mb-1">CON</p>
          <ul className="space-y-0.5">
            {proposal.con.map((c, i) => (
              <li key={i} className="text-xs text-slate-600 leading-snug">• {c}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Quality checks */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span className="text-[10px] text-slate-400" title="The AI's own quick review. Use your professional judgement.">AI quick check:</span>
        {checks.map(([key, check]) => (
          <span
            key={key}
            title={check.note}
            className={`text-[10px] font-medium rounded-full px-2 py-0.5 border ${
              check.ok
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {check.ok ? '✓' : '⚠'} {CHECK_LABELS[key]}
          </span>
        ))}
      </div>
      {warnings.map(([key, check]) => (
        <p key={key} className="text-[11px] text-amber-700 leading-snug mb-1">
          ⚠ {CHECK_LABELS[key]}: {check.note}
        </p>
      ))}
      {proposal.caution && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 leading-snug mb-1">
          ⚠ {proposal.caution}
        </p>
      )}

      {/* Actions */}
      <div className="mt-3">
        {disabledReason ? (
          <p className="text-[11px] text-slate-500 mb-2">{disabledReason}</p>
        ) : replaceChoices ? (
          <div className="mb-2">
            <p className="text-[11px] text-slate-500 mb-1.5">All 3 motion fields are filled. Replace which one?</p>
            <div className="flex flex-wrap gap-1.5">
              {replaceChoices.map((text, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onUse(i)}
                  title={text}
                  className="text-xs font-medium text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 rounded-lg px-2.5 py-1 transition-colors"
                >
                  Replace Motion {i + 1}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex gap-2">
          {!disabledReason && !replaceChoices && (
            <button
              type="button"
              onClick={() => onUse()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
            >
              Use This Motion
            </button>
          )}
          <button
            type="button"
            onClick={onRefine}
            className="text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg px-3 py-1.5 transition-colors"
          >
            Refine this
          </button>
        </div>
      </div>
    </div>
  );
}
