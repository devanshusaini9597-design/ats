

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Existing imports
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import DashboardPage from './components/DashboardPage';
import ATSPage from './components/ATSPage';
import ATS from './components/ATS';
import AutoImportPage from './components/AutoImportPage';
import PendingReviewPage from './components/PendingReviewPage';
import AddCandidatePage from './components/AddCandidatePage';
import Recruitment from './components/Recruitment';
import Homeunder from './components/Homeunder';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import CandidateSearch from './components/CandidateSearch';
import ProtectedRoute from './components/ProtectedRoute';

// Jobs Component Import
import Jobs from './pages/Jobs'; 

function App() {
  return (
    <Router>
      <div className="min-h-screen" style={{backgroundColor: 'var(--bg-secondary)'}}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes - Require Authentication */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/ats" element={<ProtectedRoute><ATSPage /></ProtectedRoute>} />
          <Route path="/add-candidate" element={<ProtectedRoute><AddCandidatePage /></ProtectedRoute>} />
          <Route path="/auto-import" element={<ProtectedRoute><AutoImportPage /></ProtectedRoute>} />
          <Route path="/pending-review" element={<ProtectedRoute><PendingReviewPage /></ProtectedRoute>} />
          <Route path="/homeunder" element={<ProtectedRoute><Homeunder /></ProtectedRoute>} />
          <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
          <Route path="/recruitment" element={<ProtectedRoute><Recruitment /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>} />
          <Route path="/candidate-search" element={<ProtectedRoute><CandidateSearch /></ProtectedRoute>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;