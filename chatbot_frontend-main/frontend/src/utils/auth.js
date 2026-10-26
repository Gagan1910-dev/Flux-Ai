export const getUserToken = () => {
  return localStorage.getItem('token');
};

export const getGuestToken = () => {
  return localStorage.getItem('guest_token');
};

export const getAuthToken = () => {
  // Prefer authenticated user token; fallback to verified guest session token
  return getUserToken() || getGuestToken();
};

export const setAuthToken = (token) => {
  localStorage.setItem('token', token);
};

export const setGuestSession = (guestId, token) => {
  if (guestId) localStorage.setItem('guest_id', guestId);
  if (token) localStorage.setItem('guest_token', token);
};

export const removeAuthToken = () => {
  localStorage.removeItem('token');
};

export const clearAllSessions = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('guest_token');
  localStorage.removeItem('guest_id');
};

export const getAuthHeaders = () => {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};
