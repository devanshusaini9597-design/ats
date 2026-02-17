import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { BASE_API_URL } from '../config';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useToast } from './Toast';

const ResumeParsing = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editBuffer, setEditBuffer] = useState({
    name: '',
    email: '',
    contact: '',
    position: '',
    company: '',
    experience: '',
    location: '',
    skills: '',
    education: ''
  });

  // Handle file selection
  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    setParsing(true);
    setError('');
    setResults([]);

    try {
      const newResults = [];


      for (const file of files) {
        const formData = new FormData();
        formData.append('resume', file);

        try {
          // Add 60s timeout per resume to handle large/complex files
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);

          const parseUrl = `${BASE_API_URL}/candidates/parse-logic`;
          console.log('📄 Resume parse request:', { url: parseUrl, fileName: file.name, fileSize: file.size, fileType: file.type, hasToken: !!localStorage.getItem('token') });

          const response = await authenticatedFetch(parseUrl, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            let backendError = 'Failed to parse resume';
            try {
              const errorData = await response.json();
              backendError = errorData?.error || errorData?.message || backendError;
              // Print full backend error to console for debugging
              console.error('Resume parsing backend error:', JSON.stringify(errorData, null, 2));
              console.error('Resume parsing error details:', errorData?.details || 'No details');
              console.error('Resume parsing suggestion:', errorData?.suggestion || 'None');
            } catch (jsonErr) {
              // Print raw response if not JSON
              const text = await response.text();
              console.error('Resume parsing backend error (non-JSON):', text);
            }
            newResults.push({
              fileName: file.name,
              success: false,
              error: backendError,
              data: null,
            });
            continue;
          }

          const result = await response.json();
          newResults.push({
            fileName: file.name,
            success: true,
            error: null,
            data: {
              name: result.parsed?.name || result.name || '',
              email: result.parsed?.email || result.email || '',
              contact: result.parsed?.contact || result.contact || '',
              position: result.parsed?.position || result.position || '',
              company: result.parsed?.company || result.company || '',
              experience: result.parsed?.experience || result.experience || '',
              location: result.parsed?.location || result.location || '',
              skills: result.parsed?.skills || result.skills || '',
              education: result.parsed?.education || result.education || ''
            },
            confidence: result.parsed?.confidence || result.confidence || {},
            metadata: result.metadata || {}
          });
        } catch (err) {
          // Detailed fetch/network error to console
          console.error('❌ Resume parsing fetch error:', {
            name: err.name,
            message: err.message,
            url: `${BASE_API_URL}/candidates/parse-logic`,
            fileName: file.name,
            stack: err.stack
          });
          const errorMsg = err.name === 'AbortError'
            ? 'Request timed out. This resume may be scanned/image-based. Please try a text-based PDF or DOCX.'
            : err.message;
          newResults.push({
            fileName: file.name,
            success: false,
            error: errorMsg,
            data: null,
          });
        }

        // Delay between files to let server finish processing
        if (files.length > 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      setUploadedFiles(files.map(f => ({ name: f.name, size: f.size })));
      setResults(newResults);
    } catch (err) {
      setError('Error processing files: ' + err.message);
    } finally {
      setParsing(false);
    }
  };


  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  // Get confidence color and label
  const getConfidenceColor = (score) => {
    if (score >= 85) return { bg: 'bg-green-100', text: 'text-green-700', label: 'High' };
    if (score >= 70) return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Medium' };
    if (score >= 50) return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Low' };
    return { bg: 'bg-red-100', text: 'text-red-700', label: 'Very Low' };
  };

  // Start editing a result
  const handleEdit = (idx) => {
    setEditingIdx(idx);
    setEditBuffer({
      name: results[idx].data?.name || '',
      email: results[idx].data?.email || '',
      contact: results[idx].data?.contact || '',
      position: results[idx].data?.position || '',
      company: results[idx].data?.company || '',
      experience: results[idx].data?.experience || '',
      location: results[idx].data?.location || '',
      skills: results[idx].data?.skills || '',
      education: results[idx].data?.education || ''
    });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingIdx(null);
    setEditBuffer({
      name: '',
      email: '',
      contact: '',
      position: '',
      company: '',
      experience: '',
      location: '',
      skills: '',
      education: ''
    });
  };

  // Save edited data
  const handleSaveEdit = (idx) => {
    setResults(prev => prev.map((r, i) =>
      i === idx ? { ...r, data: { ...editBuffer } } : r
    ));
    setEditingIdx(null);
    setEditBuffer({ name: '', email: '', contact: '' });
  };

  // Handle edit buffer change
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditBuffer(prev => ({ ...prev, [name]: value }));
  };

  // Download results as JSON
  const downloadResults = () => {
    const successfulResults = results
      .filter(r => r.success)
      .map(r => r.data);

    const dataStr = JSON.stringify(successfulResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resume-parsing-results-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Add to candidates directly
  const addToCandidate = (resultData) => {
    localStorage.setItem('parsedResumeData', JSON.stringify(resultData));
    navigate('/add-candidate');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-6xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Resume Parsing</h1>
              <p className="text-gray-600">Extract candidate information from resume PDFs automatically</p>
            </div>

            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
              <div className="flex flex-col items-center">
                <label className="flex flex-col items-center justify-center w-full cursor-pointer">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload size={48} className="text-blue-600 mb-2" strokeWidth={1.5} />
                    <p className="text-sm text-gray-700 text-center">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PDF files (Max 10MB each)</p>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={handleFileSelect}
                    disabled={parsing}
                    className="hidden"
                  />
                </label>
              </div>

              {/* File Upload Progress */}
              {uploadedFiles.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Uploaded Files</h3>
                  <div className="space-y-2">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText size={18} className="text-blue-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                            <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        {parsing && <span className="text-xs text-gray-500">Processing...</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Results Section */}
            {results.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Parsing Results</h2>
                  <button
                    onClick={downloadResults}
                    disabled={results.filter(r => r.success).length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    📥 Download Results
                  </button>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-700 font-semibold">{results.filter(r => r.success).length}</p>
                    <p className="text-green-600 text-sm">Successfully Parsed</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700 font-semibold">{results.filter(r => !r.success).length}</p>
                    <p className="text-red-600 text-sm">Failed</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-700 font-semibold">{results.length}</p>
                    <p className="text-blue-600 text-sm">Total Processed</p>
                  </div>
                </div>

                {/* Results Cards */}
                <div className="space-y-4">
                  {results.map((result, idx) => (
                    <div
                      key={idx}
                      className={`border rounded-lg p-5 ${
                        result.success
                          ? 'bg-white border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {result.success ? (
                            <CheckCircle size={24} className="text-green-600" />
                          ) : (
                            <AlertCircle size={24} className="text-red-600" />
                          )}
                          <div>
                            <p className="font-semibold text-gray-900">{result.fileName}</p>
                            <p className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                              {result.success ? '✅ Successfully Parsed' : `❌ ${result.error}`}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Data Fields - Editable Preview */}
                      {result.success && result.data && (
                        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                          {editingIdx === idx ? (
                            <>
                              {/* Editable Fields */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                  { key: 'name', label: 'Name', type: 'text' },
                                  { key: 'email', label: 'Email', type: 'email' },
                                  { key: 'contact', label: 'Contact', type: 'tel' },
                                  { key: 'position', label: 'Position/Job Title', type: 'text' },
                                  { key: 'company', label: 'Company', type: 'text' },
                                  { key: 'experience', label: 'Years of Experience', type: 'text' },
                                  { key: 'location', label: 'Location', type: 'text' },
                                  { key: 'education', label: 'Education', type: 'text' }
                                ].map(field => (
                                  <div key={field.key}>
                                    <label className="text-xs font-semibold text-gray-600 uppercase">{field.label}</label>
                                    <input
                                      type={field.type}
                                      name={field.key}
                                      value={editBuffer[field.key]}
                                      onChange={handleEditChange}
                                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                      placeholder={`Enter ${field.label.toLowerCase()}`}
                                    />
                                  </div>
                                ))}
                                <div className="md:col-span-2">
                                  <label className="text-xs font-semibold text-gray-600 uppercase">Skills</label>
                                  <textarea
                                    name="skills"
                                    value={editBuffer.skills}
                                    onChange={handleEditChange}
                                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Enter skills (comma-separated)"
                                    rows="2"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                                <button
                                  onClick={() => handleSaveEdit(idx)}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
                                >
                                  ✅ Save Changes
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 text-sm font-medium transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Read-only Preview Fields with Confidence Badges */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                  { key: 'name', label: '👤 Name', icon: '👤' },
                                  { key: 'email', label: '📧 Email', icon: '📧' },
                                  { key: 'contact', label: '📞 Contact', icon: '📞' },
                                  { key: 'position', label: '💼 Position', icon: '💼' },
                                  { key: 'company', label: '🏢 Company', icon: '🏢' },
                                  { key: 'experience', label: '⏳ Experience', icon: '⏳' },
                                  { key: 'location', label: '📍 Location', icon: '📍' },
                                  { key: 'education', label: '🎓 Education', icon: '🎓' }
                                ].map(field => {
                                  const value = result.data[field.key];
                                  const confidence = result.confidence?.[field.key] || 0;
                                  const confidenceColor = getConfidenceColor(confidence);
                                  
                                  return value ? (
                                    <div key={field.key} className="border border-gray-200 rounded-lg p-3 bg-white hover:shadow-sm transition-shadow">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">{field.label}</label>
                                          <p className="text-gray-900 font-medium text-sm break-words">{value}</p>
                                        </div>
                                        {confidence > 0 && (
                                          <div className={`${confidenceColor.bg} ${confidenceColor.text} px-2 py-1 rounded text-xs font-semibold whitespace-nowrap`}>
                                            {Math.round(confidence)}%
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => copyToClipboard(value)}
                                        className="text-blue-600 hover:text-blue-700 text-xs font-medium mt-2 inline-flex items-center gap-1"
                                      >
                                        📋 Copy
                                      </button>
                                    </div>
                                  ) : null;
                                })}
                              </div>

                              {/* Missing Fields Notice */}
                              {!Object.values(result.data).some(v => v) && (
                                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                  <p className="text-yellow-700 text-sm font-medium">⚠️ No data extracted from this resume. Please verify the file and try again.</p>
                                </div>
                              )}

                              {/* Action Buttons */}
                              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                                <button
                                  onClick={() => handleEdit(idx)}
                                  className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  onClick={() => addToCandidate(result.data)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                                >
                                  ➕ Add as Candidate
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {results.length === 0 && !parsing && (
              <div className="text-center py-12">
                <FileText size={48} className="text-gray-300 mx-auto mb-4" strokeWidth={1} />
                <p className="text-gray-500">Upload resume PDFs to get started</p>
              </div>
            )}

            {/* Loading State */}
            {parsing && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Parsing resumes...</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ResumeParsing;
