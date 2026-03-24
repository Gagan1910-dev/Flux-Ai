import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import api, { getGuestId } from "../utils/api";

const Chat = ({ user, onLogout }) => {
  /* ----------------------------------
     STATE
  ---------------------------------- */
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isWideMode, setIsWideMode] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [activeMenuId, setActiveMenuId] = useState(null); // For sidebar dropdown
  const navigate = useNavigate();

  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem("currentSessionId") || `session-${Date.now()}`;
  });

  const messagesEndRef = useRef(null);
  const guestId = getGuestId(); // Get persistent Guest ID

  /* ----------------------------------
     EFFECTS
  ---------------------------------- */
  useEffect(() => {
    localStorage.setItem("currentSessionId", sessionId);
  }, [sessionId]);

  useEffect(() => {
    fetchChatHistory();
    loadSessionMessages(sessionId);

    if (window.innerWidth < 768) setSidebarOpen(false);

    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [theme]);

  // Auto-scroll
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  /* ----------------------------------
     LOGIC
  ---------------------------------- */
  const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

  const handleAuthError = (err) => {
    if (err.response?.status === 401) {
      if (user) {
        onLogout();
        navigate("/login");
      }
    }
  };

  // Load specific session messages
  const loadSessionMessages = async (sid) => {
    try {
      const response = await api.get("/chat/history", { params: { sessionId: sid, guestId } });
      const sessionData = response.data.find(s => s.sessionId === sid);
      if (sessionData) {
        setMessages(sessionData.messages);
        return;
      }
    } catch (err) {
      console.warn("API load failed", err);
      handleAuthError(err);
    }
  };

  const fetchChatHistory = async () => {
    try {
      const response = await api.get("/chat/history", { params: { guestId } });
      setHistory(response.data);
    } catch (err) {
      console.error("Failed to load history:", err);
      handleAuthError(err);
    }
  };

  const loadSession = (session) => {
    setSessionId(session.sessionId);
    setMessages(session.messages || []);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const startNewChat = () => {
    const newId = `session-${Date.now()}`;
    setSessionId(newId);
    setMessages([]);
    setInput("");
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    const newMessages = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);

    try {
      const response = await api.post("/chat/message", {
        message: userMessage,
        sessionId: sessionId,
        guestId
      });

      const assistantText = response.data.message || response.data.text || "No response";
      const finalMessages = [...newMessages, { role: "assistant", content: assistantText }];

      setMessages(finalMessages);
      fetchChatHistory();
    } catch (err) {
      console.error("Send error:", err);
      handleAuthError(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: " + (err.response?.data?.error || err.message) },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /* ----------------------------------
     SIDEBAR ACTIONS HANDLERS
  ---------------------------------- */
  const handlePin = async (e, session) => {
    e.stopPropagation();
    setActiveMenuId(null);
    try {
      const newStatus = !session.isPinned;
      await api.patch(`/chat/${session.sessionId}`, { isPinned: newStatus, guestId });
      fetchChatHistory();
    } catch (err) {
      handleAuthError(err);
    }
  };

  const handleArchive = async (e, session) => {
    e.stopPropagation();
    setActiveMenuId(null);
    try {
      await api.patch(`/chat/${session.sessionId}`, { isArchived: true, guestId });
      fetchChatHistory();
      if (sessionId === session.sessionId) startNewChat();
    } catch (err) {
      handleAuthError(err);
    }
  };

  const handleDelete = async (e, session) => {
    e.stopPropagation();
    setActiveMenuId(null);
    if (!window.confirm("Delete this chat permanently?")) return;
    try {
      await api.delete(`/chat/${session.sessionId}`, { data: { guestId } });
      fetchChatHistory();
      if (sessionId === session.sessionId) startNewChat();
    } catch (err) {
      handleAuthError(err);
    }
  };

  const RoleBadge = ({ role }) => {
    const colors = {
      admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      manager: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
      employee: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      public: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      guest: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colors[role] || colors.guest}`}>
        {role}
      </span>
    );
  };

  /* ----------------------------------
     RENDER
  ---------------------------------- */
  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans overflow-hidden transition-colors duration-200" onClick={() => setActiveMenuId(null)}>

      {/* -------------------------------
          SIDEBAR
      -------------------------------- */}
      <aside
        className={`
          flex-shrink-0 bg-gray-50 dark:bg-black flex flex-col border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0 w-[260px]" : "-translate-x-full w-0"}
          fixed md:relative z-30 h-full
        `}
      >
        <div className="flex-1 flex flex-col overflow-hidden w-full">
          {/* New Chat */}
          <div className="p-3">
            <button
              onClick={startNewChat}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-md bg-white dark:bg-transparent hover:bg-gray-200 dark:hover:bg-gray-900 border border-gray-300 dark:border-gray-700 transition-all text-sm text-gray-800 dark:text-white mb-2 shadow-sm dark:shadow-none"
            >
              <span className="text-xl">+</span>
              <span className="font-medium">New chat</span>
            </button>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto px-2 custom-scrollbar">
            <div className="text-xs font-semibold text-gray-500 mb-2 px-2 mt-4 uppercase tracking-widest">History</div>
            <div className="space-y-1 pb-4">
              {history.length === 0 ? (
                <div className="px-2 text-xs text-gray-400 italic">No previous chats.</div>
              ) : (
                history
                  .filter(h => !h.isArchived)
                  .sort((a, b) => (b.isPinned - a.isPinned))
                  .map((sess) => (
                    <div key={sess._id} className="relative group">
                      <button
                        onClick={() => loadSession(sess)}
                        className={`
                          w-full text-left px-3 py-3 rounded-md text-sm truncate transition-colors flex items-center gap-2 pr-8
                          ${sessionId === sess.sessionId
                            ? "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white font-medium"
                            : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-900"
                          }
                        `}
                      >
                        {sess.isPinned ? "📌" : "💬"}
                        <span className="truncate flex-1">
                          {sess.title || sess.messages[0]?.content || "New Conversation"}
                        </span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === sess.sessionId ? null : sess.sessionId);
                        }}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 ${activeMenuId === sess.sessionId ? 'block' : 'hidden group-hover:block'}`}
                      >
                        •••
                      </button>

                      {activeMenuId === sess.sessionId && (
                        <div className="absolute top-10 right-0 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 text-xs">
                          <button onClick={(e) => handlePin(e, sess)} className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">{sess.isPinned ? "Unpin" : "Pin"}</button>
                          <button onClick={(e) => handleArchive(e, sess)} className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">Archive</button>
                          <button onClick={(e) => handleDelete(e, sess)} className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 font-medium whitespace-nowrap">Delete permanently</button>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
            {user ? (
              <div className="px-3 py-4 bg-gray-100 dark:bg-gray-900/50 rounded-xl mb-2">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                    {user.name?.charAt(0) || user.username?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate text-gray-900 dark:text-white">{user.name || user.username}</p>
                    <RoleBadge role={user.role} />
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="w-full py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20 transition-colors font-medium"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                <Link
                  to="/login"
                  className="flex items-center gap-3 px-3 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-bold justify-center shadow-lg shadow-blue-500/20"
                >
                  Sign in to your account
                </Link>
                <p className="text-[10px] text-gray-400 text-center px-2 italic">Register for advanced access to company documents.</p>
              </div>
            )}

            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-gray-200 dark:hover:bg-gray-900 transition-colors text-sm text-gray-700 dark:text-gray-300"
            >
              {theme === 'dark' ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>

            {user?.role === 'admin' && (
              <Link
                to="/admin/dashboard"
                className="flex items-center gap-3 px-3 py-3 rounded-md hover:bg-gray-200 dark:hover:bg-gray-900 transition-colors text-sm text-blue-600 dark:text-blue-400 font-bold"
              >
                ⚙️ Admin Dashboard
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* -------------------------------
          MAIN CHAT AREA
      -------------------------------- */}
      <main className="flex-1 flex flex-col h-full relative bg-white dark:bg-gray-800/90" onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }}>

        {/* Top Navbar */}
        <div className="sticky top-0 z-10 p-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); setSidebarOpen(!sidebarOpen); }}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              ☰
            </button>
            <div className="flex flex-col">
              <span className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Flux AI
                {user ? <RoleBadge role={user.role} /> : <RoleBadge role="guest" />}
              </span>
              <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Intelligent Documents</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setIsWideMode(!isWideMode)} className="p-2 text-xs font-bold text-gray-400 hover:text-blue-500">
              {isWideMode ? "⇥ Narrow" : "⇤ Wide"}
            </button>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto px-4 pb-40 pt-10 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-blue-500/20 transform rotate-12">
                <span className="text-4xl">⚡</span>
              </div>
              <motion.h1
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 1 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.08, delayChildren: 0.2 }
                  }
                }}
                className="text-4xl font-black text-gray-900 dark:text-white mb-4 tracking-tight"
              >
                {"How can I help you?".split(" ").map((word, i) => (
                  <span key={i} className="inline-block overflow-hidden mr-[0.25em] pb-[0.1em]">
                    <motion.span
                      variants={{
                        hidden: { y: "110%" },
                        visible: {
                          y: 0,
                          transition: {
                            duration: 0.8,
                            ease: [0.22, 1, 0.36, 1], // Power4.out
                          }
                        }
                      }}
                      className="inline-block"
                    >
                      {word}
                    </motion.span>
                  </span>
                ))}
              </motion.h1>
              <p className="max-w-md text-gray-500 dark:text-gray-400 font-medium">Ask me anything about your documents or company policies. I have specialized access based on your role.</p>


            </div>
          ) : (
            <div className={`mx-auto transition-all duration-300 ${isWideMode ? 'max-w-6xl' : 'max-w-3xl'}`}>
              {messages.map((msg, idx) => (
                <div key={idx} className={`group w-full mb-8 animate-in slide-in-from-bottom-2 fade-in duration-300`}>
                  <div className={`flex gap-4 md:gap-6 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role !== 'user' && (
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs shadow-lg">⚡</div>
                    )}

                    <div className={`relative max-w-[85%] px-6 py-4 rounded-2xl shadow-sm text-sm leading-7 ${msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-200 dark:border-gray-800'
                      }`}>
                      <div className="prose dark:prose-invert max-w-none break-words">
                        {msg.content}
                      </div>
                    </div>

                    {msg.role === 'user' && (
                      <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shadow-lg">YOU</div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-4 mb-8">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs animate-pulse">⚡</div>
                  <div className="bg-gray-100 dark:bg-gray-900 px-6 py-4 rounded-2xl rounded-tl-none border border-gray-200 dark:border-gray-800 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-10" />
            </div>
          )}
        </div>

        {/* Input Dock */}
        <div className="absolute bottom-0 left-0 w-full p-4 md:p-8 bg-gradient-to-t from-white dark:from-gray-900 via-white/80 dark:via-gray-900/80 to-transparent">
          <div className={`mx-auto transition-all duration-300 ${isWideMode ? 'max-w-6xl' : 'max-w-3xl'}`}>
            <form onSubmit={sendMessage} className="relative flex items-center bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-2 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
              <input
                className="flex-1 bg-transparent text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none px-4 py-3"
                placeholder="Type your question here..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className={`p-3 rounded-xl transition-all ${input.trim() && !loading ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/30" : "text-gray-400 cursor-not-allowed"}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </form>
            <p className="text-[10px] text-gray-400 text-center mt-3 font-medium uppercase tracking-tighter">Flux AI Core Engine • Role-Aware RAG retrieval active</p>
          </div>
        </div>

      </main>
    </div>
  );
};

export default Chat;
