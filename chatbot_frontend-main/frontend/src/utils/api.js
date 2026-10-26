import axios from 'axios';
import { getAuthToken, setGuestSession } from './auth';

// In local development, prefer the backend's default port unless VITE_API_URL is explicitly set.
// For production deployments, fallback to hosted Render API.
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000/api' : 'https://flux-ai-final-version.onrender.com/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

// Attach JWT token (user or verified guest) for every request
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Helper: Ensure client has a server-signed guest session
export const ensureGuestSession = async () => {
  const token = getAuthToken();
  if (!token) {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/guest-session`);
      if (response.data?.token && response.data?.guestId) {
        setGuestSession(response.data.guestId, response.data.token);
      }
    } catch (err) {
      console.warn('Guest session initial negotiation deferred:', err.message);
    }
  }
};

// Friendly error messages on network timeouts or failures
api.interceptors.response.use(
  (response) => {
    // If backend issued a new guest session token, store it
    if (response.data?.guestToken && response.data?.guestId) {
      setGuestSession(response.data.guestId, response.data.guestToken);
    }
    return response;
  },
  (error) => {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return Promise.reject({
        ...error,
        response: {
          ...error.response,
          data: {
            error: 'Request timed out after waiting for the server to respond. Please try again.',
          },
        },
      });
    }
    return Promise.reject(error);
  }
);

export default api;
