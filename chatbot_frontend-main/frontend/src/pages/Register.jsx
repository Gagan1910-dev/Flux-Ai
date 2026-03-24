import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';

const Register = ({ onLogin }) => {
    const [form, setForm] = useState({ name: '', username: '', email: '', password: '', confirmPassword: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    // Preview the role that will be assigned based on email domain
    const previewRole = (email) => {
        if (!email) return null;
        if (email.toLowerCase().endsWith('@company.com')) return 'employee';
        return 'public';
    };

    const predictedRole = previewRole(form.email);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (form.password !== form.confirmPassword) {
            return setError('Passwords do not match');
        }
        if (form.password.length < 6) {
            return setError('Password must be at least 6 characters');
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/register', {
                name: form.name || form.username,
                username: form.username,
                email: form.email,
                password: form.password,
            });

            const { token, user } = response.data;
            onLogin(user, token);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const roleColors = {
        employee: 'text-blue-400 bg-blue-900 bg-opacity-30 border-blue-700',
        public: 'text-green-400 bg-green-900 bg-opacity-30 border-green-700',
        manager: 'text-purple-400 bg-purple-900 bg-opacity-30 border-purple-700',
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 px-4 py-8">

            {/* Background glows */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-indigo-600 opacity-10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/3 left-1/4 w-64 h-64 bg-blue-500 opacity-10 rounded-full blur-3xl" />
            </div>

            <div className="relative max-w-md w-full">
                {/* Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white">Create account</h1>
                    <p className="text-gray-400 mt-1 text-sm">Your role is assigned automatically based on your email</p>
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

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="reg-name" className="block text-sm font-medium text-gray-300 mb-1.5">
                                    Full Name
                                </label>
                                <input
                                    id="reg-name"
                                    name="name"
                                    type="text"
                                    value={form.name}
                                    onChange={handleChange}
                                    placeholder="John Doe"
                                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 transition-all text-sm"
                                />
                            </div>
                            <div>
                                <label htmlFor="reg-username" className="block text-sm font-medium text-gray-300 mb-1.5">
                                    Username <span className="text-red-400">*</span>
                                </label>
                                <input
                                    id="reg-username"
                                    name="username"
                                    type="text"
                                    value={form.username}
                                    onChange={handleChange}
                                    required
                                    placeholder="johndoe"
                                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 transition-all text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="reg-email" className="block text-sm font-medium text-gray-300 mb-1.5">
                                Email address <span className="text-red-400">*</span>
                            </label>
                            <input
                                id="reg-email"
                                name="email"
                                type="email"
                                value={form.email}
                                onChange={handleChange}
                                required
                                placeholder="you@example.com or you@company.com"
                                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 transition-all text-sm"
                            />
                            {/* Role preview */}
                            {predictedRole && (
                                <div className={`mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${roleColors[predictedRole]}`}>
                                    <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                    You will be assigned role: <span className="font-bold uppercase">{predictedRole}</span>
                                    {predictedRole === 'employee' && <span className="text-gray-400 font-normal">— company email detected</span>}
                                    {predictedRole === 'public' && <span className="text-gray-400 font-normal">— external email</span>}
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="reg-password" className="block text-sm font-medium text-gray-300 mb-1.5">
                                Password <span className="text-red-400">*</span>
                            </label>
                            <input
                                id="reg-password"
                                name="password"
                                type="password"
                                value={form.password}
                                onChange={handleChange}
                                required
                                placeholder="At least 6 characters"
                                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 transition-all text-sm"
                            />
                        </div>

                        <div>
                            <label htmlFor="reg-confirm" className="block text-sm font-medium text-gray-300 mb-1.5">
                                Confirm Password <span className="text-red-400">*</span>
                            </label>
                            <input
                                id="reg-confirm"
                                name="confirmPassword"
                                type="password"
                                value={form.confirmPassword}
                                onChange={handleChange}
                                required
                                placeholder="Repeat password"
                                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 transition-all text-sm"
                            />
                        </div>

                        {/* Role info note */}
                        <div className="bg-gray-900 bg-opacity-60 rounded-xl p-3 border border-gray-700">
                            <p className="text-xs text-gray-400 flex items-start gap-2">
                                <svg className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span>
                                    Company email (<code className="text-blue-300">@company.com</code>) → <strong className="text-blue-400">Employee</strong> access.
                                    External email → <strong className="text-green-400">Public</strong> access.
                                    Managers are upgraded by admins.
                                </span>
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Creating account...
                                </span>
                            ) : 'Create Account'}
                        </button>
                    </form>

                    <p className="mt-5 text-center text-sm text-gray-400">
                        Already have an account?{' '}
                        <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;
