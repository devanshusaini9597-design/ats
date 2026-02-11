import React, { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import Layout from './Layout';
import ATS from './ATS';
import { useNavigate } from 'react-router-dom';

const AutoImportPage = () => {
  const atsRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const handleAutoImportClick = () => {
    console.log('🚀 Auto Import button clicked on page');
    atsRef.current?.triggerAutoImport?.();
  };

  const handleImportComplete = (data) => {
    console.log('✅ Import completed:', data);
    console.log('📊 Imported:', data.imported, 'Review:', data.review);
    setImportedCount(data.imported);
    setShowSuccessToast(true);
    console.log('📋 Toast showing...');

    // Redirect to All Candidates page after 3 seconds
    setTimeout(() => {
      console.log('🔄 Redirecting to All Candidates...');
      navigate('/ats');
      setShowSuccessToast(false);
    }, 3000);
  };

  const sidebarActions = {
    onAutoImport: () => {
      console.log('Sidebar Auto Import triggered');
      handleAutoImportClick();
    },
    onAddCandidate: () => atsRef.current?.openAddCandidateModal?.(),
  };

  return (
    <Layout sidebarActions={sidebarActions}>
      <div className="w-full bg-gradient-to-br from-slate-50 to-indigo-50 min-h-screen p-6">
        {/* Success Toast Notification */}
        {showSuccessToast && (
          <div className="fixed top-4 right-4 z-50 animate-bounce">
            <div className="bg-green-50 border-l-4 border-green-600 rounded-lg shadow-lg p-4 max-w-sm">
              <div className="flex items-start gap-3">
                <CheckCircle size={24} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-green-900">Import Complete!</h3>
                  <p className="text-sm text-green-800 mt-1">{importedCount} candidates imported.</p>
                  <p className="text-sm text-yellow-700 mt-1 font-semibold">📋 See all candidates...</p>
                  <p className="text-xs text-green-700 mt-2">Redirecting to All Candidates...</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hidden file input for ATS */}
        <input 
          type="file" 
          accept=".csv, .xlsx, .xls" 
          ref={fileInputRef} 
          className="hidden" 
        />

        {/* Header Section */}
        <div className="max-w-6xl mx-auto mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-8 border-l-4 border-indigo-600">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
                  <Upload size={40} className="text-indigo-600" />
                  Auto Import Candidates
                </h1>
                <p className="text-slate-600 text-lg">Upload and automatically import candidates from Excel files with smart validation</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Import Card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-8 h-full">
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Upload size={28} className="text-blue-600" />
                Upload Your File
              </h2>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-300 rounded-xl p-12 text-center mb-6 hover:border-blue-500 transition-colors cursor-pointer" onClick={handleAutoImportClick}>
                <Upload size={48} className="mx-auto text-blue-600 mb-4" />
                <p className="text-xl font-bold text-slate-800 mb-2">Click to upload or drag and drop</p>
                <p className="text-slate-600 mb-4">Supported formats: CSV, XLSX, XLS</p>
                <p className="text-sm text-slate-500">Maximum file size: 50 MB</p>
              </div>

              <button 
                onClick={handleAutoImportClick}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition shadow-lg transform hover:scale-105 flex items-center justify-center gap-3"
              >
                <Upload size={24} />
                Select File & Auto Import
              </button>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-slate-600 mb-3 font-semibold">What happens next:</p>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                    <span>System validates all candidate data</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                    <span>Shows candidates ready for import</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                    <span>Highlights any issues that need fixing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                    <span>Stores in database and shows in ATS</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Info Cards */}
          <div className="space-y-4">
            {/* Info Card 1 */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-green-500">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={24} className="text-green-600" />
                <h3 className="font-bold text-slate-800">Smart Validation</h3>
              </div>
              <p className="text-sm text-slate-600">Automatic detection and correction of common data entry issues</p>
            </div>

            {/* Info Card 2 */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-blue-500">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={24} className="text-blue-600" />
                <h3 className="font-bold text-slate-800">Multiple Formats</h3>
              </div>
              <p className="text-sm text-slate-600">Works with Excel (.xlsx), CSV files and legacy formats</p>
            </div>

            {/* Info Card 3 */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-purple-500">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={24} className="text-purple-600" />
                <h3 className="font-bold text-slate-800">Error Handling</h3>
              </div>
              <p className="text-sm text-slate-600">Review and fix any issues before final import</p>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Import Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
              <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-slate-800">Email Detection</p>
                <p className="text-xs text-slate-600">Auto-corrects typos like @gnail.com</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
              <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-slate-800">Phone Validation</p>
                <p className="text-xs text-slate-600">Validates 10-digit Indian mobile numbers</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
              <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-slate-800">Duplicate Detection</p>
                <p className="text-xs text-slate-600">Removes duplicate emails and contacts</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
              <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-slate-800">Smart Mapping</p>
                <p className="text-xs text-slate-600">Auto-detects column positions</p>
              </div>
            </div>
          </div>
        </div>

        {/* ATS Component - Render visibly so modals work properly */}
        <ATS ref={atsRef} onImportComplete={handleImportComplete} />
      </div>
    </Layout>
  );
};

export default AutoImportPage;
