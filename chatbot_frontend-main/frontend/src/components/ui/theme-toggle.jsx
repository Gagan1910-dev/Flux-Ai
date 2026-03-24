import React, { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * ThemeToggle Component
 * Replaces the old button with a modern, animated toggle.
 * Integrates with the existing manual DOM-based theme switching logic.
 */
const ThemeToggle = ({ onToggle }) => {
    // Use local state to handle the UI re-render when theme changes
    const [isDark, setIsDark] = useState(
        document.documentElement.classList.contains("dark")
    );

    // Sync state if theme changes elsewhere (e.g., initial load in App.jsx)
    useEffect(() => {
        // Initial check
        setIsDark(document.documentElement.classList.contains("dark"));

        // Watch for class changes on html element to keep UI in sync
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains("dark"));
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"]
        });

        return () => observer.disconnect();
    }, []);

    const handleToggle = () => {
        if (onToggle) {
            onToggle();
        } else {
            // Fallback: ──────── EXISTING THEME SWITCHING LOGIC (DOM based) ────────
            const html = document.documentElement;
            html.classList.toggle("dark");
            const newTheme = html.classList.contains("dark") ? "dark" : "light";
            localStorage.setItem("theme", newTheme);
        }
    };

    return (
        <button
            onClick={handleToggle}
            className={`
        relative inline-flex h-9 w-16 items-center rounded-full 
        transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900
        ${isDark ? "bg-slate-700 hover:bg-slate-600" : "bg-blue-200 hover:bg-blue-300"}
      `}
            aria-label="Toggle theme"
        >
            <div
                className={`
          relative z-10 flex h-7 w-7 items-center justify-center rounded-full 
          shadow-lg transition-all duration-500 ease-in-out
          ${isDark ? "translate-x-8 rotate-[360deg] bg-slate-900" : "translate-x-1 rotate-0 bg-white"}
        `}
            >
                {isDark ? (
                    <Moon className="h-4 w-4 text-blue-400" />
                ) : (
                    <Sun className="h-4 w-4 text-yellow-500" />
                )}
            </div>

            {/* Background Decorative Icons */}
            <Sun className={`absolute left-2 h-3.5 w-3.5 text-blue-400 transition-opacity duration-300 ${isDark ? 'opacity-100' : 'opacity-0'}`} />
            <Moon className={`absolute right-2 h-3.5 w-3.5 text-yellow-200 transition-opacity duration-300 ${isDark ? 'opacity-0' : 'opacity-100'}`} />
        </button>
    );
};

export default ThemeToggle;
