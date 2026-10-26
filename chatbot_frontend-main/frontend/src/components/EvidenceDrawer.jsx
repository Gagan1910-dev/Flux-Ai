import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EvidenceDrawer({
  isOpen,
  onClose,
  verification,
  activeSourceIndex = 0,
  mode = 'supporting',
}) {
  const [selectedIdx, setSelectedIdx] = useState(activeSourceIndex);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSelectedIdx(activeSourceIndex);
  }, [activeSourceIndex]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !verification) return null;

  const isContextMode = mode === 'context' || verification.state === 'insufficient';
  const displayItems = isContextMode
    ? (verification.retrievedContext && verification.retrievedContext.length > 0
        ? verification.retrievedContext
        : verification.sources || [])
    : (verification.sources && verification.sources.length > 0
        ? verification.sources
        : verification.retrievedContext || []);

  const currentSource = displayItems[selectedIdx] || displayItems[0];

  const handleCopy = () => {
    if (!currentSource) return;
    const textToCopy = `Source: ${currentSource.title}${currentSource.pageNumber ? ` (Page ${currentSource.pageNumber})` : ''}\n\n"${currentSource.passage || currentSource.fullPassage || currentSource.snippet}"`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Drawer Panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-lg h-full bg-[#0E1524] border-l border-slate-800 shadow-2xl flex flex-col z-10 text-slate-200"
        >
          {/* Drawer Header */}
          <div className="p-4 md:p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                  isContextMode
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}
              >
                {isContextMode ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  {isContextMode ? 'Flux Verify Context Inspector' : 'Flux Verify Evidence Inspector'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isContextMode
                    ? `${displayItems.length} candidate passage(s) examined (did not answer query)`
                    : `${displayItems.length} verified passage(s) directly support this answer`}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close (Esc)"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Context Notice if in Insufficient/Context Mode */}
          {isContextMode && (
            <div className="px-4 py-2.5 bg-amber-950/20 border-b border-amber-500/20 text-amber-300 text-[11px] leading-relaxed flex items-start gap-2">
              <span className="text-amber-400 font-bold mt-0.5">ℹ️</span>
              <p>
                <strong>Audit Notice:</strong> These passages were retrieved by similarity search but do <em>not</em> contain the requested facts. They are shown for auditability, not as proof.
              </p>
            </div>
          )}

          {/* Source Tabs if multiple sources */}
          {displayItems.length > 1 && (
            <div className="px-4 py-2 border-b border-slate-800/60 flex items-center gap-2 overflow-x-auto custom-scrollbar bg-slate-950/40">
              {displayItems.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    selectedIdx === idx
                      ? isContextMode
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <span>Passage {idx + 1}</span>
                  {s.pageNumber && <span className="text-[10px] opacity-75">p.{s.pageNumber}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar">
            {currentSource ? (
              <>
                {/* Source Metadata Card */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isContextMode ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {isContextMode ? 'Retrieved Context (No Proof)' : 'Primary Citation'}
                      </span>
                      <h4 className="text-base font-bold text-white mt-0.5">
                        {currentSource.title}
                      </h4>
                    </div>
                    {currentSource.relevanceScore !== undefined && (
                      <span
                        className={`px-2 py-1 rounded-md text-[11px] font-bold border ${
                          isContextMode
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {currentSource.relevanceScore}% {isContextMode ? 'Similarity' : 'Match'}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                    {currentSource.pageNumber ? (
                      <span className="flex items-center gap-1 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50">
                        📄 Page {currentSource.pageNumber}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50 text-slate-400">
                        📄 Section Chk #{currentSource.chunkIndex ?? 0}
                      </span>
                    )}

                    <span className="flex items-center gap-1 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50 text-slate-400">
                      🔒 Verified Role Access
                    </span>
                  </div>
                </div>

                {/* Verbatim Supporting Passage */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <span>{isContextMode ? 'Verbatim Retrieved Text' : 'Verbatim Supporting Passage'}</span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isContextMode ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
                        }`}
                      />
                    </label>
                    <button
                      onClick={handleCopy}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
                    >
                      {copied ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>Copy Passage</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs leading-relaxed font-sans select-text">
                    <p className="whitespace-pre-wrap">
                      "{currentSource.passage || currentSource.fullPassage || currentSource.snippet}"
                    </p>
                  </div>
                </div>

                {/* Reason Explanation */}
                {verification.confidenceReason && (
                  <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-500/20 text-xs text-indigo-300 leading-relaxed">
                    <span className="font-semibold text-indigo-200">Verification Logic: </span>
                    {verification.confidenceReason}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-10 text-slate-500 text-xs">
                No passage details available.
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className={`w-2 h-2 rounded-full ${isContextMode ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {isContextMode ? 'Retrieved via Keyword Proximity (Non-Proof)' : 'Indexed via Vector Similarity & Access Filter'}
            </span>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors text-xs"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
