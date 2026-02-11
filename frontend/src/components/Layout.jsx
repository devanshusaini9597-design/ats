import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children, sidebarActions = {} }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    console.log('📍 Layout received sidebarActions:', sidebarActions);
  }, [sidebarActions]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} sidebarActions={sidebarActions} />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header setSidebarOpen={setSidebarOpen} sidebarOpen={sidebarOpen} />

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="w-full h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
