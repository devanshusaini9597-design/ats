// Utility function to make authenticated API requests
export const authenticatedFetch = (url, options = {}) => {
  const token = localStorage.getItem('token');
  
  // Only set Content-Type if body is not FormData (FormData sets its own Content-Type with boundary)
  const headers = {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Merge with any provided headers
  Object.assign(headers, options.headers || {});
  
  // Add authorization token if it exists
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
};

// Helper to check if response is unauthorized
export const isUnauthorized = (response) => {
  return response.status === 401 || response.status === 403;
};

// Helper to handle unauthorized responses (redirect to login)
export const handleUnauthorized = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userEmail');
  window.location.href = '/login';
};
