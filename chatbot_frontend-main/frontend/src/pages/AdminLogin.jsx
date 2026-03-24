import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const AdminLogin = ({ onLogin }) => {
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
      // IMPORTANT — Now correct route
      const response = await api.post('/auth/login', { email, password });

      const { token, user } = response.data;

      if (user.role !== 'admin') {
        setError('Admin access required');
        return;
      }

      onLogin(user, token);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="
      min-h-screen flex items-center justify-center 
      bg-gray-50 dark:bg-gray-900 
      transition-colors duration-300 px-4
    ">
      <div className="
        max-w-md w-full 
        bg-white dark:bg-gray-800 
        rounded-lg shadow-lg p-8 
        border border-gray-200 dark:border-gray-700
        transition-colors duration-300
      ">
        <h2 className="
          text-3xl font-bold text-center 
          text-gray-800 dark:text-gray-100 
          mb-8
        ">
          Admin Login
        </h2>

        {error && (
          <div className="
            mb-4 p-3 
            bg-red-100 dark:bg-red-900 
            border border-red-400 dark:border-red-700 
            text-red-700 dark:text-red-200 
            rounded
          ">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Email */}
          <div>
            <label 
              htmlFor="email" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
              className="
                w-full px-4 py-2 
                border border-gray-300 dark:border-gray-700
                bg-white dark:bg-gray-900 
                text-gray-900 dark:text-gray-100
                rounded-lg 
                focus:outline-none focus:ring-2 focus:ring-blue-500
                transition-colors
              "
            />
          </div>

          {/* Password */}
          <div>
            <label 
              htmlFor="password" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
              className="
                w-full px-4 py-2 
                border border-gray-300 dark:border-gray-700
                bg-white dark:bg-gray-900 
                text-gray-900 dark:text-gray-100
                rounded-lg 
                focus:outline-none focus:ring-2 focus:ring-blue-500
                transition-colors
              "
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="
              w-full py-3 
              bg-blue-600 hover:bg-blue-700
              dark:bg-blue-500 dark:hover:bg-blue-600
              text-white rounded-lg font-medium
              disabled:bg-gray-400 disabled:cursor-not-allowed 
              transition-all
            "
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a 
            href="/" 
            className="
              text-blue-600 hover:text-blue-800 
              dark:text-blue-400 dark:hover:text-blue-300
              text-sm transition-colors
            "
          >
            Back to Chat
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;

