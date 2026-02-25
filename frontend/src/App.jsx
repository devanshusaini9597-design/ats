import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { GlobalLoaderProvider } from './context/GlobalLoaderContext';
import GlobalLoader from './components/GlobalLoader';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import DashboardPage from './components/DashboardPage';
import ATSPage from './components/ATSPage';
import AddCandidatePage from './components/AddCandidatePage';
import AutoImportPage from './components/AutoImportPage';
import PendingReviewPage from './components/PendingReviewPage';
import ResumeParsing from './components/ResumeParsing';
import Recruitment from './components/Recruitment';
import Homeunder from './components/Homeunder';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import CandidateSearch from './components/CandidateSearch';
import ProtectedRoute from './components/ProtectedRoute';
import ManageMasterData from './components/ManageMasterData';
import EmailTemplatesPage from './components/EmailTemplatesPage';
import EmailSettingsPage from './components/EmailSettingsPage';
import ProfileSettingsPage from './components/ProfileSettingsPage';
import TeamPage from './components/TeamPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import Jobs from './pages/Jobs';
import SubscribePage from './components/SubscribePage';
import SubscribeThankYouPage from './components/SubscribeThankYouPage';
import UnsubscribePage from './components/UnsubscribePage';
import UnsubscribeThankYouPage from './components/UnsubscribeThankYouPage';

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/subscribe', element: <SubscribePage /> },
  { path: '/subscribe/thank-you', element: <SubscribeThankYouPage /> },
  { path: '/unsubscribe', element: <UnsubscribePage /> },
  { path: '/unsubscribe/thank-you', element: <UnsubscribeThankYouPage /> },
  { path: '/dashboard', element: <ProtectedRoute><DashboardPage /></ProtectedRoute> },
  { path: '/ats', element: <ProtectedRoute><ATSPage /></ProtectedRoute> },
  { path: '/add-candidate', element: <ProtectedRoute><AddCandidatePage /></ProtectedRoute> },
  { path: '/resume-parsing', element: <ProtectedRoute><ResumeParsing /></ProtectedRoute> },
  { path: '/auto-import', element: <ProtectedRoute><AutoImportPage /></ProtectedRoute> },
  { path: '/pending-review', element: <ProtectedRoute><PendingReviewPage /></ProtectedRoute> },
  { path: '/homeunder', element: <ProtectedRoute><Homeunder /></ProtectedRoute> },
  { path: '/jobs', element: <ProtectedRoute><Jobs /></ProtectedRoute> },
  { path: '/recruitment', element: <ProtectedRoute><Recruitment /></ProtectedRoute> },
  { path: '/analytics', element: <ProtectedRoute><AnalyticsDashboard /></ProtectedRoute> },
  { path: '/candidate-search', element: <ProtectedRoute><CandidateSearch /></ProtectedRoute> },
  { path: '/manage-positions', element: <ProtectedRoute><ManageMasterData key="positions" title="Positions" apiEndpoint="/api/positions" navigateBack="/dashboard" /></ProtectedRoute> },
  { path: '/manage-clients', element: <ProtectedRoute><ManageMasterData key="clients" title="Clients" apiEndpoint="/api/clients" navigateBack="/dashboard" /></ProtectedRoute> },
  { path: '/manage-sources', element: <ProtectedRoute><ManageMasterData key="sources" title="Sources" apiEndpoint="/api/sources" navigateBack="/dashboard" /></ProtectedRoute> },
  { path: '/email-templates', element: <ProtectedRoute><EmailTemplatesPage /></ProtectedRoute> },
  { path: '/email-settings', element: <ProtectedRoute><EmailSettingsPage /></ProtectedRoute> },
  { path: '/settings', element: <ProtectedRoute><ProfileSettingsPage /></ProtectedRoute> },
  { path: '/team', element: <ProtectedRoute><TeamPage /></ProtectedRoute> },
]);

function App() {
  return (
    <GlobalLoaderProvider>
      <GlobalLoader />
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <RouterProvider router={router} />
      </div>
    </GlobalLoaderProvider>
  );
}

export default App;