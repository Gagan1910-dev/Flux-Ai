import axios from 'axios';
import { getAuthToken } from './auth';

// Helper: Get or Create Guest ID
export const getGuestId = () => {
  let guestId = localStorage.getItem("flux_guest_id");
  if (!guestId) {
    guestId = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("flux_guest_id", guestId);
  }
  return guestId;
};

// In local development, prefer localhost:5000/api unless VITE_API_URL is explicitly set.
// For production deployments, fallback to hosted Render API.
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000/api' : 'https://flux-ai-final-version.onrender.com/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Attach JWT token for every request
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Friendly error messages on network timeouts or failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return Promise.reject({
        ...error,
        response: {
          ...error.response,
          data: {
            error: 'Server request timed out. Please verify your backend server on port 5000 is reachable.',
          },
        },
      });
    }
    return Promise.reject(error);
  }
);

export default api;
