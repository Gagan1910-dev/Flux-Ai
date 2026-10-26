import React, { useState } from 'react';

export default function VerificationPanel({
  verification,
  onOpenEvidence,
  onSelectFollowUp,
}) {
  if (!verification) return null;

  const {
    state,
    statusLabel,
    confidenceReason,
    missingInformation,
    suggestedFollowUp,
    conflictDetails,
    sources = [],
    retrievedContext = [],
  } = verification;

  // Collapsible toggle state for technical verification details
  const [detailsOpen, setDetailsOpen] = useState(false);

  // 💬 Conversational State: keep footer minimal and friendly
  if (state === 'conversational') {
    return (
      <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <span>Flux Conversational Assistant</span>
        </div>

        {suggestedFollowUp && (
          <button
            onClick={() => onSelectFollowUp && onSelectFollowUp(suggestedFollowUp)}
            className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-indigo-300 transition-colors group"
            title="Click to ask this question"
          >
            <span className="text-slate-500">💡 Try:</span>
            <span className="text-indigo-300/90 font-medium group-hover:underline truncate max-w-[280px]">
              "{suggestedFollowUp}"
            </span>
            <span className="text-[10px] text-indigo-400 opacity-60 group-hover:opacity-100">↵</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2.5">
      {/* ── Status Header Row ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {state === 'supported' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>{statusLabel || 'Supported by sources'}</span>
              {sources && sources.length > 0 && (
                <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.2 rounded-full font-bold">
                  {sources.length} {sources.length === 1 ? 'citation' : 'citations'}
                </span>
              )}
            </span>
          )}

          {state === 'conflicting' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{statusLabel || 'Conflicting sources detected'}</span>
            </span>
          )}

          {state === 'insufficient' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800/90 text-slate-300 border border-slate-700">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{statusLabel || 'Insufficient evidence in documents'}</span>
            </span>
          )}

          {/* Quick Suggested Prompt Chip (for insufficient evidence) */}
          {state === 'insufficient' && suggestedFollowUp && (
            <button
              onClick={() => onSelectFollowUp && onSelectFollowUp(suggestedFollowUp)}
              className="inline-flex items-center gap-1 text-[11px] text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-2 py-0.5 rounded-full transition-colors group"
              title="Click to ask this related question"
            >
              <span className="text-slate-400">💡 Try:</span>
              <span className="font-medium group-hover:underline truncate max-w-[220px]">
                "{suggestedFollowUp}"
              </span>
              <span className="text-[10px] text-indigo-400 opacity-60">↵</span>
            </button>
          )}
        </div>

        {/* Action Controls: Inspect Evidence & Collapsible Toggle */}
        <div className="flex items-center gap-1.5">
          {/* Inspect Evidence Button — strictly for genuine supporting/conflicting sources */}
          {state !== 'insufficient' && sources && sources.length > 0 && (
            <button
              onClick={() => onOpenEvidence && onOpenEvidence(0, 'supporting')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-1 rounded-md hover:bg-indigo-500/10"
              title="Inspect supporting source documents"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>Inspect Evidence</span>
            </button>
          )}

          {/* Collapsible Details Toggle ("Why this answer?" / "Verification details") */}
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded-md hover:bg-slate-800"
            title={detailsOpen ? "Hide technical verification details" : "Show technical verification details"}
          >
            <span>{state === 'conflicting' ? 'View claims' : 'Why this answer?'}</span>
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${detailsOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Source Citations Quick-Pills Row (Only when sources actually exist) ── */}
      {state !== 'insufficient' && sources && sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mr-1">
            Cited Sources:
          </span>
          {sources.map((src, i) => (
            <button
              key={i}
              onClick={() => onOpenEvidence && onOpenEvidence(i, 'supporting')}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors group"
              title={`Click to view passage for ${src.title}`}
            >
              <span className="text-slate-400 group-hover:text-indigo-400">📄</span>
              <span className="font-medium text-slate-200 truncate max-w-[170px]">{src.title}</span>
              {src.pageNumber && (
                <span className="text-[10px] text-slate-400 bg-slate-800 px-1 rounded">p.{src.pageNumber}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── EXPANDABLE TECHNICAL VERIFICATION DETAILS ── */}
      {detailsOpen && (
        <div className="mt-2 p-3 rounded-xl bg-slate-900/90 border border-slate-800/90 text-xs text-slate-300 space-y-2.5 animate-in fade-in duration-200">
          {/* A. Supported State Details */}
          {state === 'supported' && (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="font-semibold text-emerald-400 flex-shrink-0">Verification Rationale:</span>
                <p className="text-slate-300 leading-relaxed">
                  {confidenceReason || "Answer synthesized exclusively from verified internal document passages."}
                </p>
              </div>

              {sources.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400">Source Document Relevance:</span>
                  <div className="space-y-1">
                    {sources.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/50 px-2 py-1 rounded">
                        <span className="truncate max-w-[260px] text-slate-300 font-medium">{s.title}</span>
                        <div className="flex items-center gap-2">
                          {s.pageNumber && <span className="text-slate-400">Page {s.pageNumber}</span>}
                          {s.relevanceScore !== undefined && (
                            <span className="text-emerald-400 font-semibold">{s.relevanceScore}% match</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* B. Insufficient State Details */}
          {state === 'insufficient' && (
            <div className="space-y-2.5">
              {missingInformation && (
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-amber-400/90 flex-shrink-0">Missing Context:</span>
                  <p className="text-slate-300 leading-relaxed">{missingInformation}</p>
                </div>
              )}

              {confidenceReason && (
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-slate-400 flex-shrink-0">Confidence:</span>
                  <p className="text-slate-400 leading-relaxed">{confidenceReason}</p>
                </div>
              )}

              {/* Clearly distinguish candidate retrieved context from proof */}
              {retrievedContext && retrievedContext.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-400">
                    {retrievedContext.length} related passages inspected by search (did not contain requested facts).
                  </span>
                  <button
                    onClick={() => onOpenEvidence && onOpenEvidence(0, 'context')}
                    className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors flex items-center gap-1"
                  >
                    <span>Inspect Retrieved Context</span>
                    <span>→</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* C. Conflicting State Details */}
          {state === 'conflicting' && conflictDetails && (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold flex-shrink-0">⚠️ Analysis:</span>
                <p className="text-slate-300 leading-relaxed">{conflictDetails.summary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                {conflictDetails.claimA && (
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-amber-500/20 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                      <span className="truncate">{conflictDetails.claimA.source || 'Policy A'}</span>
                      {conflictDetails.claimA.dateOrVersion && (
                        <span className="text-[10px] text-slate-400 font-normal">{conflictDetails.claimA.dateOrVersion}</span>
                      )}
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      "{conflictDetails.claimA.claim}"
                    </p>
                  </div>
                )}

                {conflictDetails.claimB && (
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-amber-500/20 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                      <span className="truncate">{conflictDetails.claimB.source || 'Policy B'}</span>
                      {conflictDetails.claimB.dateOrVersion && (
                        <span className="text-[10px] text-slate-400 font-normal">{conflictDetails.claimB.dateOrVersion}</span>
                      )}
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      "{conflictDetails.claimB.claim}"
                    </p>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-amber-400/80 italic border-t border-amber-500/20 pt-1.5">
                Flux Verify does not assume which policy is authoritative. Check with the document owner to confirm the superseding version.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
