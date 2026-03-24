import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';

const Login = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await api.post('/auth/login', { email, password });
            const { token, user } = response.data;

            onLogin(user, token);

            // Redirect based on role
            if (user.role === 'admin') {
                navigate('/admin/dashboard');
            } else {
                navigate('/');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    // Role badge helper
    const RoleBadge = ({ role, label, color }) => (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-opacity-10 border ${color}`}>
            <span className="text-xs font-medium">{label}</span>
        </div>
    );

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 px-4">

            {/* Background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600 opacity-10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-indigo-500 opacity-10 rounded-full blur-3xl" />
            </div>

            <div className="relative max-w-md w-full">
                {/* Logo / Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white">Welcome back</h1>
                    <p className="text-gray-400 mt-1 text-sm">Sign in to access your personalized workspace</p>
                </div>

                {/* Card */}
                <div className="bg-gray-800 bg-opacity-80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700 p-8">

                    {error && (
                        <div className="mb-5 p-3 bg-red-900 bg-opacity-40 border border-red-700 text-red-300 rounded-lg text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="login-email" className="block text-sm font-medium text-gray-300 mb-1.5">
                                Email address
                            </label>
                            <input
                                id="login-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="you@example.com"
                                className="w-full px-4 py-3 bg-gray-900 border border-gray-600 text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 transition-all"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label htmlFor="login-password" className="block text-sm font-medium text-gray-300">
                                    Password
                                </label>
                            </div>
                            <input
                                id="login-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="Enter your password"
                                className="w-full px-4 py-3 bg-gray-900 border border-gray-600 text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mt-2"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Signing in...
                                </span>
                            ) : 'Sign in'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-gray-400">
                        Don&apos;t have an account?{' '}
                        <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                            Create one
                        </Link>
                    </p>
                </div>

                {/* Access level info */}
                <div className="mt-6 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-gray-800 bg-opacity-60 rounded-lg p-2.5 text-center border border-gray-700">
                        <div className="w-2 h-2 rounded-full bg-green-400 mx-auto mb-1" />
                        <p className="text-gray-400">Public</p>
                        <p className="text-gray-500 text-xs">General info</p>
                    </div>
                    <div className="bg-gray-800 bg-opacity-60 rounded-lg p-2.5 text-center border border-gray-700">
                        <div className="w-2 h-2 rounded-full bg-blue-400 mx-auto mb-1" />
                        <p className="text-gray-400">Employee</p>
                        <p className="text-gray-500 text-xs">Internal docs</p>
                    </div>
                    <div className="bg-gray-800 bg-opacity-60 rounded-lg p-2.5 text-center border border-gray-700">
                        <div className="w-2 h-2 rounded-full bg-purple-400 mx-auto mb-1" />
                        <p className="text-gray-400">Manager</p>
                        <p className="text-gray-500 text-xs">All documents</p>
                    </div>
                </div>

                <p className="mt-4 text-center text-xs text-gray-600">
                    Admin access?{' '}
                    <Link to="/admin/login" className="text-gray-500 hover:text-gray-400 transition-colors">
                        Admin portal →
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
