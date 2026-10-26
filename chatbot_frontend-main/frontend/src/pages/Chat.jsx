import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api, { ensureGuestSession } from "../utils/api";
import MarkdownRenderer from "../components/MarkdownRenderer";
import VerificationPanel from "../components/VerificationPanel";
import EvidenceDrawer from "../components/EvidenceDrawer";

const DEMO_PROMPTS = [
  {
    category: "Direct Grounding",
    tagColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon: "📄",
    title: "Maternity Leave Entitlement",
    query: "What is the maternity leave entitlement for female employees?",
    desc: "Demonstrates direct evidence extraction with exact page citation.",
  },
  {
    category: "Multi-Source Synthesis",
    tagColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    icon: "🔄",
    title: "Hours & Remote Stipend",
    query: "What are the core operating office hours and the monthly remote work connectivity stipend?",
    desc: "Synthesizes facts across multiple independent policy documents.",
  },
  {
    category: "Conflict Detection",
    tagColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: "⚠️",
    title: "Annual Leave Contradiction",
    query: "How many days of paid annual leave are full-time employees entitled to per year?",
    desc: "Detects contradictory terms between 2022 and 2024 revisions without guessing.",
  },
  {
    category: "Honest Boundary",
    tagColor: "bg-slate-700/50 text-slate-300 border-slate-600/30",
    icon: "❓",
    title: "Missing Policy Detection",
    query: "What is the company policy on pet relocation assistance for international office transfers?",
    desc: "Refuses to hallucinate and suggests relevant available topics.",
  },
];

const Chat = ({ user, onLogout }) => {
  /* ----------------------------------
     STATE
  ---------------------------------- */
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Evidence Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeVerification, setActiveVerification] = useState(null);
  const [activeSourceIdx, setActiveSourceIdx] = useState(0);
  const [drawerMode, setDrawerMode] = useState("supporting");

  const navigate = useNavigate();

  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem("currentSessionId") || `session-${Date.now()}`;
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  /* ----------------------------------
     EFFECTS
  ---------------------------------- */
  useEffect(() => {
    localStorage.setItem("currentSessionId", sessionId);
  }, [sessionId]);

  useEffect(() => {
    startNewChat();
    if (!user) {
      ensureGuestSession().then(() => fetchChatHistory());
    } else {
      fetchChatHistory();
    }

    if (window.innerWidth < 1024) setSidebarOpen(false);

    // Enforce dark theme
    document.documentElement.classList.add("dark");
  }, [user]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  /* ----------------------------------
     HELPERS & API
  ---------------------------------- */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleAuthError = (err) => {
    if (err.response?.status === 401) {
      if (user) {
        onLogout();
        navigate("/login");
      }
    }
  };

  const fetchChatHistory = async () => {
    try {
      const response = await api.get("/chat/history");
      setHistory(response.data || []);
    } catch (err) {
      console.error("Failed to load history:", err);
      handleAuthError(err);
    }
  };

  const loadSession = (session) => {
    setSessionId(session.sessionId);
    setMessages(session.messages || []);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const startNewChat = () => {
    const newId = `session-${Date.now()}`;
    setSessionId(newId);
    setMessages([]);
    setInput("");
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const openEvidence = (verification, sourceIdx = 0, mode = "supporting") => {
    if (!verification) return;
    setActiveVerification(verification);
    setActiveSourceIdx(sourceIdx);
    setDrawerMode(mode);
    setDrawerOpen(true);
  };

  /* ----------------------------------
     SEND MESSAGE
  ---------------------------------- */
  const handleSendMessage = async (textToSend) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || loading) return;

    setInput("");
    setLoading(true);

    const userMessage = { role: "user", content: messageContent };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    try {
      const response = await api.post("/chat/message", {
        message: messageContent,
        sessionId: sessionId,
      });

      const assistantText = response.data.message || response.data.text || "No response received.";
      const verificationData = response.data.verification || null;

      const assistantMessage = {
        role: "assistant",
        content: assistantText,
        verification: verificationData,
      };

      setMessages([...newMessages, assistantMessage]);
      fetchChatHistory();
    } catch (err) {
      console.error("Send error:", err);
      handleAuthError(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Error processing request: " + (err.response?.data?.error || err.message),
          verification: {
            state: "insufficient",
            statusLabel: "Request Error",
            confidenceReason: "Internal server or network error encountered.",
            sources: [],
          },
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const onSubmitForm = (e) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  /* ----------------------------------
     SIDEBAR ACTIONS
  ---------------------------------- */
  const handlePin = async (e, session) => {
    e.stopPropagation();
    setActiveMenuId(null);
    try {
      await api.patch(`/chat/${session.sessionId}`, { isPinned: !session.isPinned });
      fetchChatHistory();
    } catch (err) {
      handleAuthError(err);
    }
  };

  const handleArchive = async (e, session) => {
    e.stopPropagation();
    setActiveMenuId(null);
    try {
      await api.patch(`/chat/${session.sessionId}`, { isArchived: true });
      fetchChatHistory();
      if (sessionId === session.sessionId) startNewChat();
    } catch (err) {
      handleAuthError(err);
    }
  };

  const handleDelete = async (e, session) => {
    e.stopPropagation();
    setActiveMenuId(null);
    if (!window.confirm("Permanently delete this conversation?")) return;
    try {
      await api.delete(`/chat/${session.sessionId}`);
      fetchChatHistory();
      if (sessionId === session.sessionId) startNewChat();
    } catch (err) {
      handleAuthError(err);
    }
  };

  const RoleBadge = ({ role }) => {
    const styles = {
      admin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      manager: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      employee: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      public: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      guest: "bg-slate-700/40 text-slate-400 border-slate-700/60",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[role] || styles.guest}`}>
        {role || "guest"}
      </span>
    );
  };

  /* ----------------------------------
     RENDER
  ---------------------------------- */
  return (
    <div
      className="flex h-screen bg-[#0B0F17] text-slate-100 font-sans overflow-hidden antialiased select-none md:select-auto"
      onClick={() => setActiveMenuId(null)}
    >
      {/* ─────────────────────────────────────────────────────────────
          SIDEBAR
      ───────────────────────────────────────────────────────────── */}
      <aside
        className={`
          flex-shrink-0 bg-[#0F172A] flex flex-col border-r border-slate-800/80 transition-all duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0 w-[270px]" : "-translate-x-full w-0"}
          fixed lg:relative z-30 h-full shadow-2xl lg:shadow-none
        `}
      >
        <div className="flex-1 flex flex-col overflow-hidden w-full">
          {/* Brand & New Chat */}
          <div className="p-4 border-b border-slate-800/60">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-500/20">
                ⚡
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                  Flux AI
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Verify
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Enterprise Intelligence</span>
              </div>
            </div>

            <button
              onClick={startNewChat}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Conversation</span>
            </button>
          </div>

          {/* Conversation History List */}
          <div className="flex-1 overflow-y-auto px-2 py-3 custom-scrollbar">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                History
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {history.filter((h) => !h.isArchived).length}
              </span>
            </div>

            <div className="space-y-1">
              {history.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-slate-500 italic">
                  No previous sessions.
                </div>
              ) : (
                history
                  .filter((h) => !h.isArchived)
                  .sort((a, b) => b.isPinned - a.isPinned)
                  .map((sess) => (
                    <div key={sess._id} className="relative group">
                      <button
                        onClick={() => loadSession(sess)}
                        className={`
                          w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all flex items-center gap-2 pr-7
                          ${
                            sessionId === sess.sessionId
                              ? "bg-slate-800 text-white font-semibold border border-slate-700/60 shadow-sm"
                              : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
                          }
                        `}
                      >
                        <span className="text-sm opacity-75">{sess.isPinned ? "📌" : "💬"}</span>
                        <span className="truncate flex-1">
                          {sess.title || sess.messages[0]?.content || "New Session"}
                        </span>
                      </button>

                      {/* Dropdown Menu Trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === sess.sessionId ? null : sess.sessionId);
                        }}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 ${
                          activeMenuId === sess.sessionId ? "block" : "hidden group-hover:block"
                        }`}
                      >
                        •••
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuId === sess.sessionId && (
                        <div className="absolute top-9 right-1 w-36 bg-[#162032] border border-slate-700 rounded-xl shadow-2xl z-50 py-1 text-xs">
                          <button
                            onClick={(e) => handlePin(e, sess)}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-slate-200 transition-colors"
                          >
                            {sess.isPinned ? "Unpin Chat" : "Pin Chat"}
                          </button>
                          <button
                            onClick={(e) => handleArchive(e, sess)}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-slate-200 transition-colors"
                          >
                            Archive
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, sess)}
                            className="w-full text-left px-3 py-1.5 hover:bg-rose-950/40 text-rose-400 font-medium transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 space-y-2">
            {user ? (
              <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs uppercase">
                    {user.name?.charAt(0) || user.username?.charAt(0) || "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{user.name || user.username}</p>
                    <RoleBadge role={user.role} />
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  title="Logout"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="p-2 space-y-1.5">
                <Link
                  to="/login"
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors"
                >
                  Sign In for Full Access
                </Link>
                <p className="text-[10px] text-slate-500 text-center">
                  Signed in as guest with public policy access.
                </p>
              </div>
            )}

            {user?.role === "admin" && (
              <Link
                to="/admin/dashboard"
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-300 font-semibold text-xs border border-indigo-500/30 transition-colors"
              >
                ⚙️ Admin Dashboard
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          MAIN CHAT AREA
      ───────────────────────────────────────────────────────────── */}
      <main
        className="flex-1 flex flex-col h-full relative bg-[#0B0F17]"
        onClick={() => setActiveMenuId(null)}
      >
        {/* Top Navbar */}
        <header className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between border-b border-slate-800/80 bg-[#0B0F17]/85 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Toggle Sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-white tracking-tight flex items-center gap-1.5">
                Flux AI
              </span>
              <span className="hidden sm:inline-block text-slate-600">•</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Flux Verify Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <RoleBadge role={user?.role || "guest"} />
          </div>
        </header>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 pb-40 custom-scrollbar">
          {messages.length === 0 ? (
            /* ── First Impression / Empty State ── */
            <div className="max-w-4xl mx-auto py-8 md:py-12 px-2">
              {/* Hero Banner */}
              <div className="text-center space-y-4 mb-10">
                <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-indigo-500/20 via-emerald-500/10 to-indigo-500/20 border border-indigo-500/30 shadow-2xl shadow-indigo-500/10">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white text-2xl shadow-lg">
                    ⚡
                  </div>
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                    Organizational Intelligence You Can Verify.
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
                    Ask questions grounded in enterprise policies and indexed documents. Flux Verify validates answers with evidence citations, detects contradictory policy revisions, and prevents hallucinated information.
                  </p>
                </div>
              </div>

              {/* 4 Interactive Demonstration Prompt Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Demonstration Scenarios
                  </span>
                  <span className="text-[11px] text-indigo-400">Click any card to run live</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {DEMO_PROMPTS.map((card, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(card.query)}
                      className="p-4 rounded-2xl bg-[#131B2E] hover:bg-[#18233C] border border-slate-800 hover:border-indigo-500/40 text-left transition-all duration-200 group active:scale-[0.99] flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-lg">{card.icon}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${card.tagColor}`}>
                            {card.category}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors mb-1">
                          {card.title}
                        </h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {card.desc}
                        </p>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-indigo-400 group-hover:text-indigo-300 font-medium">
                        <span className="truncate pr-2">"{card.query}"</span>
                        <span className="text-slate-500 group-hover:translate-x-0.5 transition-transform">→</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ── Conversation Thread ── */
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, idx) => (
                <div key={idx} className="w-full animate-in fade-in duration-300">
                  {msg.role === "user" ? (
                    /* User Message */
                    <div className="flex justify-end">
                      <div className="max-w-[85%] sm:max-w-[75%] px-5 py-3.5 rounded-2xl rounded-tr-none bg-indigo-600 text-white text-sm leading-relaxed shadow-lg shadow-indigo-600/10">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    /* Assistant Message with Flux Verify Panel */
                    <div className="flex gap-3.5 items-start">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-md mt-1">
                        ⚡
                      </div>

                      <div className="flex-1 min-w-0 p-5 rounded-2xl rounded-tl-none bg-[#131B2E] border border-slate-800/90 text-sm shadow-xl">
                        {/* Markdown Content */}
                        <MarkdownRenderer content={msg.content} />

                        {/* Evidence-Aware Verification Panel */}
                        <VerificationPanel
                          verification={msg.verification}
                          onOpenEvidence={(srcIdx, mode) => openEvidence(msg.verification, srcIdx, mode)}
                          onSelectFollowUp={(q) => handleSendMessage(q)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex gap-3.5 items-start animate-pulse">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-md mt-1">
                    ⚡
                  </div>
                  <div className="p-4 rounded-2xl rounded-tl-none bg-[#131B2E] border border-slate-800 flex items-center gap-2 text-xs text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
                    <span className="ml-2 font-medium">Retrieving verified evidence & synthesizing answer...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-6" />
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            FIXED CHAT COMPOSER DOCK (No Overlap)
        ───────────────────────────────────────────────────────────── */}
        <div className="absolute bottom-0 left-0 w-full p-4 sm:p-6 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/95 to-transparent pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto">
            <form
              onSubmit={onSubmitForm}
              className="relative flex items-center bg-[#131B2E] rounded-2xl shadow-2xl border border-slate-800 focus-within:border-indigo-500/70 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all p-1.5"
            >
              <input
                ref={inputRef}
                className="flex-1 bg-transparent text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none px-4 py-3"
                placeholder="Ask about organizational policies, leave, or company guidelines..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
              />

              <button
                type="submit"
                disabled={!input.trim() || loading}
                className={`p-3 rounded-xl transition-all ${
                  input.trim() && !loading
                    ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 active:scale-95"
                    : "text-slate-600 cursor-not-allowed"
                }`}
                title="Send query"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </form>

            <div className="flex items-center justify-between px-2 mt-2 text-[10px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Evidence-Aware Verification Active
              </span>
              <span>Flux AI Core • Role-Based Access Control</span>
            </div>
          </div>
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          EVIDENCE DRAWER SLIDE-OVER
      ───────────────────────────────────────────────────────────── */}
      <EvidenceDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        verification={activeVerification}
        activeSourceIndex={activeSourceIdx}
        mode={drawerMode}
      />
    </div>
  );
};

export default Chat;
