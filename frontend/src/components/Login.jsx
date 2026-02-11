

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, X } from 'lucide-react';
import API_URL from '../config';

const Login = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [unmatchedEmail, setUnmatchedEmail] = useState('');

  // Email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password validation - min 8 chars, uppercase, lowercase, number, special char
  const validatePassword = (password) => {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    const hasMinLength = password.length >= 8;

    return {
      valid: hasUppercase && hasLowercase && hasNumber && hasSpecial && hasMinLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecial,
      hasMinLength
    };
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
    if (fieldErrors[e.target.name]) {
      setFieldErrors({ ...fieldErrors, [e.target.name]: '' });
    }
  };

  // ✅ Updated HandleSubmit with validation
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setFieldErrors({});

    const { email, password } = formData;
    const errors = {};

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    // Validate email format
    if (!validateEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      errors.password = 'Password must be 8+ chars with uppercase, lowercase, number & special character';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      // ✅ Using the specific URL and Logic you provided
      const res = await fetch(`${API_URL}/api/login`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        // --- SUCCESS CASE ---
        localStorage.setItem('token', data.token); // Token save karein
        localStorage.setItem('userEmail', email); 
        localStorage.setItem('isLoggedIn', 'true');

        setSuccess('Login Successful! Redirecting...');
        
        setTimeout(() => {
          window.location.href = '/homeunder'; // Direct redirect
        }, 1000);
      } else {
        // Check if email is not found
        if (data.message === 'email_not_found') {
          setUnmatchedEmail(email);
          setShowSignupModal(true);
          setError('');
        } else {
          setError(data.displayMessage || data.message || 'Login failed.');
        }
      }
    } catch (err) {
      console.error('Login Error:', err);
      setError("Backend server start nahi hai! Terminal mein 'node server.js' chalayein.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 font-sans" style={{backgroundColor: 'var(--neutral-50)'}}>
      <div className="w-full max-w-md rounded-2xl p-8" style={{backgroundColor: 'var(--bg-primary)', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border-light)'}}>
        
        <h2 className="text-3xl font-bold text-center mb-6" style={{color: 'var(--primary-main)'}}>Login</h2>
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm text-center font-medium" style={{backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-main)', color: 'var(--error-main)'}}>
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 rounded-lg text-sm text-center font-medium" style={{backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-main)', color: 'var(--success-main)'}}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold" style={{color: 'var(--text-secondary)'}}>Email Address</label>
            <input 
              type="email" 
              name="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="admin@company.com" 
              className="w-full mt-1 p-3 rounded-lg outline-none transition-all"
              style={{
                border: `1px solid ${fieldErrors.email ? 'var(--error-main)' : 'var(--border-main)'}`,
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-primary)'
              }}
              onFocus={(e) => e.target.style.boxShadow = '0 0 0 3px var(--primary-lighter)'}
              onBlur={(e) => e.target.style.boxShadow = 'none'}
            />
            {fieldErrors.email && <p className="text-sm mt-1" style={{color: 'var(--error-main)'}}>{fieldErrors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold" style={{color: 'var(--text-secondary)'}}>Password</label>
            <input 
              type="password" 
              name="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••" 
              className="w-full mt-1 p-3 rounded-lg outline-none transition-all"
              style={{
                border: `1px solid ${fieldErrors.password ? 'var(--error-main)' : 'var(--border-main)'}`,
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-primary)'
              }}
              onFocus={(e) => e.target.style.boxShadow = '0 0 0 3px var(--primary-lighter)'}
              onBlur={(e) => e.target.style.boxShadow = 'none'}
            />
            {fieldErrors.password && <p className="text-sm mt-1" style={{color: 'var(--error-main)'}}>{fieldErrors.password}</p>}
          </div>
          
          <button 
            type="submit" 
            className="w-full text-white font-bold py-3 rounded-lg shadow-lg transition-all active:scale-95"
            style={{
              background: 'var(--gradient-primary)',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)'
            }}
            onMouseEnter={(e) => e.target.style.boxShadow = '0 0 30px rgba(99, 102, 241, 0.5)'}
            onMouseLeave={(e) => e.target.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.3)'}
          >
            Sign In
          </button>
        </form>

        <p className="text-center mt-6" style={{color: 'var(--text-secondary)'}}>
          New here? <Link to="/register" className="font-semibold hover:underline" style={{color: 'var(--primary-main)'}}>Register Account</Link>
        </p>
      </div>

      {/* ✅ SIGNUP SUGGESTION MODAL */}
      {showSignupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm rounded-2xl p-8 relative" style={{backgroundColor: 'var(--bg-primary)', boxShadow: 'var(--shadow-xl)'}}>
            {/* Close Button */}
            <button
              onClick={() => setShowSignupModal(false)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg transition"
              style={{backgroundColor: 'transparent'}}
            >
              <X size={24} style={{color: 'var(--text-secondary)'}} />
            </button>

            {/* Modal Content */}
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <Mail size={48} style={{color: 'var(--primary-main)'}} />
              </div>

              <h3 className="text-2xl font-bold mb-3" style={{color: 'var(--text-primary)'}}>
                Email Not Found
              </h3>

              <p className="text-sm mb-6" style={{color: 'var(--text-secondary)'}}>
                The email <span className="font-semibold" style={{color: 'var(--primary-main)'}}>{unmatchedEmail}</span> is not registered with us.
              </p>

              <p className="text-sm mb-8" style={{color: 'var(--text-secondary)'}}>
                Would you like to create a new account with this email?
              </p>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSignupModal(false)}
                  className="flex-1 py-3 rounded-lg font-semibold transition-all"
                  style={{
                    backgroundColor: 'var(--border-light)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-main)'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-secondary)'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--border-light)'}
                >
                  Go Back
                </button>

                <button
                  onClick={() => {
                    setShowSignupModal(false);
                    navigate('/register');
                  }}
                  className="flex-1 py-3 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2"
                  style={{
                    background: 'var(--gradient-primary)',
                    boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)'
                  }}
                  onMouseEnter={(e) => e.target.style.boxShadow = '0 0 30px rgba(99, 102, 241, 0.5)'}
                  onMouseLeave={(e) => e.target.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.3)'}
                >
                  Sign Up <ArrowRight size={18} />
                </button>
              </div>

              <p className="text-xs mt-4" style={{color: 'var(--text-tertiary)'}}>
                Already have an account? <button
                  onClick={() => setShowSignupModal(false)}
                  className="font-semibold hover:underline"
                  style={{
                    color: 'var(--primary-main)',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Try another email
                </button>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;