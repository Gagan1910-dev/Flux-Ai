import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { useState, useEffect } from "react";

import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import api from "./utils/api";
import { getUserToken, removeAuthToken } from "./utils/auth";

import ThemeToggle from "./components/ui/theme-toggle";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /* -------------------------------
     THEME SWITCHING LOGIC
  ------------------------------- */
  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  };

  /* -----------------------------------------
     LOAD SAVED THEME FROM LOCAL STORAGE
  ----------------------------------------- */
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (!savedTheme || savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      if (!savedTheme) localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  /* -------------------------------
     CHECK & VALIDATE AUTH TOKEN ON START
  ------------------------------- */
  useEffect(() => {
    const token = getUserToken();
    if (token) {
      // Validate token with backend /api/auth/me instead of blindly trusting localStorage
      api.get("/auth/me")
        .then((response) => {
          if (response.data?.user) {
            setUser(response.data.user);
            setIsAuthenticated(true);
            localStorage.setItem("user", JSON.stringify(response.data.user));
          } else {
            handleLogout();
          }
        })
        .catch(() => {
          handleLogout();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  /* -------------------------------
     LOGIN / LOGOUT HANDLERS
  ------------------------------- */
  const handleLogin = (userData, token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    removeAuthToken();
    localStorage.removeItem("user");
    setUser(null);
    setIsAuthenticated(false);
  };

  /* -------------------------------
     LOADING SCREEN
  ------------------------------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="text-xl text-gray-800 dark:text-gray-200">
          Loading Flux AI...
        </div>
      </div>
    );
  }

  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle onToggle={toggleTheme} />
      </div>

      <Routes>
        {/* PUBLIC CHAT */}
        <Route path="/" element={<Chat user={user} onLogout={handleLogout} />} />

        {/* AUTH ROUTES */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" /> : <Login onLogin={handleLogin} />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/" /> : <Register onLogin={handleLogin} />}
        />

        {/* ADMIN ROUTES (Protected by backend and validated role) */}
        <Route
          path="/admin/login"
          element={
            isAuthenticated && user?.role === "admin" ? (
              <Navigate to="/admin/dashboard" />
            ) : (
              <AdminLogin onLogin={handleLogin} />
            )
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            isAuthenticated && user?.role === "admin" ? (
              <AdminDashboard user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/admin/login" />
            )
          }
        />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
