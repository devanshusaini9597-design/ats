import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, ArrowRight, X } from 'lucide-react';

const ProtectedRoute = ({ children }) => {
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const location = useLocation();
  const [showLoginModal, setShowLoginModal] = useState(false);

  // If user is not logged in or token is missing, show modal
  if (!isLoggedIn || !token) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div 
          className="w-full max-w-sm rounded-2xl p-8 relative animate-fadeIn" 
          style={{
            backgroundColor: 'var(--bg-primary)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}
        >
          {/* Close Button */}
          <button
            onClick={() => window.history.back()}
            className="absolute top-4 right-4 p-2 hover:bg-opacity-20 rounded-lg transition-all"
            style={{ color: 'var(--primary-main)' }}
          >
            <X size={20} />
          </button>

          {/* Lock Icon */}
          <div className="flex justify-center mb-4">
            <Lock 
              size={48} 
              style={{color: 'var(--primary-main)'}}
              className="animate-pulse"
            />
          </div>

          {/* Content */}
          <h3 
            className="text-xl font-bold text-center mb-2"
            style={{color: 'var(--text-primary)'}}
          >
            Authentication Required
          </h3>
          
          <p 
            className="text-center mb-2"
            style={{color: 'var(--text-secondary)'}}
          >
            You need to login to access this page.
          </p>

          <p 
            className="text-center text-sm mb-6 p-2 rounded"
            style={{
              color: 'var(--primary-main)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            Trying to access: <strong>{location.pathname}</strong>
          </p>

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.history.back()}
              className="w-full py-2 px-4 rounded-lg font-medium transition-all duration-200"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)'
              }}
              onMouseEnter={(e) => e.target.style.opacity = '0.8'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              Go Back
            </button>

            <button
              onClick={() => navigate('/login')}
              className="w-full py-2 px-4 rounded-lg font-medium text-white flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-lg"
              style={{
                backgroundColor: 'var(--primary-main)'
              }}
            >
              Go to Login <ArrowRight size={18} />
            </button>
          </div>

          {/* Alternative Option */}
          <p 
            className="text-center text-xs mt-4"
            style={{color: 'var(--text-secondary)'}}
          >
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/register')}
              className="font-semibold underline hover:no-underline transition-all"
              style={{color: 'var(--primary-main)'}}
            >
              Sign up here
            </button>
          </p>
        </div>
      </div>
    );
  }

  // If authenticated, render the protected component
  return children;
};

export default ProtectedRoute;
