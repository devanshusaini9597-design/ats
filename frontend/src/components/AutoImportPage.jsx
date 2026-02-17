import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Loader2, AlertTriangle, Edit2, Save, RefreshCw, ArrowLeft, FileSpreadsheet, ShieldCheck, Search, ChevronLeft, ChevronRight, Eye, EyeOff, ArrowRightLeft } from 'lucide-react';
import Layout from './Layout';
import { useNavigate, useBlocker, useLocation } from 'react-router-dom';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import ConfirmationModal from './ConfirmationModal';
import BASE_API_URL from '../config';

const DRAFT_KEY = 'autoImportDraft';

const RECORDS_PER_PAGE = 50;

const AutoImportPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);
  const [fileName, setFileName] = useState('');

  const [reviewData, setReviewData] = useState(null);
  const [reviewFilter, setReviewFilter] = useState('ready');
  const [editingRow, setEditingRow] = useState(null);
  const [importConfirmation, setImportConfirmation] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [stats, setStats] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Show original values toggle
  const [showOriginals, setShowOriginals] = useState(false);

  // Drag and drop
  const [isDragging, setIsDragging] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.reviewData && draft.stats && draft.fileName) {
          setReviewData(draft.reviewData);
          setStats(draft.stats);
          setFileName(draft.fileName);
          setReviewFilter('ready');
          setDraftRestored(true);
        }
      }
    } catch { /* ignore corrupt data */ }
  }, []);

  // Save draft to localStorage whenever reviewData changes
  useEffect(() => {
    if (reviewData && stats && fileName) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ reviewData, stats, fileName, savedAt: Date.now() }));
      } catch { /* storage full, ignore */ }
    }
  }, [reviewData, stats, fileName]);

  // Warn on refresh or closing tab when import data is loaded
  useEffect(() => {
    const hasData = !!(reviewData && (reviewData.ready?.length || reviewData.review?.length || reviewData.blocked?.length));
    const handler = (e) => {
      if (hasData) {
        e.preventDefault();
        e.returnValue = 'Import data is loaded. If you leave or refresh, you will need to upload the file again. Your draft may be restored when you return.';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [reviewData]);

  // Block in-app navigation when import data is loaded (sidebar click, back button, etc.)
  const hasUnsavedData = !!(reviewData && (reviewData.ready?.length || reviewData.review?.length || reviewData.blocked?.length));
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedData && currentLocation.pathname !== nextLocation.pathname
  );

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const startNewUpload = (file) => {
    if (reviewData) {
      setConfirmModal({
        isOpen: true, type: 'edit',
        title: 'Upload New File',
        message: `You have an existing draft with ${(reviewData.ready?.length || 0) + (reviewData.review?.length || 0) + (reviewData.blocked?.length || 0)} records from "${fileName}". Uploading a new file will replace this draft. Continue?`,
        confirmText: 'Upload New File',
        onConfirm: () => {
          setConfirmModal({ isOpen: false });
          processFile(file);
        }
      });
    } else {
      processFile(file);
    }
  };

  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) startNewUpload(file); };
  const handleFileSelect = (e) => { const file = e.target.files[0]; if (file) startNewUpload(file); e.target.value = null; };

  const processFile = async (file) => {
    const validTypes = ['.csv', '.xlsx', '.xls'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validTypes.includes(ext)) { toast.error('Please upload a CSV, XLSX, or XLS file'); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error('File size must be under 50 MB'); return; }

    setFileName(file.name);
    setIsUploading(true);
    setUploadProgress('Uploading file...');
    setUploadPercent(0);

    try {
      const uploadData = new FormData();
      uploadData.append('file', file);

      // Phase 1: Upload file with XHR for real upload progress
      const token = localStorage.getItem('token');
      const uploadResult = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE_API_URL}/candidates/bulk-upload-auto`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.timeout = 600000; // 10 min for large files (15k+ rows)

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const uploadPct = Math.round((e.loaded / e.total) * 100);
            const overallPct = Math.round((e.loaded / e.total) * 30);
            setUploadPercent(overallPct);
            setUploadProgress(`Uploading file to server... ${uploadPct}%`);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 401) { handleUnauthorized(); reject(new Error('Unauthorized')); return; }
          if (xhr.status >= 400) {
            let msg = 'Upload failed';
            try { const p = JSON.parse(xhr.responseText); if (p?.message) msg = p.message; } catch {}
            reject(new Error(`${msg} (HTTP ${xhr.status})`));
            return;
          }
          resolve(xhr.responseText);
        };
        xhr.onerror = () => reject(new Error('Network error. Check your connection. For 15k+ rows, processing may take several minutes.'));
        xhr.ontimeout = () => reject(new Error('Upload timed out. For very large files, try splitting into smaller batches (e.g. 5k rows each).'));
        xhr.send(uploadData);
      });

      // Phase 2: Parse streaming NDJSON response
      setUploadProgress('Processing and validating data...');
      setUploadPercent(30);

      const lines = uploadResult.trim().split('\n').filter(line => line.trim());
      let data = null;

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'progress') {
            const total = parsed.totalEstimate || 1;
            const processed = parsed.processed || 0;
            const pct = 30 + Math.round((processed / total) * 65);
            setUploadPercent(Math.min(pct, 95));
            const readyInfo = parsed.ready !== undefined ? ` (Ready: ${parsed.ready}, Review: ${parsed.review}, Blocked: ${parsed.blocked})` : '';
            setUploadProgress(`${parsed.message}${readyInfo}`);
          } else if (parsed.type === 'complete' || parsed.success) {
            data = parsed;
          }
        } catch { continue; }
      }

      if (!data) {
        for (let i = lines.length - 1; i >= 0; i--) {
          try { data = JSON.parse(lines[i]); break; } catch { continue; }
        }
      }
      if (!data) throw new Error('Could not parse server response');

      setUploadPercent(100);

      if (data.success && data.results) {
        setReviewData(data.results);
        setStats(data.stats);
        setReviewFilter('ready');
        setCurrentPage(1);
        setSearchQuery('');
        toast.success(`Validation complete! Ready: ${data.stats.ready}, Review: ${data.stats.review}, Blocked: ${data.stats.blocked}`);

        // Auto-save review & blocked records to pending collection
        const pendingRecords = [
          ...(data.results.review || []).map(r => ({ ...r, category: 'review' })),
          ...(data.results.blocked || []).map(r => ({ ...r, category: 'blocked' }))
        ];
        if (pendingRecords.length > 0) {
          authenticatedFetch(`${BASE_API_URL}/candidates/pending/save`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: pendingRecords, fileName: file.name })
          })
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.success(`${pendingRecords.length} review/blocked records saved to Pending Review.`);
              }
            })
            .catch((err) => {
              console.warn('Pending save failed:', err);
              toast.error('Could not save review/blocked to Pending Review. You can still import ready records and save pending later.');
            });
        }
      } else {
        throw new Error(data.message || 'Failed to process file');
      }
    } catch (error) {
      if (error.message !== 'Unauthorized') toast.error('Error: ' + error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      setUploadPercent(0);
    }
  };

  // Get ALL records across categories for search
  const allRecords = useMemo(() => {
    if (!reviewData) return [];
    return [
      ...(reviewData.ready || []).map(r => ({ ...r, _category: 'ready' })),
      ...(reviewData.review || []).map(r => ({ ...r, _category: 'review' })),
      ...(reviewData.blocked || []).map(r => ({ ...r, _category: 'blocked' }))
    ];
  }, [reviewData]);

  // Filter and search
  const filteredRecords = useMemo(() => {
    let records;
    if (searchQuery.trim()) {
      // Search across ALL categories
      const q = searchQuery.toLowerCase().trim();
      records = allRecords.filter(row => {
        const f = row.fixed || {};
        const o = row.original || {};
        const searchableText = [
          f.name, f.email, f.contact, f.phone, f.position, f.company, f.companyName,
          f.location, f.status, f.ctc, f.spoc, f.client,
          ...Object.values(o)
        ].filter(Boolean).join(' ').toLowerCase();
        return searchableText.includes(q);
      });
    } else {
      // Filter by selected tab
      if (reviewFilter === 'ready') records = (reviewData?.ready || []).map(r => ({ ...r, _category: 'ready' }));
      else if (reviewFilter === 'review') records = (reviewData?.review || []).map(r => ({ ...r, _category: 'review' }));
      else if (reviewFilter === 'blocked') records = (reviewData?.blocked || []).map(r => ({ ...r, _category: 'blocked' }));
      else records = allRecords;
    }
    return records;
  }, [reviewData, reviewFilter, searchQuery, allRecords]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredRecords.length / RECORDS_PER_PAGE);
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * RECORDS_PER_PAGE;
    return filteredRecords.slice(start, start + RECORDS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  // Reset page when filter/search changes
  const handleFilterChange = (filter) => { setReviewFilter(filter); setCurrentPage(1); setSearchQuery(''); setEditingRow(null); };
  const handleSearchChange = (e) => { setSearchQuery(e.target.value); setCurrentPage(1); };

  const handleImportAll = () => {
    if (!reviewData) return;
    const readyCount = reviewData.ready?.length || 0;
    if (readyCount === 0) { toast.warning('No ready records to import'); return; }

    const reviewCount = reviewData.review?.length || 0;
    const blockedCount = reviewData.blocked?.length || 0;
    const pendingCount = reviewCount + blockedCount;

    setConfirmModal({
      isOpen: true, type: 'success',
      title: 'Import Ready Records',
      message: `Import ${readyCount} ready record${readyCount !== 1 ? 's' : ''} to the database?${pendingCount > 0 ? `\n\n${reviewCount} review + ${blockedCount} blocked records will be saved to "Pending Review" for manual fixes.` : ''}`,
      confirmText: `Import ${readyCount} Ready Record${readyCount !== 1 ? 's' : ''}`,
      onConfirm: performImport
    });
  };

  const performImport = async () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    setIsImporting(true);
    try {
      // Step 1: Import only READY records to main database
      const readyRecords = reviewData.ready || [];
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/import-reviewed`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readyRecords, reviewRecords: [] })
      });
      const responseText = await response.text();
      let result; try { result = JSON.parse(responseText); } catch { throw new Error('Server returned invalid response'); }
      if (!response.ok) throw new Error(result.message || 'Import failed');

      const pendingCount = (reviewData.review?.length || 0) + (reviewData.blocked?.length || 0);
      toast.success(`Imported ${result.imported} ready records!${pendingCount > 0 ? ` ${pendingCount} review/blocked records are in Pending Review.` : ''}`);
      localStorage.removeItem(DRAFT_KEY);
      setTimeout(() => navigate('/ats'), 2000);
    } catch (error) { toast.error('Import error: ' + error.message); }
    finally { setIsImporting(false); }
  };

  const handleSaveEditedRecord = async () => {
    if (!editingRow) return;
    try {
      const recordData = editingRow.fixed || editingRow.original || editingRow;
      const candidateName = recordData.name || 'Candidate';
      const rowIndexToRemove = editingRow.rowIndex;
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/import-reviewed`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readyRecords: [recordData], reviewRecords: [] })
      });
      if (!response.ok) throw new Error('Failed to import');
      await response.json();
      setEditingRow(null);
      setReviewData(prev => {
        if (!prev) return prev;
        const filterRecord = (r) => r.rowIndex !== rowIndexToRemove;
        return { ...prev, ready: prev.ready.filter(filterRecord), review: prev.review.filter(filterRecord), blocked: prev.blocked.filter(filterRecord) };
      });
      setImportConfirmation({ candidateName, show: true });
    } catch (error) { toast.error('Import error: ' + error.message); }
  };

  const handleRevalidateRecord = async (row) => {
    try {
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/revalidate-record`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: row.fixed || row.original })
      });
      const data = await response.json();
      if (data.success && data.result) {
        setEditingRow(prev => ({ ...prev, validation: data.result.validation, fixed: data.result.fixed }));
        toast.success('Re-validation complete');
      }
    } catch { toast.error('Re-validation failed'); }
  };

  const handleReset = () => {
    setConfirmModal({
      isOpen: true, type: 'delete',
      title: 'Clear Draft',
      message: 'Are you sure you want to clear this import draft? Review/Blocked records are already saved in Pending Review.',
      confirmText: 'Clear Draft',
      onConfirm: () => {
        setReviewData(null); setStats(null); setEditingRow(null); setFileName(''); setCurrentPage(1); setSearchQuery('');
        localStorage.removeItem(DRAFT_KEY);
        setConfirmModal({ isOpen: false });
      }
    });
  };

  // Get original value for a field (from the raw Excel row)
  const getOriginalValue = (row, field) => {
    if (!row?.original) return null;
    const original = row.original;
    // Try to find the closest matching key in original data
    const fieldMappings = {
      name: ['name', 'candidate', 'candidate name', 'full name', 'fls', 'non fls', 'non-fls'],
      email: ['email', 'e-mail', 'mail', 'mail id', 'email address', 'email id'],
      contact: ['contact', 'phone', 'mobile', 'number', 'contact no', 'mobile no', 'cell'],
      position: ['position', 'designation', 'role', 'job title', 'title', 'profile'],
      companyName: ['company', 'company name', 'current company', 'employer', 'organization'],
      ctc: ['ctc', 'current ctc', 'salary', 'current salary', 'c.t.c'],
      expectedCtc: ['expected', 'expected ctc', 'expected salary', 'desired', 'e.ctc', 'ectc'],
      experience: ['experience', 'exp', 'years', 'total exp', 'work exp'],
      noticePeriod: ['notice', 'notice period', 'np', 'availability'],
      location: ['location', 'city', 'place', 'area', 'base location'],
      status: ['status', 'candidate status', 'stage', 'result'],
      source: ['source', 'source of cv', 'cv source'],
      client: ['client', 'client name', 'project', 'bank', 'mapping'],
      spoc: ['spoc', 'hr', 'poc', 'recruiter'],
      remark: ['remark', 'remarks', 'notes', 'feedback', 'comment'],
    };
    const keys = fieldMappings[field] || [field];
    for (const key of keys) {
      for (const [origKey, origVal] of Object.entries(original)) {
        if (origKey.toLowerCase().trim() === key.toLowerCase()) {
          return origVal || null;
        }
      }
    }
    return null;
  };

  const categoryBadge = (cat) => {
    if (cat === 'ready') return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">Ready</span>;
    if (cat === 'review') return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">Review</span>;
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">Blocked</span>;
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/ats')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FileSpreadsheet size={20} className="text-blue-600" />
                  Auto Import Candidates
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">Upload Excel/CSV with smart validation and review before import</p>
              </div>
            </div>
            {reviewData && (
              <button onClick={handleReset} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Upload size={14} /> New File
              </button>
            )}
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-6 py-5">
          {/* UPLOAD SECTION */}
          {!reviewData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                  <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : isUploading ? 'border-gray-300 bg-gray-50 cursor-wait' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'}`}>
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
                        <Loader2 size={48} className="text-blue-600 animate-spin" />
                        <div className="text-center w-full">
                          <p className="text-lg font-bold text-gray-900">{uploadProgress}</p>
                          <p className="text-sm text-gray-500 mt-1">{fileName}</p>
                          <div className="mt-4 w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${uploadPercent}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1.5">
                            {uploadPercent <= 30 ? 'Step 1/3: Uploading' : uploadPercent <= 95 ? 'Step 2/3: Validating rows' : 'Step 3/3: Finalizing'} — {uploadPercent}% overall
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Upload size={48} className="mx-auto text-blue-500 mb-4" />
                        <p className="text-lg font-bold text-gray-900 mb-1">Drop your file here or click to browse</p>
                        <p className="text-sm text-gray-500 mb-4">Supports CSV, XLSX, XLS (max 50 MB)</p>
                        <p className="text-xs text-amber-600 mt-2">Large files (15k+ rows) may take a few minutes. Free hosting tiers can timeout — split into smaller batches if needed.</p>
                        <button className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                          <Upload size={18} /> Select File
                        </button>
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />

                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 mb-3">How it works:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      {[{ step: '1', title: 'Upload', desc: 'Select your Excel/CSV file' }, { step: '2', title: 'Validate', desc: 'System checks every row' }, { step: '3', title: 'Review', desc: 'Fix any issues found' }, { step: '4', title: 'Import', desc: 'Save to database' }].map(s => (
                        <div key={s.step} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{s.step}</div>
                          <div><p className="text-sm font-semibold text-gray-900">{s.title}</p><p className="text-xs text-gray-500">{s.desc}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 text-sm mb-3">Validation Rules</h3>
                  <div className="space-y-2 text-xs text-gray-600">
                    <p><span className="font-bold text-green-700">Ready (80%+):</span> Name + Email + Phone present and valid</p>
                    <p><span className="font-bold text-amber-700">Review (50-79%):</span> Some required fields missing or warnings</p>
                    <p><span className="font-bold text-red-700">Blocked (&lt;50%):</span> Critical errors (no name, invalid email, etc.)</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 text-sm mb-3">100% Accuracy Fields</h3>
                  <div className="space-y-2 text-xs text-gray-600">
                    <p><span className="font-bold text-blue-700">Email:</span> Anything with @ symbol</p>
                    <p><span className="font-bold text-blue-700">Phone:</span> 10-digit number starting with 6-9</p>
                    <p><span className="font-bold text-blue-700">Notice Period:</span> Numbers like 0, 15, 30, 60, 90</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 text-sm mb-3">Smart Features</h3>
                  <div className="space-y-2 text-xs text-gray-600">
                    <p><ArrowRightLeft size={12} className="inline text-blue-600 mr-1" /> Auto-swaps misplaced fields</p>
                    <p><ShieldCheck size={12} className="inline text-green-600 mr-1" /> Email domain typo correction</p>
                    <p><Search size={12} className="inline text-purple-600 mr-1" /> Duplicate detection</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DRAFT RESTORED BANNER */}
          {draftRestored && reviewData && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
              <RefreshCw size={16} className="text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-800 flex-1">
                <span className="font-semibold">Draft restored</span> from your previous session ({fileName}). You can continue reviewing or upload a new file.
              </p>
              <button onClick={() => setDraftRestored(false)} className="p-1 hover:bg-blue-100 rounded-lg transition-colors"><X size={14} className="text-blue-600" /></button>
            </div>
          )}

          {/* REVIEW SECTION */}
          {reviewData && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {/* Stats Bar */}
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <p className="text-sm font-semibold text-gray-900"><FileText size={14} className="inline mr-1 text-blue-600" />{fileName}</p>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-green-700 font-semibold"><CheckCircle size={12} /> {stats?.ready || 0} Ready</span>
                    <span className="flex items-center gap-1 text-amber-700 font-semibold"><AlertTriangle size={12} /> {stats?.review || 0} Review</span>
                    <span className="flex items-center gap-1 text-red-700 font-semibold"><AlertCircle size={12} /> {stats?.blocked || 0} Blocked</span>
                    {stats?.dbDuplicates > 0 && <span className="text-blue-600 font-medium">{stats.dbDuplicates} existing in DB</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowOriginals(!showOriginals)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${showOriginals ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    {showOriginals ? <EyeOff size={12} /> : <Eye size={12} />}
                    {showOriginals ? 'Hide' : 'Show'} Original Values
                  </button>
                  <button onClick={handleImportAll} disabled={isImporting || (reviewData.ready?.length || 0) === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {isImporting ? 'Importing...' : `Import ${reviewData.ready?.length || 0} Ready Records`}
                  </button>
                </div>
              </div>

              {/* Tabs + Search */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
                <div className="flex gap-2">
                  {[
                    { key: 'ready', label: 'Ready', count: reviewData.ready?.length || 0 },
                    { key: 'review', label: 'Needs Review', count: reviewData.review?.length || 0 },
                    { key: 'blocked', label: 'Blocked', count: reviewData.blocked?.length || 0 }
                  ].map(tab => (
                    <button key={tab.key} onClick={() => handleFilterChange(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${reviewFilter === tab.key && !searchQuery ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={searchQuery} onChange={handleSearchChange}
                    placeholder="Search across all records..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg w-64 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                  {searchQuery && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-600 font-medium">{filteredRecords.length} found</span>}
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                {paginatedRecords.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <FileText size={36} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-sm font-medium">{searchQuery ? 'No matching records found' : 'No records in this category'}</p>
                  </div>
                ) : (
                  <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {['#', 'Name', 'Email', 'Contact', 'Position', 'Company', 'CTC', 'Exp CTC', 'Location', 'Exp', 'NP', 'Status', 'Source', 'SPOC', 'Remark', ...(searchQuery ? ['Cat.'] : []), 'Confidence', 'Actions'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedRecords.map((row, idx) => {
                        const f = row.fixed || {};
                        const cat = row._category || row.validation?.category;
                        return (
                          <React.Fragment key={`${row.rowIndex}-${idx}`}>
                            <tr className={`hover:bg-gray-50/60 transition ${cat === 'ready' ? 'bg-green-50/20' : cat === 'review' ? 'bg-amber-50/20' : 'bg-red-50/20'}`}>
                              <td className="px-3 py-2 text-gray-400 font-mono">{row.rowIndex || '-'}</td>
                              <td className="px-3 py-2 font-semibold text-gray-900 max-w-[140px] truncate">{f.name || '-'}</td>
                              <td className="px-3 py-2 text-gray-600 max-w-[180px] truncate">{f.email || '-'}</td>
                              <td className="px-3 py-2 text-gray-600">{f.contact || f.phone || '-'}</td>
                              <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">{f.position || '-'}</td>
                              <td className="px-3 py-2 text-gray-600 max-w-[130px] truncate">{f.companyName || f.company || '-'}</td>
                              <td className="px-3 py-2 text-gray-600">{f.ctc ? `${f.ctc} LPA` : '-'}</td>
                              <td className="px-3 py-2 text-gray-600">{f.expectedCtc ? `${f.expectedCtc} LPA` : '-'}</td>
                              <td className="px-3 py-2 text-gray-600 max-w-[100px] truncate">{f.location || '-'}</td>
                              <td className="px-3 py-2 text-gray-600">{f.experience != null && f.experience !== '' ? `${f.experience}y` : '-'}</td>
                              <td className="px-3 py-2 text-gray-600">{f.noticePeriod != null && f.noticePeriod !== '' ? `${f.noticePeriod}d` : '-'}</td>
                              <td className="px-3 py-2 text-gray-600 max-w-[80px] truncate">{f.status || '-'}</td>
                              <td className="px-3 py-2 text-gray-600 max-w-[80px] truncate">{f.source || '-'}</td>
                              <td className="px-3 py-2 text-gray-600 max-w-[80px] truncate">{f.spoc || '-'}</td>
                              <td className="px-3 py-2 text-gray-600 max-w-[100px] truncate">{f.remark || '-'}</td>
                              {searchQuery && <td className="px-3 py-2">{categoryBadge(cat)}</td>}
                              <td className="px-3 py-2">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${(row.validation?.confidence || 0) >= 80 ? 'bg-green-100 text-green-800' : (row.validation?.confidence || 0) >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                                  {row.validation?.confidence || 0}%
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <button onClick={() => setEditingRow(row)} className="flex items-center gap-1 px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium">
                                  <Edit2 size={10} /> Edit
                                </button>
                              </td>
                            </tr>
                            {/* Original values row */}
                            {showOriginals && (
                              <tr className="bg-slate-50/80 border-b border-slate-100">
                                <td className="px-3 py-1.5 text-[10px] text-slate-400 font-medium">orig</td>
                                {['name', 'email', 'contact', 'position', 'companyName', 'ctc', 'expectedCtc', 'location', 'experience', 'noticePeriod', 'status', 'source', 'spoc', 'remark'].map(field => {
                                  const origVal = getOriginalValue(row, field);
                                  const fixedVal = String(f[field] || '');
                                  const isDifferent = origVal && fixedVal && origVal.toLowerCase().trim() !== fixedVal.toLowerCase().trim();
                                  return (
                                    <td key={field} className={`px-3 py-1.5 text-[10px] max-w-[140px] truncate ${isDifferent ? 'text-orange-600 font-medium' : 'text-slate-400'}`}>
                                      {origVal || '-'}
                                    </td>
                                  );
                                })}
                                {searchQuery && <td></td>}
                                <td></td>
                                <td></td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    Showing {((currentPage - 1) * RECORDS_PER_PAGE) + 1}-{Math.min(currentPage * RECORDS_PER_PAGE, filteredRecords.length)} of {filteredRecords.length} records
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                      className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">First</button>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                      className="p-1 text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft size={14} /></button>

                    {/* Page numbers */}
                    {(() => {
                      const pages = [];
                      let start = Math.max(1, currentPage - 2);
                      let end = Math.min(totalPages, start + 4);
                      if (end - start < 4) start = Math.max(1, end - 4);
                      for (let i = start; i <= end; i++) {
                        pages.push(
                          <button key={i} onClick={() => setCurrentPage(i)}
                            className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${i === currentPage ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                            {i}
                          </button>
                        );
                      }
                      return pages;
                    })()}

                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                      className="p-1 text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronRight size={14} /></button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                      className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Last</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* EDIT RECORD MODAL */}
        {editingRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h3 className="text-lg font-bold text-gray-900">Edit Record - Row {editingRow.rowIndex}</h3>
                <button onClick={() => setEditingRow(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X size={18} className="text-gray-500" /></button>
              </div>

              <div className="p-6">
                {/* Field editor with original values */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                  {[
                    { field: 'name', label: 'Name' }, { field: 'email', label: 'Email' }, { field: 'contact', label: 'Contact' },
                    { field: 'position', label: 'Position' }, { field: 'experience', label: 'Experience' }, { field: 'ctc', label: 'CTC (LPA)' },
                    { field: 'expectedCtc', label: 'Expected CTC' }, { field: 'noticePeriod', label: 'Notice Period' }, { field: 'companyName', label: 'Company' },
                    { field: 'location', label: 'Location' }, { field: 'client', label: 'Client' }, { field: 'source', label: 'Source' },
                    { field: 'spoc', label: 'SPOC' }, { field: 'date', label: 'Date', type: 'date' }, { field: 'status', label: 'Status', type: 'select' },
                    { field: 'remark', label: 'Remark' }
                  ].map(({ field, label, type }) => {
                    const origVal = getOriginalValue(editingRow, field);
                    const fixedVal = editingRow.fixed?.[field] || '';
                    const origStr = origVal ? String(origVal).trim() : '';
                    const fixedStr = String(fixedVal).trim();
                    const isDifferent = origStr && fixedStr && origStr.toLowerCase() !== fixedStr.toLowerCase();
                    const hasOriginal = origStr && origStr !== '-';
                    return (
                      <div key={field}>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                          {label}
                          {isDifferent && (
                            <span className="text-orange-500 normal-case font-medium ml-1">(was: {origStr.substring(0, 30)})</span>
                          )}
                        </label>
                        {type === 'select' ? (
                          <select value={fixedVal} onChange={(e) => setEditingRow(prev => ({ ...prev, fixed: { ...prev.fixed, [field]: e.target.value } }))}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${isDifferent ? 'border-orange-300 bg-orange-50/30' : 'border-gray-300'}`}>
                            <option value="">Select Status</option>
                            {['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined', 'Rejected', 'Dropped', 'Hold', 'Interested', 'Interested and scheduled'].map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        ) : (
                          <input type={type || 'text'} value={fixedVal} onChange={(e) => setEditingRow(prev => ({ ...prev, fixed: { ...prev.fixed, [field]: e.target.value } }))}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${isDifferent ? 'border-orange-300 bg-orange-50/30' : 'border-gray-300'}`} />
                        )}
                        {hasOriginal && !isDifferent && fixedStr && (
                          <p className="text-[9px] text-gray-400 mt-0.5">Original: {origStr.substring(0, 40)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Original raw data panel */}
                {editingRow.original && Object.keys(editingRow.original).length > 0 && (
                  <div className="mb-5 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs font-bold text-slate-700 mb-2">Original Excel Row Data:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(editingRow.original).filter(([k, v]) => v && String(v).trim() !== '' && String(v).trim() !== '-').map(([key, value]) => (
                        <div key={key} className="text-[11px]">
                          <span className="text-slate-500 font-medium">{key}:</span>{' '}
                          <span className="text-slate-800">{String(value).substring(0, 50)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Validation Summary */}
                {editingRow.validation && (editingRow.validation.errors?.length > 0 || editingRow.validation.warnings?.length > 0) && (
                  <div className="mb-5 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    {editingRow.validation.errors?.length > 0 && (
                      <div className="mb-2">
                        <p className="font-bold text-red-700 text-xs mb-1">Errors:</p>
                        {editingRow.validation.errors.map((e, i) => <p key={i} className="text-xs text-red-600"><AlertCircle size={10} className="inline mr-1" />{e.field}: {e.message}</p>)}
                      </div>
                    )}
                    {editingRow.validation.warnings?.length > 0 && (
                      <div>
                        <p className="font-bold text-amber-700 text-xs mb-1">Warnings:</p>
                        {editingRow.validation.warnings.map((w, i) => <p key={i} className="text-xs text-amber-600"><AlertTriangle size={10} className="inline mr-1" />{w.field}: {w.message}</p>)}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={handleSaveEditedRecord} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"><Save size={16} /> Save & Import</button>
                  <button onClick={() => handleRevalidateRecord(editingRow)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"><RefreshCw size={16} /> Re-validate</button>
                  <button onClick={() => setEditingRow(null)} className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Import Success */}
        {importConfirmation?.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3"><CheckCircle size={24} className="text-green-600" /></div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Imported Successfully</h3>
              <p className="text-sm text-gray-600 mb-4"><strong>{importConfirmation.candidateName}</strong> has been saved to the database.</p>
              <button onClick={() => { setImportConfirmation(null); setReviewFilter('ready'); }} className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">Continue</button>
            </div>
          </div>
        )}

        {/* Navigation warning modal - shown when user tries to leave with unsaved import data */}
        {blocker.state === 'blocked' && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={24} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Unsaved Import Data</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    You have unsaved import data. If you leave now, your data will be lost and you will need to upload the file again.
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    Your draft may be restored if you return to this page in a new session.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => blocker.reset?.()}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Stay
                    </button>
                    <button
                      onClick={() => blocker.proceed?.()}
                      className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Leave
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <ConfirmationModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} onConfirm={confirmModal.onConfirm || (() => {})} title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} type={confirmModal.type} isLoading={isImporting} />
      </div>
    </Layout>
  );
};

export default AutoImportPage;
