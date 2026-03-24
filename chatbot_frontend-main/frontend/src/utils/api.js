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

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";


const api = axios.create({
  baseURL: API_BASE_URL,
});

// Attach JWT token for every request
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
