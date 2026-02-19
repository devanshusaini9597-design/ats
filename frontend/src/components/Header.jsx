import React, { useState, useEffect } from 'react';
import { Menu, Bell, Search, ChevronDown, User, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { handleLogout } from '../utils/authUtils';
import { useToast } from './Toast';
import NotificationBell from './NotificationBell';
import { authenticatedFetch } from '../utils/fetchUtils';
import BASE_API_URL from '../config';

const Header = ({ setSidebarOpen, sidebarOpen }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [profilePicture, setProfilePicture] = useState('');

  // Get user info from localStorage
  const userEmail = localStorage.getItem('userEmail') || 'User';
  const userName = localStorage.getItem('userName') || '';
  const displayName = userName || (userEmail.includes('@') ? userEmail.split('@')[0] : userEmail);
  const initials = (userName ? userName.split(' ').map(w => w[0]).join('').slice(0, 2) : displayName.slice(0, 2)).toUpperCase();

  // Fetch profile picture on mount and when Settings updates it
  useEffect(() => {
    const fetchProfilePicture = async () => {
      try {
        const res = await authenticatedFetch(`${BASE_API_URL}/api/profile`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user?.profilePicture) {
            setProfilePicture(data.user.profilePicture);
          } else {
            setProfilePicture('');
          }
        }
      } catch {
        setProfilePicture('');
      }
    };
    fetchProfilePicture();

    const onPictureUpdated = (e) => {
      setProfilePicture(e.detail ?? '');
    };
    window.addEventListener('profilePictureUpdated', onPictureUpdated);
    return () => window.removeEventListener('profilePictureUpdated', onPictureUpdated);
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200 transition-all duration-300">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 gap-4">
        {/* Left Section */}
        <div className="flex items-center gap-2 sm:gap-4 flex-1">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            title="Toggle sidebar"
          >
            <Menu size={24} className="text-gray-600" />
          </button>

          {/* Search Bar - Hidden on small screens */}
          <div className="hidden md:block flex-1 max-w-md">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search candidates, jobs..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
          {/* Notifications */}
          <NotificationBell />

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="User menu"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 overflow-hidden bg-blue-600 text-white">
                {profilePicture ? (
                  <img src={`${BASE_API_URL}${profilePicture}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <span className="hidden sm:inline text-sm font-medium text-gray-700">Hi, {displayName}</span>
              <ChevronDown size={16} className="text-gray-600 hidden sm:inline" />
            </button>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-900">{displayName}</p>
                  <p className="text-xs text-gray-500">{userEmail}</p>
                </div>
                <div className="py-1">
                  <button onClick={() => { navigate('/settings'); setShowUserMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors cursor-pointer">
                    <User size={16} />
                    My Profile
                  </button>
                  <button onClick={() => { navigate('/settings'); setShowUserMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors cursor-pointer">
                    <span>⚙️</span>
                    Settings
                  </button>
                </div>
                <div className="border-t border-gray-200 py-1">
                  <button onClick={() => handleLogout(navigate)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer">
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </header>
  );
};

export default Header;