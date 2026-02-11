import React, { useState } from 'react';
import { Menu, X, BarChart3, Users, Briefcase, FileText, Settings, LogOut, Home, ChevronDown, ChevronLeft, Upload, Plus, Trash2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Sidebar = ({ isOpen, setIsOpen, sidebarActions = {} }) => {
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  // Extract actions from props with default no-ops
  const {
    onAutoImport = () => console.log('⚠️ onAutoImport not defined'),
    onAddCandidate = () => console.log('⚠️ onAddCandidate not defined')
  } = sidebarActions;

  console.log('📌 Sidebar received sidebarActions:', sidebarActions);
  console.log('📌 onAutoImport:', onAutoImport);
  console.log('📌 onAddCandidate:', onAddCandidate);

  const menuItems = [
    { icon: Home, label: 'Dashboard', type: 'link', action: () => { navigate('/dashboard'); if (isOpen) setIsOpen(false); } },
    { 
      icon: Users, 
      label: 'Candidates', 
      type: 'submenu',
      submenu: [
        { label: 'All Candidates', action: () => { navigate('/ats'); if (isOpen) setIsOpen(false); }, icon: Users },
        { label: 'Add a Candidate', action: () => { navigate('/add-candidate'); if (isOpen) setIsOpen(false); }, icon: Plus },
        { label: 'Auto Import', action: () => { alert('🚀 Feature Coming Soon'); navigate('/dashboard'); if (isOpen) setIsOpen(false); }, icon: Upload },
        { label: 'Pending Review', action: () => { alert('🚀 Feature Coming Soon'); navigate('/dashboard'); if (isOpen) setIsOpen(false); }, icon: FileText }
      ]
    },
    { icon: Briefcase, label: 'Jobs', type: 'link', action: () => { alert('🚀 Feature Coming Soon'); navigate('/dashboard'); if (isOpen) setIsOpen(false); } },
    { 
      icon: BarChart3, 
      label: 'Reports', 
      type: 'submenu',
      submenu: [
        { label: 'Analytics', action: () => { alert('🚀 Feature Coming Soon'); navigate('/dashboard'); if (isOpen) setIsOpen(false); }, icon: BarChart3 },
        { label: 'Export', action: () => { alert('🚀 Feature Coming Soon'); navigate('/dashboard'); if (isOpen) setIsOpen(false); }, icon: FileText }
      ]
    },
    { icon: Users, label: 'Team', type: 'link', action: () => { alert('🚀 Feature Coming Soon'); navigate('/dashboard'); if (isOpen) setIsOpen(false); } },
  ];

  const toggleMenu = (label) => {
    setExpandedMenu(expandedMenu === label ? null : label);
  };

  const handleMenuItemClick = (item) => {
    if (item.type === 'submenu') {
      toggleMenu(item.label);
    } else if (item.action) {
      item.action();
    }
  };

  const handleSubmenuClick = (submenu, e) => {
    e.stopPropagation();
    console.log('🔘 Submenu clicked:', submenu.label);
    if (submenu.action) {
      console.log('✅ Executing action for:', submenu.label);
      submenu.action();
    } else {
      console.warn('❌ No action defined for submenu:', submenu.label);
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        bg-white border-r border-gray-200
        transform transition-all duration-300 ease-in-out
        lg:transform-none
        flex flex-col
        ${collapsed ? 'w-20' : 'w-64'}
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo Section */}
        <div className={`
          h-16 border-b border-gray-200 flex items-center justify-between px-4
          transition-all duration-300
        `}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">HR</span>
              </div>
              <span className="font-bold text-gray-900 text-sm">SkillNix</span>
            </div>
          )}
          
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1 hover:bg-gray-100 rounded-lg transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronLeft 
              size={20} 
              className={`text-gray-600 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            />
          </button>

          <button
            onClick={() => setIsOpen(false)}
            className={`lg:hidden p-1 hover:bg-gray-100 rounded-lg transition-colors ${collapsed ? 'hidden' : ''}`}
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {menuItems.map((item) => (
            <div key={item.label}>
              {item.type === 'submenu' ? (
                <>
                  <button
                    onClick={() => handleMenuItemClick(item)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 rounded-lg
                      transition-colors duration-200 cursor-pointer
                      ${expandedMenu === item.label 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'text-gray-700 hover:bg-gray-50'
                      }
                    `}
                    title={collapsed ? item.label : ''}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <item.icon size={20} className="flex-shrink-0" />
                      {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
                    </div>
                    {!collapsed && (
                      <ChevronDown 
                        size={16} 
                        className={`transition-transform flex-shrink-0 ${expandedMenu === item.label ? 'rotate-180' : ''}`}
                      />
                    )}
                  </button>
                  
                  {/* Submenu */}
                  {expandedMenu === item.label && !collapsed && (
                    <div className="mt-2 ml-4 space-y-1 border-l-2 border-gray-200 pl-3">
                      {item.submenu.map((subitem) => (
                        <button
                          key={subitem.label}
                          onClick={(e) => handleSubmenuClick(subitem, e)}
                          className="w-full text-left px-2 py-2 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                          title={subitem.label}
                        >
                          <subitem.icon size={14} />
                          {subitem.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => handleMenuItemClick(item)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg
                    transition-colors duration-200 text-left cursor-pointer
                    text-gray-700 hover:bg-gray-50
                  `}
                  title={collapsed ? item.label : ''}
                >
                  <item.icon size={20} className="flex-shrink-0" />
                  {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
                </button>
              )}
            </div>
          ))}
        </nav>

        {/* Bottom Quick Actions */}
        {!collapsed && expandedMenu === null && (
          <div className="border-t border-gray-200 p-3 space-y-2">
            <button 
              onClick={() => {
                console.log('🔘 Quick Import button clicked');
                onAutoImport();
                if (isOpen) setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium cursor-pointer"
              title="Auto Import"
            >
              <Upload size={16} />
              Quick Import
            </button>
            <button 
              onClick={() => {
                console.log('🔘 Add Person button clicked');
                onAddCandidate();
                if (isOpen) setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors text-sm font-medium cursor-pointer"
              title="Add Candidate"
            >
              <Plus size={16} />
              Add Person
            </button>
          </div>
        )}

        {/* Bottom Section */}
        <div className={`border-t border-gray-200 p-2 space-y-1 ${collapsed ? 'hidden lg:block' : ''}`}>
          <button 
            className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings size={20} className="flex-shrink-0" />
            {!collapsed && <span className="font-medium text-sm">Settings</span>}
          </button>
          <button 
            className="w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut size={20} className="flex-shrink-0" />
            {!collapsed && <span className="font-medium text-sm">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
