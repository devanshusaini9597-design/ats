// Utility function to handle logout
export const handleLogout = (navigate) => {
  // Clear all authentication data from localStorage
  localStorage.removeItem('token');
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userEmail');
  
  // Redirect to login page
  navigate('/login');
};
