import { useState, useEffect } from "react";
import api from "../utils/api";

const AdminDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState("documents");
  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    accessLevel: "employee",
  });
  const [faqForm, setFaqForm] = useState({
    question: "",
    answer: "",
    category: "general",
  });
  const [editingFaq, setEditingFaq] = useState(null);
  const [auditPagination, setAuditPagination] = useState({ page: 1, pages: 1 });

  // Sync dark mode
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
  }, []);

  // Fetch documents
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get("/documents/list");
      setDocuments(response.data);
    } catch (error) {
      console.error("❌ Error fetching documents:", error);
      alert("Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  };

  // Fetch FAQs
  const fetchFAQs = async () => {
    try {
      const response = await api.get("/faq");
      setFaqs(response.data);
    } catch (error) {
      console.error("❌ Error fetching FAQs:", error);
    }
  };

  // Fetch Users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get("/auth/users");
      setUsers(response.data.users);
    } catch (error) {
      console.error("❌ Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Audit Logs
  const fetchAuditLogs = async (page = 1) => {
    try {
      setLoading(true);
      const response = await api.get(`/audit?page=${page}`);
      setAuditLogs(response.data.logs);
      setAuditPagination(response.data.pagination);
    } catch (error) {
      console.error("❌ Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "documents") fetchDocuments();
    if (activeTab === "faqs") fetchFAQs();
    if (activeTab === "users") fetchUsers();
    if (activeTab === "audit") fetchAuditLogs();
  }, [activeTab]);

  // Upload document
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", uploadForm.title);
    formData.append("accessLevel", uploadForm.accessLevel);

    try {
      setUploading(true);
      await api.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Document uploaded!");
      setFile(null);
      setUploadForm({ title: "", accessLevel: "employee" });
      fetchDocuments();
    } catch (e) {
      console.error("❌ Upload error:", e.response?.data || e);
      alert(e.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Delete document
  const handleDeleteDocument = async (id) => {
    if (!confirm("Delete this document?")) return;

    try {
      await api.delete(`/documents/${id}`);
      alert("Document deleted successfully!");
      fetchDocuments();
    } catch (e) {
      console.error("❌ Delete error:", e.response?.data || e);
      alert(e.response?.data?.error || "Delete failed");
    }
  };

  // Trigger ingestion
  const handleTriggerIngestion = async (id) => {
    try {
      await api.post(`/documents/${id}/ingest`);
      alert("Processing started!");
      setTimeout(() => fetchDocuments(), 1000);
    } catch (e) {
      console.error("❌ Ingestion error:", e.response?.data || e);
      alert("Ingestion failed");
    }
  };

  // Update user role
  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      await api.patch(`/auth/users/${userId}/role`, { role: newRole });
      alert(`User role updated to ${newRole}`);
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to update role");
    }
  };

  // Update document access
  const handleUpdateDocAccess = async (docId, newLevel) => {
    try {
      await api.patch(`/documents/${docId}/access`, { accessLevel: newLevel });
      fetchDocuments();
    } catch (error) {
      alert("Failed to update access level");
    }
  };

  // Create or update FAQ
  const handleCreateFAQ = async (e) => {
    e.preventDefault();
    try {
      if (editingFaq) {
        await api.put(`/faq/${editingFaq._id}`, faqForm);
        alert("FAQ updated!");
        setEditingFaq(null);
      } else {
        await api.post("/faq", faqForm);
        alert("FAQ created!");
      }
      setFaqForm({ question: "", answer: "", category: "general" });
      fetchFAQs();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save FAQ");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* HEADER */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">A</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Central</h1>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name || user?.username}</p>
              <p className="text-xs text-gray-500">System Administrator</p>
            </div>
            <button onClick={onLogout} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">Logout</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* TABS NAVIGATION */}
        <div className="flex flex-wrap gap-2 mb-8 bg-gray-200/50 dark:bg-gray-800/50 p-1.5 rounded-2xl w-fit">
          {[
            { id: "documents", label: "Documents", icon: "📄" },
            { id: "users", label: "Users", icon: "👥" },
            { id: "audit", label: "Audit Logs", icon: "📋" },
            { id: "faqs", label: "FAQs", icon: "❓" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${activeTab === tab.id
                  ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-md"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT AREA */}
        <div className="space-y-8 animate-in fade-in duration-500">

          {/* DOCUMENTS TAB */}
          {activeTab === "documents" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="text-blue-500">↑</span> Upload Document
                  </h2>
                  <form onSubmit={handleFileUpload} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Display Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Employee Handbook 2024"
                        value={uploadForm.title}
                        onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Access Level</label>
                      <select
                        value={uploadForm.accessLevel}
                        onChange={e => setUploadForm({ ...uploadForm, accessLevel: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm"
                      >
                        <option value="public">Public (Everyone)</option>
                        <option value="employee">Employee (Company only)</option>
                        <option value="manager">Manager (Elevated only)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">File (PDF/DOCX)</label>
                      <input type="file" accept=".pdf,.docx" onChange={e => setFile(e.target.files[0])} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    </div>
                    <button type="submit" disabled={!file || uploading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all disabled:opacity-50">
                      {uploading ? "Processing..." : "Start Upload"}
                    </button>
                  </form>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold">Knowledge Base</h2>
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-medium">{documents.length} Files</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-400 font-bold">
                        <tr>
                          <th className="px-6 py-4">Document</th>
                          <th className="px-6 py-4">Visibility</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {documents.map(doc => (
                          <tr key={doc._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-semibold text-sm text-gray-900 dark:text-white">{doc.title || doc.originalName}</p>
                              <p className="text-xs text-gray-400">{doc.fileType.toUpperCase()} • {(doc.fileSize / 1024).toFixed(1)} KB</p>
                            </td>
                            <td className="px-6 py-4">
                              <select
                                value={doc.accessLevel}
                                onChange={(e) => handleUpdateDocAccess(doc._id, e.target.value)}
                                className="bg-transparent text-xs font-bold border-none focus:ring-0 cursor-pointer text-blue-500"
                              >
                                <option value="public">PUBLIC</option>
                                <option value="employee">EMPLOYEE</option>
                                <option value="manager">MANAGER</option>
                              </select>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${doc.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                }`}>{doc.status}</span>
                            </td>
                            <td className="px-6 py-4 text-right space-x-2">
                              {doc.status !== 'completed' && (
                                <button onClick={() => handleTriggerIngestion(doc._id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Ingest">⚡</button>
                              )}
                              <button onClick={() => handleDeleteDocument(doc._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === "users" && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-bold">User Management</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-400 font-bold">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Assigned Role</th>
                      <th className="px-6 py-4">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {users.map(u => (
                      <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-sm">{u.name}</p>
                          <p className="text-xs text-gray-400">@{u.username}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                        <td className="px-6 py-4">
                          <select
                            value={u.role}
                            disabled={u.role === 'admin'}
                            onChange={(e) => handleUpdateUserRole(u._id, e.target.value)}
                            className={`text-xs font-bold rounded-lg border-gray-200 dark:bg-gray-900 ${u.role === 'admin' ? 'text-purple-600' : 'text-blue-600'
                              }`}
                          >
                            <option value="public">PUBLIC</option>
                            <option value="employee">EMPLOYEE</option>
                            <option value="manager">MANAGER</option>
                            {u.role === 'admin' && <option value="admin">ADMIN</option>}
                          </select>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AUDIT LOGS TAB */}
          {activeTab === "audit" && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-lg font-bold">Security Audit Logs</h2>
                <div className="flex gap-2">
                  <button
                    disabled={auditPagination.page <= 1}
                    onClick={() => fetchAuditLogs(auditPagination.page - 1)}
                    className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-30"
                  >←</button>
                  <span className="px-4 py-2 text-sm font-bold bg-gray-100 dark:bg-gray-700 rounded-lg">
                    {auditPagination.page} / {auditPagination.pages}
                  </span>
                  <button
                    disabled={auditPagination.page >= auditPagination.pages}
                    onClick={() => fetchAuditLogs(auditPagination.page + 1)}
                    className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-30"
                  >→</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-400 font-bold">
                    <tr>
                      <th className="px-6 py-4">Timestamp</th>
                      <th className="px-6 py-4">User / Role</th>
                      <th className="px-6 py-4">Query</th>
                      <th className="px-6 py-4">Docs Used</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {auditLogs.map(log => (
                      <tr key={log._id} className="text-sm border-b dark:border-gray-700">
                        <td className="px-6 py-4 text-xs text-gray-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold">{log.userId?.name || 'Guest'}</p>
                          <span className="text-[10px] font-bold uppercase text-blue-500">{log.userRole}</span>
                        </td>
                        <td className="px-6 py-4 italic text-gray-600 dark:text-gray-300">"{log.query}"</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {log.documentIdsUsed?.length > 0 ? (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold">
                                {log.documentIdsUsed.length} DOCS
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* FAQ TAB */}
          {activeTab === "faqs" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-bold mb-4">{editingFaq ? "Edit FAQ" : "Add New FAQ"}</h2>
                  <form onSubmit={handleCreateFAQ} className="space-y-4">
                    <input type="text" placeholder="Question" value={faqForm.question} onChange={e => setFaqForm({ ...faqForm, question: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm" />
                    <textarea rows="4" placeholder="Detailed Answer" value={faqForm.answer} onChange={e => setFaqForm({ ...faqForm, answer: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm" />
                    <input type="text" placeholder="Category" value={faqForm.category} onChange={e => setFaqForm({ ...faqForm, category: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm" />
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all">
                        {editingFaq ? "Save Changes" : "Publish FAQ"}
                      </button>
                      {editingFaq && (
                        <button type="button" onClick={() => { setEditingFaq(null); setFaqForm({ question: '', answer: '', category: 'general' }) }} className="px-4 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200">✕</button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-bold">Published FAQs</h2>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {faqs.map(faq => (
                      <div key={faq._id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase mb-2 inline-block">{faq.category}</span>
                            <h3 className="font-bold text-gray-900 dark:text-white mb-2">{faq.question}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{faq.answer}</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleEditFAQ(faq)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg text-lg">✏️</button>
                            <button onClick={() => handleDeleteFAQ(faq._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg text-lg">🗑️</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;


