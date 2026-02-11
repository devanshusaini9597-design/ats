
import React, { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { 
  Plus, Search, Mail, MessageCircle,Upload, 
  Filter, CheckSquare, Square, FileText, Cpu, Trash2, Edit, X, Briefcase,BarChart3, AlertCircle, RefreshCw, Download 
} from 'lucide-react';
import { useParsing } from '../hooks/useParsing';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { useNavigate } from 'react-router-dom';
import BASE_API_URL from '../config';
import ColumnMapper from './ColumnMapper';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';


const ATS = forwardRef((props, ref) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const autoUploadInputRef = useRef(null);
  const { onImportComplete } = props || {};


  const API_URL = `${BASE_API_URL}/candidates`;
// Pehle: const API_URL = 'http://localhost:5000/candidates';
// const API_URL = 'http://localhost:5000/api/candidates';  
  const JOBS_URL = `${BASE_API_URL}/jobs`;
  const BULK_UPLOAD_URL = `${BASE_API_URL}/candidates/bulk-upload`;

  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterJob, setFilterJob] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [parsedResults, setParsedResults] = useState([]); 
  const [showPreview, setShowPreview] = useState(false); 
  const [isAutoParsing, setIsAutoParsing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isHeaderLoading, setIsHeaderLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isShowingAll, setIsShowingAll] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState(null);
  const [emailType, setEmailType] = useState('interview');
  const [customMessage, setCustomMessage] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailCC, setEmailCC] = useState('');
  const [emailBCC, setEmailBCC] = useState('');
  
  // Bulk Email Workflow States
  const [bulkEmailStep, setBulkEmailStep] = useState(null); // null, 'select', 'confirm', 'sending', 'results'
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [campaignStatus, setCampaignStatus] = useState(null);
  const [emailStatuses, setEmailStatuses] = useState({});
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [duplicateRecords, setDuplicateRecords] = useState([]);
  const [showCorrectionsModal, setShowCorrectionsModal] = useState(false);
  const [correctionRecords, setCorrectionRecords] = useState([]);
  const [showOnlyCorrect, setShowOnlyCorrect] = useState(true); // ✅ DEFAULT: Show ONLY properly filled records
  const [totalRecordsInDB, setTotalRecordsInDB] = useState(0);

  // ✅ NEW: Review & Fix Workflow
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [reviewFilter, setReviewFilter] = useState('all'); // 'all', 'review', 'blocked'
  const [importConfirmation, setImportConfirmation] = useState(null); // {candidateName, show: true}

  // ✅ Advanced Search Panel (inline, above table)
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [advancedSearchFilters, setAdvancedSearchFilters] = useState({
    position: '',
    companyName: '',
    location: '',
    expMin: '',
    expMax: '',
    ctcMin: '',
    ctcMax: '',
    expectedCtcMin: '',
    expectedCtcMax: '',
    date: ''
  });

 const initialFormState = {
    srNo: '', date: new Date().toISOString().split('T')[0], location: '', position: '',
    fls: '', name: '', contact: '', email: '', companyName: '', experience: '',
    ctc: '', expectedCtc: '', noticePeriod: '', status: 'Applied', client: '',
    spoc: '', source: '', resume: null, callBackDate: ''
};
  const [formData, setFormData] = useState(initialFormState);

  // --- Data Fetch Logic (with pagination + server-side search) ---
  const fetchData = async (page = 1, options = {}) => {
    try {
      setIsLoadingInitial(true);
      const search = (options.search || '').trim();
      const position = (options.position || '').trim();
      const isSearch = Boolean(search || position);
      
      // ✅ FETCH ALL DATA: When showing only correct, fetch everything (12000 covers all data)
      // Filter on frontend, then paginate to show 50 at a time
      const limit = (showOnlyCorrect && !isSearch) ? 12000 : 100;
      
      setIsLoadingMore(page > 1 && !isSearch);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit)
      });
      if (search) params.append('search', search);
      if (position) params.append('position', position);

      const res = await authenticatedFetch(`${API_URL}?${params.toString()}`);
      
      if (isUnauthorized(res)) {
        handleUnauthorized();
        return;
      }
      
      const response = await res.json();
      console.log('🔍 API Response - isSearch:', isSearch, 'limit:', limit, 'page:', page);
      console.log('🔍 API Response received:', response);
      
      // Handle both paginated and raw array formats
      let candidatesData = [];
      let pages = 1;
      
      if (response.success && response.data && Array.isArray(response.data)) {
        candidatesData = response.data;
        pages = response.pagination?.totalPages || 1;
        const total = response.pagination?.totalCount || 0;
        setTotalPages(pages);
        setTotalRecordsInDB(total);
        console.log('✅ Fetched', candidatesData.length, 'candidates from page', page, 'totalPages:', pages, 'Total in DB:', total);
      } else if (Array.isArray(response)) {
        candidatesData = response;
        setTotalPages(1);
        setTotalRecordsInDB(candidatesData.length);
        console.log('✅ Fetched', candidatesData.length, 'candidates (direct array)');
      }
      
      if (page === 1) {
        setCandidates(candidatesData);
      } else {
        setCandidates(prev => [...prev, ...candidatesData]);
      }
      setCurrentPage(page);

      const jobRes = await authenticatedFetch(`${JOBS_URL}?isTemplate=false`);
      
      if (isUnauthorized(jobRes)) {
        handleUnauthorized();
        return;
      }
      
      const jobData = await jobRes.json();
      setJobs(jobData);
    } catch (error) { 
      console.error("Error fetching data:", error); 
      setCandidates([]);
    } finally {
      setIsLoadingMore(false);
      setIsLoadingInitial(false);
    }
  };

  // ✅ Expose methods to parent via ref
  useImperativeHandle(ref, () => {
    console.log('📤 useImperativeHandle called - exposing ATS methods');
    return {
      triggerAutoImport: () => {
        console.log('🎬 triggerAutoImport called');
        console.log('👉 autoUploadInputRef.current:', autoUploadInputRef.current);
        autoUploadInputRef.current?.click();
      },
      openAddCandidateModal: () => {
        console.log('🎬 openAddCandidateModal called');
        setEditId(null);
        setFormData(initialFormState);
        setShowModal(true);
      },
      refreshCandidates: () => {
        console.log('🔄 refreshCandidates called');
        fetchData(1, { search: '', position: '' });
      },
      autoUploadInputRef: autoUploadInputRef,
      fileInputRef: fileInputRef
    };
  });

  // ✅ INITIAL DATA LOAD - Fire once on component mount
  useEffect(() => {
    console.log('🔄 ATS Component mounted - fetching initial data...');
    fetchData(1, { search: '', position: '' });
  }, []); // Empty dependency = mount only

  // ✅ SEARCH/FILTER CHANGES - Re-fetch when search or filters change
  useEffect(() => {
    console.log('🔍 Search/filter changed - re-fetching data');
    fetchData(1, { search: searchQuery, position: filterJob });
  }, [searchQuery, filterJob, isShowingAll, showOnlyCorrect]);

  // ✅ MONITOR REVIEW DATA - When confirmation closes, ensure UI refreshes
  useEffect(() => {
    if (importConfirmation?.show === false || importConfirmation === null) {
      // Force a re-render by accessing current reviewData
      console.log('🔄 Refreshing tab display - confirmation closed');
      console.log('📊 Current Ready:', reviewData?.ready?.length || 0);
      console.log('📊 Current Review:', reviewData?.review?.length || 0);
      console.log('📊 Current Blocked:', reviewData?.blocked?.length || 0);
    }
  }, [importConfirmation]);

  // ✅ REVIEW DATA CHANGES - Log updates to track filtering
  useEffect(() => {
    if (reviewData) {
      console.log('✨ ReviewData Updated:', {
        ready: reviewData.ready?.length || 0,
        review: reviewData.review?.length || 0,
        blocked: reviewData.blocked?.length || 0
      });
    }
  }, [reviewData]);



const handleBulkUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
    setIsHeaderLoading(true);
        // Send file to backend to extract headers
        const formData = new FormData();
        formData.append('file', file);

        const res = await authenticatedFetch(`${BASE_API_URL}/candidates/extract-headers`, {
            method: 'POST',
            body: formData
        });

        if (isUnauthorized(res)) {
          handleUnauthorized();
          return;
        }

        const data = await res.json();
        if (!res.ok || !data.success) {
            alert("❌ Error reading Excel: " + (data.message || 'Unknown error'));
            event.target.value = null;
            return;
        }

        setExcelHeaders(data.headers);
        setPendingFile(file);
        setShowColumnMapper(true);
        event.target.value = null;
    } catch (error) {
        console.error("Error reading Excel:", error);
        alert("❌ Error reading Excel file. Please try again.");
        event.target.value = null;
      } finally {
        setIsHeaderLoading(false);
    }
};

// 🔥 NEW: Auto-upload without column mapping (reads Excel headers automatically)
const handleAutoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const confirm = window.confirm("⚡ REVIEW & IMPORT MODE\n\nSystem will validate Excel data and show you:\n• ✅ Ready records (auto-import)\n• ⚠️  Results needing review (manual fix)\n• ❌ Blocked records (need corrections)\n\nYou can edit and fix issues before importing.\n\nProceed?");
    if (!confirm) {
        event.target.value = null;
        return;
    }

    try {
        setIsUploading(true);
        
        const uploadData = new FormData();
        uploadData.append('file', file);
        // NO columnMapping - backend will auto-detect!
        
        console.log('📤 Uploading file:', file.name);
        const response = await authenticatedFetch(`${BASE_API_URL}/candidates/bulk-upload-auto`, {
            method: 'POST',
            body: uploadData
        });

        console.log('📦 Response status:', response.status, 'ok:', response.ok);

        if (isUnauthorized(response)) {
          handleUnauthorized();
          setIsUploading(false);
          return;
        }
        
        if (!response.ok) {
          let errorMessage = 'Upload failed';
          try {
            const errorText = await response.text();
            console.error('❌ Error response text:', errorText);
            if (errorText) {
              try {
                const parsed = JSON.parse(errorText);
                if (parsed?.message) errorMessage = parsed.message;
              } catch {
                errorMessage = errorText.substring(0, 100);
              }
            }
          } catch (e) {
            console.error('Error reading response:', e);
          }
          throw new Error(`${errorMessage} (HTTP ${response.status})`);
        }

        // ✅ Parse response with error handling
        let data;
        try {
          // Read as text first to handle NDJSON format
          const responseText = await response.text();
          console.log('📝 Raw response (first 500 chars):', responseText.substring(0, 500));
          
          if (!responseText || responseText === '') {
            throw new Error('Empty response from server');
          }
          
          // Split by newlines to handle NDJSON format
          const lines = responseText.trim().split('\n').filter(line => line.trim());
          
          if (lines.length === 0) {
            throw new Error('No JSON lines in response');
          }
          
          // Find the "complete" message (last object in NDJSON stream)
          let completeMessage = null;
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === 'complete' || parsed.success) {
                completeMessage = parsed;
                break; // Found it, stop looking
              }
            } catch (e) {
              // Skip invalid lines
              continue;
            }
          }
          
          // If no complete message found, use the last valid JSON
          if (!completeMessage) {
            for (let i = lines.length - 1; i >= 0; i--) {
              try {
                completeMessage = JSON.parse(lines[i]);
                break;
              } catch (e) {
                continue;
              }
            }
          }
          
          if (!completeMessage) {
            throw new Error('Could not parse any valid JSON from response');
          }
          
          data = completeMessage;
          console.log('✅ Parsed complete message:', data);
        } catch (parseError) {
          console.error('❌ Parse error:', parseError);
          console.error('Response status:', response.status, response.statusText);
          throw new Error('Invalid response format: ' + parseError.message);
        }
        
        console.log('✅ Parsed data:', data);

        if (data.success && data.results) {
            // ✅ Show review modal with categorized results
            setReviewData(data.results);
            setReviewFilter('ready'); // Default to Ready tab
            setEditingRow(null);
            setShowReviewModal(true);
            
            console.log(`📊 Validation Complete: ${data.stats.ready} ready, ${data.stats.review} review, ${data.stats.blocked} blocked`);
            alert(`✅ VALIDATION COMPLETE!\n\n✅ Ready: ${data.stats.ready}\n⚠️  Need Review: ${data.stats.review}\n❌ Blocked: ${data.stats.blocked}\n\nReview and fix data in the modal.`);
        } else if (data.success && data.imported) {
            // ❌ Older backend version still running - it auto-imported instead of returning results
            alert(`⚠️  Backend version mismatch!\n\nThe backend is still running the old auto-import code.\n\n📍 SOLUTION:\n1. Close/stop the backend terminal\n2. Restart: cd backend && node server.js\n3. Try upload again\n\nImported ${data.imported} records. Will show review modal after restart.`);
            setIsUploading(false);
            return;
        } else {
            throw new Error(data.message || 'Failed to process file - check if backend was restarted');
        }

        setIsUploading(false);
    } catch (error) {
        console.error("❌ Auto Upload Error:", error);
        alert("❌ Error: " + error.message);
        setIsUploading(false);
    } finally {
        event.target.value = null;
    }
};

const handleUploadWithMapping = async (mapping) => {
    if (!pendingFile) return;
    const file = pendingFile;

    try {
        setIsUploading(true);
        console.log("📤 Sending mapping to backend:", mapping);
        console.log("📤 Mapping keys:", Object.keys(mapping || {}));
        console.log("📤 Mapping values:", Object.values(mapping || {}));
        console.log("📄 File selected:", {
          name: file?.name,
          type: file?.type,
          size: file?.size
        });
        const uploadData = new FormData();
        uploadData.append('file', file);
        uploadData.append('columnMapping', JSON.stringify(mapping));

        console.log("📦 FormData prepared with file and mapping");
        console.log("📦 columnMapping JSON:", JSON.stringify(mapping));
        console.log("📦 FormData entries:");
        for (const pair of uploadData.entries()) {
          console.log(`   - ${pair[0]}:`, pair[1]);
        }
        
        // Use fetch to handle streaming response
        const response = await fetch(`${BULK_UPLOAD_URL}`, {
            method: 'POST',
            body: uploadData,
            headers: { 'Accept': 'application/x-ndjson' }
        });
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }

        // Read streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let isComplete = false;
        let buffer = ''; // Buffer for incomplete lines

        while (!isComplete) {
            const { done, value } = await reader.read();
            if (done) {
                // Process any remaining buffer
                if (buffer.trim()) {
                    try {
                        const msg = JSON.parse(buffer);
                        if (msg.type === 'complete') isComplete = true;
                    } catch (e) {
                        console.error('Final buffer parse error:', e.message, 'buffer:', buffer.substring(0, 100));
                    }
                }
                break;
            }

            // Append to buffer
            buffer += decoder.decode(value, { stream: true });
            
            // Split by newlines but keep incomplete lines in buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last incomplete line

            for (const line of lines) {
                if (!line.trim()) continue;
                
                try {
                    const msg = JSON.parse(line);

                    if (msg.type === 'progress') {
                      const percent = ((msg.processed / msg.total) * 100).toFixed(1);
                      console.log(`⏳ Progress: ${msg.processed}/${msg.total} (${percent}%) - ${new Date().toLocaleTimeString()}`);
                    } else if (msg.type === 'complete') {
                      // Just import silently - no duplicate modals
                      setTimeout(() => {
                        fetchData(1, { search: '', position: '' });
                      }, 500);
                      
                      const duplicateCount = (msg.duplicatesInFile || 0) + (msg.duplicatesInDB || 0);
                      
                      // Show simple success message
                      alert(`✅ UPLOAD COMPLETE!\n\n✅ Imported: ${msg.totalProcessed} candidates\n⚠️  Duplicates Removed: ${duplicateCount}\n\n📌 Records now available in table.`);
                    } else if (msg.type === 'error') {
                        alert(`❌ Error: ${msg.message}`);
                        setIsUploading(false);
                    }
                } catch (e) {
                    console.error('Parse error for line:', e.message);
                    // Log the problematic line for debugging
                    if (line.length > 0 && line.length < 200) {
                        console.error('Problematic line:', line);
                    } else if (line.length > 0) {
                        console.error('Problematic line (truncated):', line.substring(0, 100), '...');
                    }
                }
            }
        }
    } catch (error) {
        console.error("Bulk Upload Error:", error);
        alert("❌ Error: " + error.message);
        setIsUploading(false);
    } finally {
        setShowColumnMapper(false);
        setPendingFile(null);
        setColumnMapping(null);
    }
};

// Iske niche ka ye useParsing wala part MATH HATANA, isse rehne dena
const { selectedIds, isParsing, toggleSelection, selectAll, handleBulkParse } = useParsing(async () => {
  await fetchData(1, { search: searchQuery, position: filterJob });
    const res = await authenticatedFetch(API_URL);
    
    if (isUnauthorized(res)) {
      handleUnauthorized();
      return;
    }
    
    const latestData = await res.json();
    const newlyParsed = latestData.filter(c => selectedIds.includes(c._id));
    setParsedResults(newlyParsed);
    setShowPreview(true);
});

  /* ================= NEW BULK COMMUNICATION LOGIC ================= */

  // ✅ BULK EMAIL: Integrated with AWS SES
  const handleBulkEmail = async () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one candidate.');
      return;
    }

    const selectedCandidates = candidates.filter(c => selectedIds.includes(c._id));
    const validCandidates = selectedCandidates.filter(c => c.email && c.email.includes('@'));

    if (validCandidates.length === 0) {
      alert('❌ No valid email addresses found in selected candidates.');
      return;
    }

    const emailTypeChoice = prompt(
      `📧 Send Bulk Email to ${validCandidates.length} candidates\n\n` +
      `Select email type:\n` +
      `1 - Interview Invitation\n` +
      `2 - Rejection Letter\n` +
      `3 - Document Request\n` +
      `4 - Onboarding\n` +
      `5 - Custom Message\n\n` +
      `Enter number (1-5):`
    );

    if (!emailTypeChoice) return;

    const typeMap = {
      '1': 'interview',
      '2': 'rejection',
      '3': 'document',
      '4': 'onboarding',
      '5': 'custom'
    };

    const selectedType = typeMap[emailTypeChoice];

    if (!selectedType) {
      alert('❌ Invalid choice!');
      return;
    }

    let customMsg = '';
    if (selectedType === 'custom') {
      customMsg = prompt('Enter your custom message:');
      if (!customMsg) return;
    }

    if (!window.confirm(`Send ${selectedType} emails to ${validCandidates.length} candidates?`)) {
      return;
    }

    try {
      setIsUploading(true);

      const response = await authenticatedFetch(`${BASE_API_URL}/api/email/send-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: validCandidates.map(c => ({
            email: c.email,
            name: c.name,
            position: c.position,
            department: c.department || 'N/A',
            joiningDate: c.joiningDate || 'TBD'
          })),
          emailType: selectedType,
          customMessage: customMsg
        })
      });

      if (isUnauthorized(response)) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (data.success) {
        alert(
          `✅ Bulk Email Campaign Completed!\n\n` +
          `Total: ${data.data.total}\n` +
          `Sent: ${data.data.sent}\n` +
          `Failed: ${data.data.failed}\n` +
          `Success Rate: ${data.data.successRate}`
        );
        setSelectedIds([]);
      } else {
        alert(`❌ Failed to send bulk emails: ${data.message}`);
      }
    } catch (error) {
      console.error('Bulk email error:', error);
      alert('❌ Failed to send bulk emails. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // ===================== BULK EMAIL WORKFLOW FUNCTIONS =====================
  
  // Start bulk email workflow
  const startBulkEmailFlow = () => {
    if (selectedIds.length === 0) {
      alert('⚠️ Please select at least one candidate!');
      return;
    }
    
    const selected = candidates.filter(c => selectedIds.includes(c._id));
    const validCandidates = selected.filter(c => c.email);
    
    if (validCandidates.length === 0) {
      alert('⚠️ No valid email addresses found in selected candidates!');
      return;
    }
    
    // Initialize selected emails
    const emails = new Set(validCandidates.map(c => c.email));
    setSelectedEmails(emails);
    setBulkEmailStep('select');
    setEmailType('interview'); // Default email type
  };
  
  // Toggle email selection
  const toggleEmailSelection = (email) => {
    const newSet = new Set(selectedEmails);
    if (newSet.has(email)) {
      newSet.delete(email);
    } else {
      newSet.add(email);
    }
    setSelectedEmails(newSet);
  };
  
  // Select all visible emails
  const selectAllEmails = () => {
    const selected = candidates.filter(c => selectedIds.includes(c._id));
    const validCandidates = selected.filter(c => c.email);
    
    if (selectedEmails.size === validCandidates.length) {
      setSelectedEmails(new Set()); // Deselect all
    } else {
      const emails = new Set(validCandidates.map(c => c.email));
      setSelectedEmails(emails); // Select all
    }
  };
  
  // Confirm and send emails
  const handleConfirmSend = async () => {
    if (selectedEmails.size === 0) {
      alert('⚠️ No emails selected!');
      return;
    }
    
    setBulkEmailStep('sending');
    setIsSendingEmail(true);
    
    try {
      // Get candidate data for selected emails
      const selectedCandidates = candidates.filter(c => 
        selectedEmails.has(c.email)
      );
      
      const response = await authenticatedFetch(`${BASE_API_URL}/api/email/send-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: selectedCandidates.map(c => ({
            email: c.email,
            name: c.name,
            position: c.position,
            department: c.client || 'N/A',
            joiningDate: c.callBackDate || 'TBD'
          })),
          emailType: emailType,
          customMessage: customMessage || ''
        })
      });

      if (isUnauthorized(response)) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();
      
      // Set campaign status
      setCampaignStatus({
        totalEmails: data.data.total,
        completed: data.data.sent,
        failed: data.data.failed,
        waiting: 0,
        processing: 0,
        successRate: data.data.successRate
      });
      
      // Move to results after a brief delay
      setTimeout(() => {
        setBulkEmailStep('results');
        setIsSendingEmail(false);
      }, 1000);
      
    } catch (error) {
      console.error('Bulk email error:', error);
      alert('❌ Failed to send bulk emails. Please try again.');
      setBulkEmailStep('select');
      setIsSendingEmail(false);
    }
  };
  
  // Close bulk email flow
  const closeBulkEmailFlow = () => {
    setBulkEmailStep(null);
    setSelectedEmails(new Set());
    setCampaignStatus(null);
    setEmailStatuses({});
    setEmailType('interview');
    setCustomMessage('');
    setEmailCC('');
    setEmailBCC('');
    setSelectedIds([]);
  };

  // ===================== OLD BULK EMAIL HANDLER (REPLACED) =====================
  const handleBulkWhatsApp = () => {
    const selected = candidates.filter(c => selectedIds.includes(c._id));
    const contacts = selected.map(c => c.contact).filter(p => p);

    if (contacts.length === 0) return alert("No valid contacts found!");

    if (window.confirm(`Opening ${contacts.length} WhatsApp chats. Please allow pop-ups.`)) {
      contacts.forEach((phone, index) => {
        const cleanPhone = phone.replace(/\D/g, '');
        // 1 second ka delay taaki browser block na kare
        setTimeout(() => {
          window.open(`https://wa.me/${cleanPhone}?text=Hello, we saw your profile on our ATS dashboard...`, '_blank');
        }, index * 1000);
      });
    }
  };

  /* ================================================================ */

  const sendEmail = (email) => {
    window.location.href = `mailto:${email}?subject=Job Opportunity&body=Hello, we saw your profile...`;
  };

  const sendWhatsApp = (phone) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  // const handleDelete = async (id) => {
  //   if (window.confirm("Are you sure?")) {
  //     try {
  //       await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
  //       fetchData();
  //     } catch (err) { alert("Delete failed"); }
  //   }
  // };

const handleDelete = async (id) => {
    if (window.confirm("Are you sure?")) {
        try {
            console.log("Deleting ID:", id); // Check karein console mein id sahi aa rahi hai
            
            const response = await authenticatedFetch(`${API_URL}/${id}`, { 
                method: 'DELETE' 
            });

            if (isUnauthorized(response)) {
              handleUnauthorized();
              return;
            }

            if (response.ok) {
              alert("Deleted successfully!");
              fetchData(1, { search: searchQuery, position: filterJob }); 
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.message}`);
            }
        } catch (err) {
            console.error("Delete Error:", err);
            alert("Network error: Could not reach the server.");
        }
    }
};





  const handleEdit = (candidate) => {
    setEditId(candidate._id);
    setFormData({ ...candidate, resume: null }); 
    setShowModal(true);
  };

  const handleSendEmail = (candidate) => {
    if (!candidate.email || !candidate.email.includes('@')) {
      alert('❌ Invalid email address for this candidate.');
      return;
    }

    setEmailRecipient(candidate);
    setEmailType('interview');
    setCustomMessage('');
    setEmailCC('');
    setEmailBCC('');
    setShowEmailModal(true);
  };
  const sendSingleEmail = async () => {
    if (!emailRecipient) return;

    try {
      setIsSendingEmail(true);

      // Parse CC and BCC from comma-separated strings
      const parseEmails = (emailString) => {
        return emailString
          .split(',')
          .map(email => email.trim())
          .filter(email => email && email.includes('@'));
      };

      const emailBody = {
        email: emailRecipient.email,
        name: emailRecipient.name,
        position: emailRecipient.position,
        emailType: emailType,
        customMessage: customMessage,
        department: emailRecipient.department || 'N/A',
        joiningDate: emailRecipient.joiningDate || 'TBD'
      };

      // Add CC if provided
      if (emailCC.trim()) {
        const ccEmails = parseEmails(emailCC);
        if (ccEmails.length > 0) emailBody.cc = ccEmails;
      }

      // Add BCC if provided
      if (emailBCC.trim()) {
        const bccEmails = parseEmails(emailBCC);
        if (bccEmails.length > 0) emailBody.bcc = bccEmails;
      }

      const response = await authenticatedFetch(`${BASE_API_URL}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailBody)
      });

      const data = await response.json();

      if (data.success) {
        let successMessage = `✅ Email sent successfully to ${emailRecipient.email}!`;
        if (emailCC.trim()) successMessage += `\n📋 CC: ${emailCC}`;
        if (emailBCC.trim()) successMessage += `\n🔒 BCC: ${emailBCC}`;
        alert(successMessage);
        setShowEmailModal(false);
        setEmailRecipient(null);
      } else {
        alert(`❌ Failed to send email: ${data.message}`);
      }
    } catch (error) {
      console.error('Email send error:', error);
      alert('❌ Failed to send email. Please try again.');
    } finally {
      setIsSendingEmail(false);
    }
  };

 
const handleInputChange = async (e) => {
  const { name, value, files } = e.target;

  // 1. Pehle value ko format kar lete hain (Name aur Email ke liye)
  let finalValue = value;

  if (name === 'name' && value) {
    
    finalValue = value.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  if (name === 'email' && value) {
    // gnail.con -> gmail.com logic
    finalValue = value.toLowerCase()
      .replace(/@gnail\.con$/, '@gmail.com')
      .replace(/@gnail\.com$/, '@gmail.com')
      .replace(/@gmail\.con$/, '@gmail.com')
      .replace(/@gmal\.com$/, '@gmail.com');
  }

  // 2. Resume Parsing Logic (Ye tumhara original logic hai)
  if (name === 'resume') {
    const file = files[0];
    setFormData(prev => ({ ...prev, resume: file }));

    if (file) {
      setIsAutoParsing(true);
      const data = new FormData();
      data.append('resume', file);

      try {
        const response = await fetch('http://localhost:5000/candidates/parse-logic', {
          method: 'POST',
          body: data,
        });

        if (response.ok) {
          const result = await response.json();
          console.log("Parsed Data Received:", result);

          // Parsed data ko bhi format karke state mein save karenge
          setFormData(prev => ({
            ...prev,
            name: result.name ? (result.name.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')) : prev.name,
            email: result.email ? (result.email.toLowerCase().replace(/@gnail\.con$/, '@gmail.com').replace(/@gmail\.con$/, '@gmail.com')) : prev.email,
            contact: result.contact || prev.contact
          }));
        }
      } catch (error) {
        console.error("Auto-parse error:", error);
      } finally {
        setIsAutoParsing(false);
      }
    }
  } else {
    // 3. Normal Input update (Yahan 'finalValue' use ho rahi hai)
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  }
};


const handleAddCandidate = async (e) => {
  e.preventDefault();

  try {
    let response;
    
    if (editId) {
      // --- UPDATE LOGIC (For Edit/Call Back) ---
      response = await authenticatedFetch(`${API_URL}/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData) 
      });
    } else {
      // --- ADD NEW LOGIC (For New Candidate with File) ---
      const data = new FormData();
      Object.keys(formData).forEach((key) => {
        if (['statusHistory', '_id', '__v', 'updatedAt'].includes(key)) return;
        if (key === 'resume') {
          if (formData[key] instanceof File) data.append('resume', formData[key]);
        } else {
          data.append(key, formData[key] || "");
        }
      });

      // For FormData, we need to let the browser set Content-Type automatically
      const token = localStorage.getItem('token');
      response = await fetch(API_URL, { 
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: data 
      });
    }

    if (isUnauthorized(response)) {
      handleUnauthorized();
      return;
    }

    if (response.ok) {
      alert(editId ? "✅ Profile Updated!" : "✅ Candidate Added!");
      setShowModal(false);
      setEditId(null);
      setFormData(initialFormState);
      fetchData(1, { search: searchQuery, position: filterJob });
    } else {
      const errJson = await response.json();
      alert("❌ Error: " + errJson.message);
    }
  } catch (err) { 
    console.error(err);
    alert("❌ Server Error"); 
  }
};
  const handleStatusChange = async (id, newStatus) => {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    fetchData(1, { search: searchQuery, position: filterJob });
  };

  // ✅ Handle CTC Dropdown Change
  const handleCtcChange = async (id, newCtc) => {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ctc: newCtc })
    });
    fetchData(1, { search: searchQuery, position: filterJob });
  };

  // ✅ Handle Expected CTC Dropdown Change
  const handleExpectedCtcChange = async (id, newExpectedCtc) => {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedCtc: newExpectedCtc })
    });
    fetchData(1, { search: searchQuery, position: filterJob });
  };

  // ✅ Handle Notice Period Dropdown Change
  const handleNoticePeriodChange = async (id, newNoticePeriod) => {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noticePeriod: newNoticePeriod })
    });
    fetchData(1, { search: searchQuery, position: filterJob });
  };

  // ✅ Handle Source of CV Dropdown Change
  const handleSourceChange = async (id, newSource) => {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: newSource })
    });
    fetchData(1, { search: searchQuery, position: filterJob });
  };

  // ✅ HELPER: Validate and Auto-Fix Email
  const validateAndFixEmail = (email) => {
    if (!email) return { isValid: false, value: '' };
    
    let fixed = String(email).trim().toLowerCase();
    
    // Check if it has @ and valid domain format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(fixed);
    
    return { isValid, value: fixed };
  };

  // ✅ HELPER: Validate and Auto-Fix Mobile Number
  const validateAndFixMobile = (mobile) => {
    if (!mobile) return { isValid: false, value: '' };
    
    // Remove all non-digits first
    let digitsOnly = String(mobile).replace(/\D/g, '');
    
    // If it has +91 country code, remove it and take last 10 digits
    if (digitsOnly.startsWith('91') && digitsOnly.length > 10) {
      digitsOnly = digitsOnly.slice(-10);
    }
    
    // Take only last 10 digits if more than 10
    if (digitsOnly.length > 10) {
      digitsOnly = digitsOnly.slice(-10);
    }
    
    // Check if exactly 10 digits and starts with 6-9
    const isValid = digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly);
    
    return { isValid, value: digitsOnly };
  };

  // ✅ HELPER: Validate and Auto-Fix Name
  const validateAndFixName = (name) => {
    if (!name) return { isValid: false, value: '' };
    
    // Remove all digits and special characters, keep only alphabets and spaces
    let fixed = String(name).replace(/[0-9!@#$%^&*()_+=\[\]{};:'",.<>?/\\|`~-]/g, '').trim();
    
    // Convert to title case (First letter of each word capitalized)
    fixed = fixed.split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Check if length >= 2 and only has alphabets and spaces
    const isValid = fixed.length >= 2 && /^[a-zA-Z\s]+$/.test(fixed);
    
    return { isValid, value: fixed };
  };

  // ✅ Check if a record is 100% PROPERLY FILLED - SIMPLE 3-FIELD VALIDATION
  const is100PercentCorrect = (candidate) => {
    // Validate Email
    const emailCheck = validateAndFixEmail(candidate.email);
    
    // Validate Mobile Number
    const mobileCheck = validateAndFixMobile(candidate.contact);
    
    // Validate Name
    const nameCheck = validateAndFixName(candidate.name);

    // RETURN TRUE ONLY IF ALL THREE CORE FIELDS ARE VALID
    return emailCheck.isValid && mobileCheck.isValid && nameCheck.isValid;
  };

  let debugLogCount = 0;
  const filteredCandidates = candidates.filter(c => {
    // If showOnlyCorrect is ON, only show 100% properly filled records
    if (showOnlyCorrect && !is100PercentCorrect(c)) {
      // Debug first 3 failures to console
      if (debugLogCount < 3) {
        const emailCheck = validateAndFixEmail(c.email);
        const mobileCheck = validateAndFixMobile(c.contact);
        const nameCheck = validateAndFixName(c.name);
        console.log(`🔴 [${debugLogCount + 1}] Filtered: "${c.name}" | Email: ${c.email?.substring(0, 30)} (valid: ${emailCheck.isValid}) | Contact: ${c.contact} (valid: ${mobileCheck.isValid}) | Name valid: ${nameCheck.isValid}`);
        debugLogCount++;
      }
      return false;
    }

    const matchesSearch = 
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.position?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.location?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesJob = filterJob ? c.position === filterJob : true;

    // ✅ Advanced Search Filters
    const advSearch = advancedSearchFilters;
    
    // Position filter
    const matchesAdvPosition = advSearch.position 
      ? (c.position?.toLowerCase().includes(advSearch.position.toLowerCase()) || false)
      : true;
    
    // Company filter
    const matchesAdvCompany = advSearch.companyName 
      ? (c.companyName?.toLowerCase().includes(advSearch.companyName.toLowerCase()) || false)
      : true;
    
    // Location filter
    const matchesAdvLocation = advSearch.location 
      ? (c.location?.toLowerCase().includes(advSearch.location.toLowerCase()) || false)
      : true;
    
    // Experience range filter
    const candidateExp = parseFloat(c.experience) || 0;
    const expMin = advSearch.expMin ? parseFloat(advSearch.expMin) : null;
    const expMax = advSearch.expMax ? parseFloat(advSearch.expMax) : null;
    const matchesExpRange = 
      (expMin === null || candidateExp >= expMin) &&
      (expMax === null || candidateExp <= expMax);
    
    // CTC range filter
    const parseCTC = (ctcStr) => {
      if (!ctcStr) return 0;
      const str = String(ctcStr).toUpperCase().trim();
      if (str.includes('L')) return parseFloat(str) * 100000;
      if (str.includes('K')) return parseFloat(str) * 1000;
      return parseFloat(str) || 0;
    };
    
    const candidateCTC = parseCTC(c.ctc);
    const ctcMin = advSearch.ctcMin ? parseCTC(advSearch.ctcMin) : null;
    const ctcMax = advSearch.ctcMax ? parseCTC(advSearch.ctcMax) : null;
    const matchesCTCRange = 
      (ctcMin === null || candidateCTC >= ctcMin) &&
      (ctcMax === null || candidateCTC <= ctcMax);
    
    // Expected CTC range filter
    const candidateExpectedCTC = parseCTC(c.expectedCtc);
    const expectedCtcMin = advSearch.expectedCtcMin ? parseCTC(advSearch.expectedCtcMin) : null;
    const expectedCtcMax = advSearch.expectedCtcMax ? parseCTC(advSearch.expectedCtcMax) : null;
    const matchesExpectedCTCRange = 
      (expectedCtcMin === null || candidateExpectedCTC >= expectedCtcMin) &&
      (expectedCtcMax === null || candidateExpectedCTC <= expectedCtcMax);
    
    // Date filter
    const matchesDate = advSearch.date 
      ? (c.date?.includes(advSearch.date) || false)
      : true;
    
    const matchesAdvanced = matchesAdvPosition && matchesAdvCompany && matchesAdvLocation && 
                          matchesExpRange && matchesCTCRange && matchesExpectedCTCRange && matchesDate;
    
    return matchesSearch && matchesJob && matchesAdvanced;
  });
  console.log('📋 Displayed: ' + filteredCandidates.length + ' | Total in DB: ' + candidates.length + ' | Filter: ' + (showOnlyCorrect ? 'ON' : 'OFF'));

  // Show ALL candidates (no pagination on initial load)
  // ✅ CLIENT-SIDE PAGINATION: Show 50 records per page
  const PAGE_SIZE = 50;
  const totalFilteredPages = Math.ceil(filteredCandidates.length / PAGE_SIZE);
  const visibleCandidates = useMemo(() => {
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const endIdx = startIdx + PAGE_SIZE;
    return filteredCandidates.slice(startIdx, endIdx);
  }, [filteredCandidates, currentPage]);

  const loadMoreRef = useRef(null);
  const isAutoPagingRef = useRef(false);

  useEffect(() => {
    isAutoPagingRef.current = false;
  }, [currentPage, searchQuery, filterJob]);
  
  // ✅ NO AUTO-SCROLL: Only button-based pagination
  // Removed IntersectionObserver - users must click "Load More" button

  const isAllSelected = filteredCandidates.length > 0 && selectedIds.length === filteredCandidates.length;

  const stickyColWidths = {
    checkbox: 60,
    actions: 90,
    srNo: 80,
    resume: 90,
    tools: 120
  };
  const stickyLeftOffsets = [
    stickyColWidths.checkbox,
    stickyColWidths.checkbox + stickyColWidths.actions,
    stickyColWidths.checkbox + stickyColWidths.actions + stickyColWidths.srNo,
    stickyColWidths.checkbox + stickyColWidths.actions + stickyColWidths.srNo + stickyColWidths.resume
  ];

  const getStickyHeaderStyle = (idx) => {
    if (idx === 0) return { left: `${stickyLeftOffsets[idx]}px`, width: `${stickyColWidths.actions}px`, minWidth: `${stickyColWidths.actions}px` };
    if (idx === 1) return { left: `${stickyLeftOffsets[idx]}px`, width: `${stickyColWidths.srNo}px`, minWidth: `${stickyColWidths.srNo}px` };
    if (idx === 2) return { left: `${stickyLeftOffsets[idx]}px`, width: `${stickyColWidths.resume}px`, minWidth: `${stickyColWidths.resume}px` };
    if (idx === 3) return { left: `${stickyLeftOffsets[idx]}px`, width: `${stickyColWidths.tools}px`, minWidth: `${stickyColWidths.tools}px` };
    return undefined;
  };

  const getStickyBodyStyle = (idx) => {
    if (idx === 0) return { left: `${stickyLeftOffsets[idx]}px`, width: `${stickyColWidths.actions}px`, minWidth: `${stickyColWidths.actions}px` };
    if (idx === 1) return { left: `${stickyLeftOffsets[idx]}px`, width: `${stickyColWidths.srNo}px`, minWidth: `${stickyColWidths.srNo}px` };
    if (idx === 2) return { left: `${stickyLeftOffsets[idx]}px`, width: `${stickyColWidths.resume}px`, minWidth: `${stickyColWidths.resume}px` };
    if (idx === 3) return { left: `${stickyLeftOffsets[idx]}px`, width: `${stickyColWidths.tools}px`, minWidth: `${stickyColWidths.tools}px` };
    return undefined;
  };

  const tableColumns = [
    {
      key: 'actions',
      label: 'Actions',
      render: (candidate) => (
        <div className="flex gap-2">
          <button onClick={() => handleEdit(candidate)} className="p-1.5 rounded" title="Edit" style={{color: 'var(--info-main)'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--info-bg)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Edit size={16} /></button>
          <button onClick={() => handleDelete(candidate._id)} className="p-1.5 rounded" title="Delete" style={{color: 'var(--error-main)'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--error-bg)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Trash2 size={16} /></button>
          <button onClick={() => handleSendEmail(candidate)} className="p-1.5 rounded" title="Send Email" style={{color: 'var(--primary-main)'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-lighter)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Mail size={16} /></button>
        </div>
      )
    },
    { key: 'srNo', label: 'Sr No.', render: (_, index) => (currentPage - 1) * PAGE_SIZE + index + 1 },
    {
      key: 'resume',
      label: 'Resume',
      render: (candidate) => candidate.resume && (
        <a href={candidate.resume} target="_blank" rel="noreferrer" className="inline-flex p-2 rounded-lg" style={{backgroundColor: 'var(--info-bg)', color: 'var(--info-main)'}} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--info-light)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--info-bg)'; }}><FileText size={18} /></a>
      )
    },
    {
      key: 'tools',
      label: 'Contact Tools',
      render: (candidate) => (
        <div className="flex gap-2">
          <button onClick={() => handleSendEmail(candidate)} className="p-2 rounded-lg" title="Send Email" style={{backgroundColor: 'var(--primary-lighter)', color: 'var(--primary-main)'}} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-light)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-lighter)'; }}><Mail size={16}/></button>
          <button onClick={() => sendWhatsApp(candidate.contact)} className="p-2 rounded-lg" title="WhatsApp Message" style={{backgroundColor: 'var(--success-bg)', color: 'var(--success-main)'}} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--success-light)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--success-bg)'; }}><MessageCircle size={16}/></button>
        </div>
      )
    },
    { key: 'date', label: 'Date', render: (candidate) => candidate.date },
    { key: 'location', label: 'Location', render: (candidate) => candidate.location },
    { key: 'position', label: 'Position', render: (candidate) => <span className="font-bold">{candidate.position}</span> },
    { key: 'fls', label: 'FLS/Non FLS', render: (candidate) => candidate.fls },
    { key: 'name', label: 'Name', render: (candidate) => <span className="font-bold">{candidate.name}</span> },
    { key: 'contact', label: 'Contact', render: (candidate) => candidate.contact },
    { key: 'email', label: 'Email', render: (candidate) => candidate.email },
    { key: 'companyName', label: 'Company Name', render: (candidate) => candidate.companyName },
    { key: 'experience', label: 'Experience', render: (candidate) => candidate.experience },
    {
      key: 'ctc',
      label: 'CTC',
      render: (candidate) => candidate.ctc ? `${candidate.ctc} LPA` : '-'
    },
    {
      key: 'expectedCtc',
      label: 'Expected CTC',
      render: (candidate) => candidate.expectedCtc ? `${candidate.expectedCtc} LPA` : '-'
    },
    {
      key: 'noticePeriod',
      label: 'Notice period',
      render: (candidate) => candidate.noticePeriod === 0 ? 'Immediate' : candidate.noticePeriod ? `${candidate.noticePeriod} days` : '-'
    },
    {
      key: 'status',
      label: 'Status',
      render: (candidate) => (
        <select className="p-1.5 rounded-full text-xs font-bold" style={{backgroundColor: candidate.status === 'Hired' ? 'var(--success-bg)' : 'var(--info-bg)', color: candidate.status === 'Hired' ? 'var(--success-main)' : 'var(--info-main)'}} value={candidate.status} onChange={(e) => handleStatusChange(candidate._id, e.target.value)}>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )
    },
    { key: 'client', label: 'Client', render: (candidate) => candidate.client },
    { key: 'spoc', label: 'SPOC', render: (candidate) => candidate.spoc },
    {
      key: 'source',
      label: 'Source of CV',
      render: (candidate) => candidate.source || '-'
    }
  ];

  const statusOptions = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

  // ✅ REVIEW & FIX HELPERS
  const handleRevalidateRecord = async (record) => {
    try {
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/revalidate-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: record.fixed || record })
      });
      
      if (!response.ok) throw new Error('Revalidation failed');
      
      const result = await response.json();
      
      // Update the edited row with new validation
      setEditingRow({
        ...record,
        fixed: result.fixed,
        autoFixChanges: result.autoFixChanges,
        validation: result.validation
      });
      
      alert(`✅ Category: ${result.validation.category.toUpperCase()}\n${result.validation.confidence}% Confidence`);
    } catch (error) {
      alert(`❌ Revalidation error: ${error.message}`);
    }
  };

  const handleSaveEditedRecord = async () => {
    if (!editingRow) return;
    
    console.log('💾 Saving & Importing edited record:', editingRow);
    console.log('🔍 Row to remove - rowIndex:', editingRow.rowIndex, 'name:', editingRow.fixed?.name);
    
    try {
      const recordData = editingRow.fixed || editingRow.original || editingRow;
      const candidateName = recordData.name || 'Candidate';
      const rowIndexToRemove = editingRow.rowIndex;
      const nameToRemove = editingRow.fixed?.name?.toLowerCase();
      
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/import-reviewed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          readyRecords: [recordData],
          reviewRecords: []
        })
      });
      
      if (!response.ok) throw new Error('Failed to import');
      
      const result = await response.json();
      console.log('✅ Record imported:', result);
      
      // Close edit modal first
      setEditingRow(null);
      
      // Update reviewData - remove the imported record from ALL categories
      // Use both rowIndex AND name matching for reliability
      setReviewData(prev => {
        if (!prev) return prev;
        
        const filterRecord = (r) => {
          const recordName = r.fixed?.name?.toLowerCase();
          const recordRowIndex = r.rowIndex;
          
          // Match by rowIndex first, then by name as fallback
          if (rowIndexToRemove !== undefined && recordRowIndex === rowIndexToRemove) {
            console.log('🗑️ Removing by rowIndex match:', rowIndexToRemove);
            return false;
          }
          if (nameToRemove && recordName === nameToRemove) {
            console.log('🗑️ Removing by name match:', nameToRemove);
            return false;
          }
          return true;
        };
        
        const updated = {
          ...prev,
          ready: prev.ready.filter(filterRecord),
          review: prev.review.filter(filterRecord),
          blocked: prev.blocked.filter(filterRecord)
        };
        
        console.log('📊 Updated reviewData:', {
          ready: updated.ready?.length || 0,
          review: updated.review?.length || 0,
          blocked: updated.blocked?.length || 0
        });
        return updated;
      });
      
      // Show confirmation modal after a small delay to let state update
      setTimeout(() => {
        setImportConfirmation({ 
          candidateName,
          show: true 
        });
      }, 200);
      
    } catch (error) {
      console.error('❌ Error importing:', error);
      alert('❌ Import error: ' + error.message);
    }
  };

  const handleImportReviewed = async () => {
    if (!reviewData) return;
    
    const readyRecords = reviewData.ready; 
    const reviewRecords = reviewData.review || [];
    
    const confirmed = window.confirm(`Import ${readyRecords.length} ready records + ${reviewRecords.length} records for review?`);
    if (!confirmed) return;
    
    try {
      console.log(`📤 [IMPORT] Sending ${readyRecords.length} ready + ${reviewRecords.length} review records`);
      
      // Mark review records with pending_review status
      const reviewRecordsWithStatus = reviewRecords.map(r => ({
        ...r.fixed || r.original,
        status: 'Pending Review',
        needsReview: true
      }));
      
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/import-reviewed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          readyRecords,
          reviewRecords: reviewRecordsWithStatus
        })
      });
      
      console.log(`📥 [IMPORT] Response status: ${response.status}, ok: ${response.ok}`);
      
      let result;
      const responseText = await response.text();
      console.log(`📥 [IMPORT] Response text (first 500 chars): ${responseText.substring(0, 500)}`);
      
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`❌ [IMPORT] Failed to parse response as JSON:`, parseError);
        throw new Error(`Server returned invalid response: ${responseText.substring(0, 200)}`);
      }
      
      if (!response.ok) {
        throw new Error(result.message || `Server error: ${response.status}`);
      }
      
      console.log(`✅ [IMPORT] Response:`, result);
      alert(`✅ ${result.imported} candidates imported successfully!\n⚠️ ${reviewRecords.length} added for review`);
      
      // Get the review count from reviewData before closing modal
      const reviewCount = reviewRecords.length;
      
      // Refresh data and close modal
      setShowReviewModal(false);
      setReviewData(null);
      setEditingRow(null);
      fetchData(1, { search: '', position: '' });
      
      // Call completion callback if provided
      if (onImportComplete) {
        console.log('📢 Calling onImportComplete callback');
        onImportComplete({
          imported: result.imported,
          review: reviewCount,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error(`❌ [IMPORT] Error:`, error);
      alert(`❌ Import error: ${error.message}`);
    }
  };

  const getFilteredReviewData = () => {
    if (!reviewData) return { ready: [], review: [], blocked: [] };
    
    if (reviewFilter === 'review') {
      return { ready: [], review: reviewData.review || [], blocked: [] };
    } else if (reviewFilter === 'blocked') {
      return { ready: [], review: [], blocked: reviewData.blocked || [] };
    }
    return reviewData;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      
      {/* COLUMN MAPPER MODAL */}
      {showColumnMapper && (
        <ColumnMapper 
          excelHeaders={excelHeaders}
          onMapComplete={handleUploadWithMapping}
          onClose={() => {
            setShowColumnMapper(false);
            setPendingFile(null);
          }}
        />
      )}

      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <h3 className="text-lg font-bold text-slate-800">Uploading candidates…</h3>
            <p className="mt-2 text-sm text-slate-500">Please wait. This can take a few minutes for large files.</p>
          </div>
        </div>
      )}

      {isLoadingInitial && candidates.length === 0 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
            <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Loading Candidates</h3>
            <p className="text-sm text-slate-600">Fetching candidate data from database...</p>
            <div className="mt-4 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
              <p className="text-xs text-indigo-700 font-semibold">⏳ Connected to backend at {BASE_API_URL}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* HEADER SECTION */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-slate-200">
          <div className="flex-1">
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">All Candidates</h1>
            <p className="text-slate-600 text-sm font-medium">Manage, search, and review all candidate records</p>
            <div className="mt-4">
              {/* PAGINATION INFO */}
              <p className="text-xs text-slate-500 font-mono">
                📊 Page {currentPage} of {totalFilteredPages} • Records {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredCandidates.length)} of {filteredCandidates.length.toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="flex gap-3 items-center">
          {/* Hidden File Input for Manual CSV Upload */}
          <input 
            type="file" 
            accept=".csv, .xlsx, .xls" 
            ref={fileInputRef} 
            onChange={handleBulkUpload} 
            className="hidden" 
          />
          
          {/* Hidden File Input for AUTO Upload */}
          <input 
            type="file" 
            accept=".csv, .xlsx, .xls" 
            ref={autoUploadInputRef} 
            onChange={handleAutoUpload} 
            className="hidden" 
          />

        </div>
      </div>

          {/* COMMENTED OUT BULK ACTIONS - ONLY SHOW IF CANDIDATES SELECTED */}
          {selectedIds.length > 0 && (
            <>
              {/* BULK EMAIL BUTTON */}
              {/* <button onClick={startBulkEmailFlow} className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-bold hover:bg-indigo-200 transition shadow-sm border border-indigo-200">
                <Mail size={18} /> Email Selected ({selectedIds.length})
              </button>

              BULK WHATSAPP BUTTON 
              <button onClick={handleBulkWhatsApp} className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg font-bold hover:bg-green-200 transition shadow-sm border border-green-200">
                <MessageCircle size={18} /> WhatsApp Selected ({selectedIds.length})
              </button>

              <button onClick={handleBulkParse} disabled={isParsing} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition shadow-sm ${isParsing ? 'bg-indigo-200 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                <Cpu size={18} className={isParsing ? 'animate-spin' : ''} /> 
                {isParsing ? 'Parsing...' : `Parse (${selectedIds.length})`}
              </button> */}
            </>
          )}

          {/* COMMENTED OUT EXTRA BUTTONS
          <button 
            onClick={() => navigate('/analytics')} 
            className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-bold hover:bg-purple-200 transition shadow-sm border border-purple-200"
          >
            <BarChart3 size={18} /> View Reports
          </button>

          AUTO IMPORT BUTTON 
          <button 
            onClick={() => autoUploadInputRef.current.click()} 
            disabled={isUploading}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg transition disabled:opacity-60"
          >
            <Upload size={20} /> {isUploading ? 'Uploading...' : '⚡ Auto Import'}
          </button>

          <button onClick={() => navigate('/add-candidate')} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-800 shadow-lg transition">
            <Plus size={20} /> Add Candidate
          </button>

          <button 
            onClick={async () => {
              if (!window.confirm('⚠️ WARNING: This will DELETE ALL candidates!\n\nThis action CANNOT be undone.\n\nAre you absolutely sure?')) return;
              try {
                const res = await authenticatedFetch(`${BASE_API_URL}/candidates/clear-all/now`, {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' }
                });
                if (!res.ok) throw new Error('Failed to clear database');
                const data = await res.json();
                alert(`✅ Success!\n\n🗑️ Deleted: ${data.deletedCount} records\n\nDatabase is now empty.`);
                setCandidates([]);
                setCurrentPage(1);
                setSearchQuery('');
                setFilterJob('');
              } catch (err) {
                alert(`❌ Error: ${err.message}`);
              }
            }}
            className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-red-700 shadow-lg transition"
          >
            <Trash2 size={20} /> Clear All Data
          </button>
          */}
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 focus-within:ring-2 ring-indigo-500/20 transition-all">
          <Search className="text-gray-400" size={20} />
          <input type="text" placeholder="Search by name, email, position or location..." className="flex-1 outline-none text-gray-700 bg-transparent" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        {/* ADVANCED SEARCH BUTTON & DOWNLOAD BUTTON */}
        <div className="mt-4 flex justify-start gap-3">
          <button 
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)} 
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition shadow-md border ${ 
              showAdvancedSearch 
                ? 'bg-blue-700 text-white border-blue-800' 
                : 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
            }`}
          >
            <Search size={20} /> {showAdvancedSearch ? 'Close Advanced Search' : 'Advanced Search'}
          </button>

          {/* DOWNLOAD BUTTON */}
          <button 
            onClick={() => {
              const headers = ['SR No', 'Date', 'Name', 'Email', 'Contact', 'Position', 'Company', 'Location', 'Experience (Yrs)', 'Current CTC', 'Expected CTC', 'Notice Period (Days)', 'FLS', 'Status', 'Client', 'SPOC', 'Source', 'Call Back Date'];
              const rows = filteredCandidates.map(c => [
                c.srNo || '',
                c.date || '',
                c.name || '',
                c.email || '',
                c.contact || '',
                c.position || '',
                c.companyName || '',
                c.location || '',
                c.experience || '',
                c.ctc || '',
                c.expectedCtc || '',
                c.noticePeriod || '',
                c.fls || '',
                c.status || '',
                c.client || '',
                c.spoc || '',
                c.source || '',
                c.callBackDate || ''
              ]);
              
              // Create Excel workbook with proper formatting
              const data = [headers, ...rows];
              const ws = XLSX.utils.aoa_to_sheet(data);
              
              // Set column widths
              const colWidths = [
                { wch: 12 }, // SR No
                { wch: 15 }, // Date
                { wch: 18 }, // Name
                { wch: 22 }, // Email
                { wch: 14 }, // Contact
                { wch: 16 }, // Position
                { wch: 14 }, // Company
                { wch: 14 }, // Location
                { wch: 14 }, // Experience
                { wch: 12 }, // CTC
                { wch: 14 }, // Expected CTC
                { wch: 16 }, // Notice Period
                { wch: 10 }, // FLS
                { wch: 12 }, // Status
                { wch: 14 }, // Client
                { wch: 12 }, // SPOC
                { wch: 12 }, // Source
                { wch: 14 }  // Call Back Date
              ];
              ws['!cols'] = colWidths;
              
              // Style header row
              for (let i = 0; i < headers.length; i++) {
                const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
                ws[cellRef].s = {
                  font: { bold: true, color: { rgb: 'FFFFFF' } },
                  fill: { fgColor: { rgb: '0066CC' } },
                  alignment: { horizontal: 'center', vertical: 'center' }
                };
              }
              
              // Format data cells - ensure Contact/Phone is text
              for (let i = 1; i < data.length; i++) {
                // Contact column (index 4) - force as text
                const contactCell = XLSX.utils.encode_cell({ r: i, c: 4 });
                if (ws[contactCell]) {
                  ws[contactCell].t = 's'; // text type
                  ws[contactCell].v = String(ws[contactCell].v);
                }
              }
              
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
              XLSX.writeFile(wb, `candidates_${new Date().toISOString().split('T')[0]}.xlsx`);
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition shadow-md border border-emerald-700"
          >
            <Download size={20} /> Download Excel
          </button>
        </div>
      </div>

      {/* ADVANCED SEARCH PANEL - ABOVE TABLE */}
      {showAdvancedSearch && (
        <div className="mb-6 bg-white p-6 rounded-2xl shadow-lg border-2 border-blue-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800">Advanced Search Filters</h3>
            <button
              onClick={() => {
                setAdvancedSearchFilters({
                  position: '',
                  companyName: '',
                  location: '',
                  expMin: '',
                  expMax: '',
                  ctcMin: '',
                  ctcMax: '',
                  expectedCtcMin: '',
                  expectedCtcMax: '',
                  date: ''
                });
                setSearchQuery('');
                setFilterJob('');
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg text-sm font-medium transition hover:bg-slate-50"
            >
              <RefreshCw size={16} /> Reset
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Position */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Position</label>
              <input
                type="text"
                name="position"
                value={advancedSearchFilters.position}
                onChange={(e) => {
                  setAdvancedSearchFilters(prev => ({ ...prev, position: e.target.value }));
                  setFilterJob(e.target.value);
                }}
                placeholder="e.g., Developer, Manager"
                className="w-full mt-1.5 px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Company */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Company</label>
              <input
                type="text"
                name="companyName"
                value={advancedSearchFilters.companyName}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="Company name"
                className="w-full mt-1.5 px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Location */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Location</label>
              <input
                type="text"
                name="location"
                value={advancedSearchFilters.location}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, location: e.target.value }))}
                placeholder="City or location"
                className="w-full mt-1.5 px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Experience Min */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Min Experience (Yrs)</label>
              <input
                type="number"
                name="expMin"
                value={advancedSearchFilters.expMin}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, expMin: e.target.value }))}
                placeholder="Min years"
                className="w-full mt-1.5 px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Experience Max */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Max Experience (Yrs)</label>
              <input
                type="number"
                name="expMax"
                value={advancedSearchFilters.expMax}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, expMax: e.target.value }))}
                placeholder="Max years"
                className="w-full mt-1.5 px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* CTC Min */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Min CTC</label>
              <input
                type="text"
                name="ctcMin"
                value={advancedSearchFilters.ctcMin}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, ctcMin: e.target.value }))}
                placeholder="e.g., 5L"
                className="w-full mt-1.5 px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* CTC Max */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Max CTC</label>
              <input
                type="text"
                name="ctcMax"
                value={advancedSearchFilters.ctcMax}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, ctcMax: e.target.value }))}
                placeholder="e.g., 10L"
                className="w-full mt-1.5 px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Expected CTC Min */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Min Expected CTC</label>
              <input
                type="text"
                name="expectedCtcMin"
                value={advancedSearchFilters.expectedCtcMin}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, expectedCtcMin: e.target.value }))}
                placeholder="e.g., 5L"
                className="w-full mt-1.5 px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Expected CTC Max */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Max Expected CTC</label>
              <input
                type="text"
                name="expectedCtcMax"
                value={advancedSearchFilters.expectedCtcMax}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, expectedCtcMax: e.target.value }))}
                placeholder="e.g., 10L"
                className="w-full mt-1.5 px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Date */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Date</label>
              <input
                type="date"
                name="date"
                value={advancedSearchFilters.date}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, date: e.target.value }))}
                className="w-full mt-1.5 px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-4">✨ Filters apply instantly to the candidate list below</p>
        </div>
      )}

      {/* PARSING PREVIEW MODAL */}
      {showPreview && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden">
            <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><Cpu size={20}/> Parsed Results</h3>
              <button onClick={() => setShowPreview(false)}><X size={24}/></button>
            </div>
            <div className="p-6 overflow-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-slate-500 font-bold"><th>Name</th><th>Email</th><th>Contact</th></tr></thead>
                <tbody>
                  {parsedResults.map(p => (
                    <tr key={p._id} className="border-b">
                      <td className="py-2">{p.name}</td>
                      <td className="py-2">{p.email}</td>
                      <td className="py-2">{p.contact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t flex justify-end">
              <button onClick={() => setShowPreview(false)} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[2000px]">
          <thead>
            <tr className="bg-emerald-50 text-slate-700 border-b-2 border-emerald-100">
              <th className="p-4 w-[60px] min-w-[60px] sticky left-0 z-20 bg-emerald-50 border-r border-emerald-100">
                <div onClick={() => selectAll(filteredCandidates.map(c => c._id))} className="cursor-pointer">
                  {isAllSelected ? <CheckSquare size={22} className="text-indigo-600" /> : <Square size={22} className="text-slate-400" />}
                </div>
              </th>
              {tableColumns.map((column, idx) => (
                <th
                  key={column.key}
                  className={`p-4 text-sm font-bold whitespace-nowrap${idx < 4 ? ' sticky z-20 bg-emerald-50 border-r border-emerald-100' : ''}`}
                  style={getStickyHeaderStyle(idx)}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleCandidates.map((candidate,index) => (
              <tr key={candidate._id} className="border-b hover:bg-slate-50 transition">
                <td className="p-4 text-center sticky left-0 z-10 bg-white border-r border-slate-200" style={{ width: `${stickyColWidths.checkbox}px`, minWidth: `${stickyColWidths.checkbox}px` }}>
                  <div onClick={() => toggleSelection(candidate._id)} className="cursor-pointer">
                    {selectedIds.includes(candidate._id) ? <CheckSquare className="text-indigo-600" size={20} /> : <Square className="text-slate-300" size={20} />}
                  </div>
                </td>
                {tableColumns.map((column, idx) => (
                  <td
                    key={`${candidate._id}-${column.key}`}
                    className={`p-4${idx < 4 ? ' sticky z-10 bg-white border-r border-slate-200' : ''}`}
                    style={getStickyBodyStyle(idx)}
                  >
                    {column.render(candidate, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>             

      {/* Sentinel for lazy-loading more rows + pagination */}
      <div ref={loadMoreRef} className="w-full text-center py-6 text-sm text-gray-500">
        All candidates loaded.
      </div>
      
      {/* ENHANCED PAGINATION DISPLAY */}
      <div className="w-full py-8 px-4 flex justify-end">
        <div className="flex gap-3">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-6 py-3 bg-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-400 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              ← Previous
            </button>
            
            {currentPage < totalFilteredPages && (
              <button 
                onClick={() => setCurrentPage(currentPage + 1)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition flex items-center gap-2"
              >
                Next →
              </button>
            )}
            
            {currentPage === totalFilteredPages && totalFilteredPages > 0 && (
              <div className="px-6 py-3 bg-green-100 text-green-700 rounded-lg font-bold text-sm">
                ✅ End of Records
              </div>
            )}
        </div>
      </div>

{showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-8 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-slate-800">{editId ? '📝 Edit Profile' : '👤 Add New Candidate'}</h2>
            <form onSubmit={handleAddCandidate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="col-span-full bg-slate-50 p-4 rounded-xl border-2 border-dashed border-slate-200">
                   <label className="text-sm font-bold block mb-2 text-slate-600">Resume Upload (PDF/DOC)</label>
                   <input type="file" name="resume" accept=".pdf,.doc,.docx" onChange={handleInputChange} className="w-full text-sm" />
                </div>

                {/* Yahan Mapping ho rahi hai (srNo aur contact ko yahan se hata diya hai) */}
                {Object.keys(initialFormState).map(key => {
                  if (['status', 'fls', 'resume', 'position', 'contact', 'srNo', 'source', 'ctc', 'expectedCtc', 'noticePeriod'].includes(key)) return null;
                  return (
                    <div key={key}>
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1')}</label>
                      <input 
                        type={key === 'date' ? 'date' : 'text'} 
                        name={key} 
                        className={`w-full p-2.5 bg-slate-50 border rounded-lg focus:ring-2 outline-none transition ${key === 'email' && formData.email && !formData.email.includes('@gmail.com') ? 'border-orange-500 ring-orange-200' : 'border-slate-200 ring-indigo-500/20'}`} 
                        value={formData[key] || ''} 
                        onChange={handleInputChange} 
                      />
                      {key === 'email' && formData.email && !formData.email.includes('@gmail.com') && (
                        <p className="text-[9px] text-orange-600 font-bold mt-1 italic">Typo? check if it's @gmail.com</p>
                      )}
                    </div>
                  )
                })}
                <div>
  {/* Call Back Date Input Field */}
<div>
  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Call Back Date</label>
  <input 
    type="text" // 'date' ki jagah 'text' use karein agar aap "1 month" likhna chahti hain
    name="callBackDate" 
    placeholder="e.g. 25 Jan or 15 days"
    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 ring-orange-500/20"
    value={formData.callBackDate || ''} 
    onChange={handleInputChange} 
  />
</div>
</div>
{/* --- STATUS DROPDOWN (Added manually) --- */}
<div>
  <label className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">Status</label>
  <select 
    name="status" 
    value={formData.status || 'Applied'} 
    onChange={handleInputChange} 
    className="w-full p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg outline-none font-bold text-indigo-700"
  >
    {['Applied', 'Screening', 'Interview', 'Offer', 'Joined', 'Rejected'].map(s => (
      <option key={s} value={s}>{s}</option>
    ))}
  </select>
</div>

{/* --- JOINING DATE (Sirf tab dikhega jab Status 'Joined' hoga) --- */}
{formData.status === 'Joined' && (
  <div>
    <label className="text-[10px] font-extrabold text-green-600 uppercase tracking-wider">Joining Date</label>
    <input 
      type="date" 
      name="hiredDate" 
      value={formData.hiredDate ? formData.hiredDate.split('T')[0] : ''} 
      onChange={handleInputChange} 
      className="w-full p-2.5 bg-green-50 border border-green-200 rounded-lg outline-none focus:ring-2 ring-green-500/20"
      required={formData.status === 'Joined'}
    />
  </div>
)}



                {/* 1. Naya Phone Input (Mapping ke bahar lekin Grid ke andar) */}
                <div className="flex flex-col">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Contact Number</label>
                  <PhoneInput
                    country={'in'}
                    value={formData.contact}
                    onChange={(phone) => setFormData(prev => ({ ...prev, contact: phone }))}
                    inputStyle={{ width: '100%', height: '42px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                    containerStyle={{ width: '100%' }}
                  />
                </div>

                {/* 2. Position Dropdown */}
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Position</label>
                  <select name="position" value={formData.position} onChange={handleInputChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none">
                    <option value="">Select Role</option>
                    {jobs.map(j => <option key={j._id} value={j.role}>{j.role}</option>)}
                  </select>
                </div>

                {/* 3. Source of CV Dropdown */}
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Source of CV</label>
                  <select name="source" value={formData.source} onChange={handleInputChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none">
                    <option value="">Select Source</option>
                    <option value="Shine">Shine</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Naukri">Naukri</option>
                    <option value="ATS">ATS</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                {/* 4. Current CTC Dropdown */}
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Current CTC</label>
                  <select name="ctc" value={formData.ctc} onChange={handleInputChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none">
                    <option value="">Select CTC</option>
                    <option value="0-50k">0-50k</option>
                    <option value="50k-1L">50k-1L</option>
                    <option value="1L-1.5L">1L-1.5L</option>
                    <option value="1.5L-2L">1.5L-2L</option>
                    <option value="2L-2.5L">2L-2.5L</option>
                    <option value="2.5L-3L">2.5L-3L</option>
                    <option value="3L-3.5L">3L-3.5L</option>
                    <option value="3.5L-4L">3.5L-4L</option>
                    <option value="4L-4.5L">4L-4.5L</option>
                    <option value="4.5L-5L">4.5L-5L</option>
                    <option value="5L-5.5L">5L-5.5L</option>
                    <option value="5.5L-6L">5.5L-6L</option>
                    <option value="6L-8L">6L-8L</option>
                    <option value="8L-9L">8L-9L</option>
                    <option value="9L-10L">9L-10L</option>
                    <option value="Above 10L">Above 10L</option>
                  </select>
                </div>

                {/* 5. Expected CTC Dropdown */}
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Expected CTC</label>
                  <select name="expectedCtc" value={formData.expectedCtc} onChange={handleInputChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none">
                    <option value="">Select Expected CTC</option>
                    <option value="0-50k">0-50k</option>
                    <option value="50k-1L">50k-1L</option>
                    <option value="1L-1.5L">1L-1.5L</option>
                    <option value="1.5L-2L">1.5L-2L</option>
                    <option value="2L-2.5L">2L-2.5L</option>
                    <option value="2.5L-3L">2.5L-3L</option>
                    <option value="3L-3.5L">3L-3.5L</option>
                    <option value="3.5L-4L">3.5L-4L</option>
                    <option value="4L-4.5L">4L-4.5L</option>
                    <option value="4.5L-5L">4.5L-5L</option>
                    <option value="5L-5.5L">5L-5.5L</option>
                    <option value="5.5L-6L">5.5L-6L</option>
                    <option value="6L-8L">6L-8L</option>
                    <option value="8L-9L">8L-9L</option>
                    <option value="9L-10L">9L-10L</option>
                    <option value="Above 10L">Above 10L</option>
                  </select>
                </div>

                {/* 6. Notice Period Dropdown */}
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Notice Period</label>
                  <select name="noticePeriod" value={formData.noticePeriod} onChange={handleInputChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none">
                    <option value="">Select Notice Period</option>
                    <option value="Immediate Joiner">Immediate Joiner</option>
                    <option value="1-15 days">1-15 days</option>
                    <option value="16-30 days">16-30 days</option>
                    <option value="30 to 60 days">30 to 60 days</option>
                    <option value="60 to 90 days">60 to 90 days</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg transition">Save Candidate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📧 EMAIL MODAL */}
      {showEmailModal && emailRecipient && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col">
            <div className="flex justify-between items-center mb-6 p-8 border-b">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Mail className="text-indigo-600" size={28} />
                Send Email
              </h2>
              <button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition">
                <X size={24} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-8">
              <div className="space-y-4">
                {/* Recipient Info */}
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                  <p className="text-sm text-indigo-600 font-bold mb-2">RECIPIENT</p>
                  <p className="text-lg font-bold text-slate-800">{emailRecipient.name}</p>
                  <p className="text-sm text-slate-600">{emailRecipient.email}</p>
                  <p className="text-sm text-slate-500">Position: {emailRecipient.position}</p>
                </div>

                {/* Email Type Selection */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Email Type</label>
                  <select 
                    value={emailType} 
                    onChange={(e) => setEmailType(e.target.value)}
                    className="w-full p-3 border-2 border-slate-200 rounded-lg focus:ring-2 ring-indigo-500 outline-none"
                  >
                    <option value="interview">📞 Interview Invitation</option>
                    <option value="rejection">❌ Rejection Letter</option>
                    <option value="document">📄 Document Request</option>
                    <option value="onboarding">🎯 Onboarding Welcome</option>
                    <option value="custom">✏️ Custom Message</option>
                  </select>
                </div>

                {/* CC Input */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">📋 CC (Optional)</label>
                  <input
                    type="text"
                    value={emailCC}
                    onChange={(e) => setEmailCC(e.target.value)}
                    placeholder="email1@example.com, email2@example.com"
                    className="w-full p-3 border-2 border-slate-200 rounded-lg focus:ring-2 ring-indigo-500 outline-none text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">Comma-separated email addresses</p>
                </div>

                {/* BCC Input */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">🔒 BCC (Optional)</label>
                  <input
                    type="text"
                    value={emailBCC}
                    onChange={(e) => setEmailBCC(e.target.value)}
                    placeholder="email1@example.com, email2@example.com"
                    className="w-full p-3 border-2 border-slate-200 rounded-lg focus:ring-2 ring-indigo-500 outline-none text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">Comma-separated email addresses (hidden from other recipients)</p>
                </div>

                {/* Custom Message (only for custom type) */}
                {emailType === 'custom' && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Custom Message</label>
                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder="Enter your custom message here..."
                      rows={6}
                      className="w-full p-3 border-2 border-slate-200 rounded-lg focus:ring-2 ring-indigo-500 outline-none resize-none"
                    />
                  </div>
                )}

                {/* Preview */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <p className="text-xs font-bold text-slate-500 mb-2">EMAIL PREVIEW</p>
                  {emailType === 'interview' && (
                    <p className="text-sm text-slate-700">Will send interview invitation to {emailRecipient.name} for {emailRecipient.position} position.</p>
                  )}
                  {emailType === 'rejection' && (
                    <p className="text-sm text-slate-700">Will send rejection letter to {emailRecipient.name} regarding {emailRecipient.position} position.</p>
                  )}
                  {emailType === 'document' && (
                    <p className="text-sm text-slate-700">Will request documents from {emailRecipient.name} for {emailRecipient.position} position.</p>
                  )}
                  {emailType === 'onboarding' && (
                    <p className="text-sm text-slate-700">Will send onboarding welcome to {emailRecipient.name} for {emailRecipient.position} position.</p>
                  )}
                  {emailType === 'custom' && (
                    <p className="text-sm text-slate-700">Will send custom message to {emailRecipient.name}.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 p-8 border-t bg-white">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                disabled={isSendingEmail}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendSingleEmail}
                disabled={isSendingEmail || (emailType === 'custom' && !customMessage.trim())}
                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSendingEmail ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail size={18} />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ===================== DUPLICATES MODAL ===================== */}
      {showDuplicatesModal && duplicateRecords.length > 0 && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-6xl p-8 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <AlertCircle className="text-red-600" size={28} />
                Duplicate Records ({duplicateRecords.length})
              </h2>
              <button onClick={() => setShowDuplicatesModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-slate-600 mb-4">These records were detected as duplicates and were not imported:</p>
              
              {/* Duplicates Table */}
              <div className="overflow-x-auto border-2 border-red-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-red-50 border-b-2 border-red-200 sticky top-12">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-red-700 whitespace-nowrap">Row</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700">Name</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700">Email</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700">Contact</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700">Position</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700">Company</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700 whitespace-nowrap">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicateRecords.map((record, idx) => (
                      <tr key={idx} className="border-b border-red-100 hover:bg-red-50 transition">
                        <td className="px-4 py-3 font-semibold text-slate-700">{record.row}</td>
                        <td className="px-4 py-3 text-slate-700">{record.name}</td>
                        <td className="px-4 py-3 text-slate-700 font-mono text-xs">{record.email}</td>
                        <td className="px-4 py-3 text-slate-700 font-mono text-xs">{record.contact}</td>
                        <td className="px-4 py-3 text-slate-700">{record.position}</td>
                        <td className="px-4 py-3 text-slate-700">{record.company}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                            🔄 {record.reason}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Info Box */}
              <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-amber-800 font-semibold mb-2">💡 Why were these marked as duplicates?</p>
                <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                  <li><strong>Duplicate Email:</strong> The same email address appeared more than once in your file</li>
                  <li><strong>Duplicate Contact:</strong> The same phone number appeared more than once in your file</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowDuplicatesModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Copy duplicates to clipboard as CSV
                    const csv = ['Row,Name,Email,Contact,Position,Company,Reason'].concat(
                      duplicateRecords.map(r => 
                        `${r.row},"${r.name}","${r.email}","${r.contact}","${r.position}","${r.company}","${r.reason}"`
                      )
                    ).join('\n');
                    navigator.clipboard.writeText(csv);
                    alert('✅ Duplicates copied to clipboard as CSV');
                  }}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg transition"
                >
                  📋 Copy as CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== CORRECTIONS MODAL (Field Misalignment Fixes) ===================== */}
      {showCorrectionsModal && correctionRecords.length > 0 && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-6xl p-8 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <RefreshCw className="text-green-600" size={28} />
                Field Corrections ({correctionRecords.length})
              </h2>
              <button onClick={() => setShowCorrectionsModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-slate-600 mb-4">🎯 These records had misaligned fields (e.g., email in wrong column) that were automatically corrected:</p>
              
              {/* Corrections Table */}
              <div className="overflow-x-auto border-2 border-green-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-green-50 border-b-2 border-green-200 sticky top-12">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-green-700 whitespace-nowrap">Row</th>
                      <th className="px-4 py-3 text-left font-bold text-green-700">Name</th>
                      <th className="px-4 py-3 text-left font-bold text-green-700">Email</th>
                      <th className="px-4 py-3 text-left font-bold text-green-700">Contact</th>
                      <th className="px-4 py-3 text-left font-bold text-green-700 whitespace-nowrap">Corrections Made</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correctionRecords.map((record, idx) => (
                      <tr key={idx} className="border-b border-green-100 hover:bg-green-50 transition">
                        <td className="px-4 py-3 font-semibold text-slate-700">{record.row}</td>
                        <td className="px-4 py-3 text-slate-700">{record.name}</td>
                        <td className="px-4 py-3 text-slate-700 font-mono text-xs bg-green-50 p-2 rounded">{record.email}</td>
                        <td className="px-4 py-3 text-slate-700 font-mono text-xs bg-green-50 p-2 rounded">{record.contact}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {record.corrections.map((correction, cIdx) => (
                              <div key={cIdx} className="bg-green-100 text-green-800 px-3 py-1 rounded text-xs font-semibold whitespace-nowrap">
                                ✅ {correction.description}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Info Box */}
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-green-800 font-semibold mb-2">✅ What was corrected?</p>
                <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
                  <li><strong>Email ↔ Contact Swapped:</strong> Email field had phone number and Contact field had email - they were automatically swapped</li>
                  <li><strong>Field Moved:</strong> A field contained data of wrong type (e.g., Name had email) - data was moved to correct field</li>
                  <li><strong>Misaligned:</strong> Field contains data of wrong type for that column</li>
                </ul>
                <p className="text-xs text-green-700 mt-3 italic">💡 All corrections were made automatically during import</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCorrectionsModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Copy corrections to clipboard as CSV
                    const csv = ['Row,Name,Email,Contact,Corrections'].concat(
                      correctionRecords.map(r => 
                        `${r.row},"${r.name}","${r.email}","${r.contact}","${r.corrections.map(c => c.description).join('; ')}"`
                      )
                    ).join('\n');
                    navigator.clipboard.writeText(csv);
                    alert('✅ Field corrections copied to clipboard as CSV');
                  }}
                  className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg transition"
                >
                  📋 Copy as CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== BULK EMAIL WORKFLOW MODAL ===================== */}
      {bulkEmailStep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            
            {/* SELECT STEP */}
            {bulkEmailStep === 'select' && (
              <div>
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-8 rounded-t-2xl">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-3xl font-bold mb-2">📧 Bulk Email Manager</h2>
                      <p className="text-indigo-100">Send professional emails to multiple candidates</p>
                    </div>
                    <button 
                      onClick={closeBulkEmailFlow}
                      className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="p-8">
                  {/* Email Type Selection */}
                  <div className="mb-8 bg-gradient-to-br from-slate-50 to-indigo-50 border-2 border-indigo-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
                      <span className="text-2xl">📋</span> Step 1: Select Email Type
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <label className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all transform hover:scale-105 ${
                        emailType === 'interview' 
                          ? 'border-indigo-600 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-lg' 
                          : 'border-slate-300 bg-white hover:border-indigo-400 hover:shadow-md'
                      }`}>
                        <input 
                          type="radio" 
                          name="emailType" 
                          value="interview" 
                          checked={emailType === 'interview'} 
                          onChange={(e) => setEmailType(e.target.value)}
                          className="absolute opacity-0"
                        />
                        <div className="text-center">
                          <div className="text-4xl mb-2">📞</div>
                          <div className={`font-semibold ${emailType === 'interview' ? 'text-indigo-700' : 'text-slate-700'}`}>
                            Interview Call
                          </div>
                        </div>
                        {emailType === 'interview' && (
                          <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </label>

                      <label className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all transform hover:scale-105 ${
                        emailType === 'offer' 
                          ? 'border-pink-600 bg-gradient-to-br from-pink-50 to-rose-50 shadow-lg' 
                          : 'border-slate-300 bg-white hover:border-pink-400 hover:shadow-md'
                      }`}>
                        <input 
                          type="radio" 
                          name="emailType" 
                          value="offer" 
                          checked={emailType === 'offer'} 
                          onChange={(e) => setEmailType(e.target.value)}
                          className="absolute opacity-0"
                        />
                        <div className="text-center">
                          <div className="text-4xl mb-2">💼</div>
                          <div className={`font-semibold ${emailType === 'offer' ? 'text-pink-700' : 'text-slate-700'}`}>
                            Offer Letter
                          </div>
                        </div>
                        {emailType === 'offer' && (
                          <div className="absolute top-2 right-2 bg-pink-600 text-white rounded-full w-6 h-6 flex items-center justify-center">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </label>

                      <label className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all transform hover:scale-105 ${
                        emailType === 'rejection' 
                          ? 'border-red-600 bg-gradient-to-br from-red-50 to-orange-50 shadow-lg' 
                          : 'border-slate-300 bg-white hover:border-red-400 hover:shadow-md'
                      }`}>
                        <input 
                          type="radio" 
                          name="emailType" 
                          value="rejection" 
                          checked={emailType === 'rejection'} 
                          onChange={(e) => setEmailType(e.target.value)}
                          className="absolute opacity-0"
                        />
                        <div className="text-center">
                          <div className="text-4xl mb-2">❌</div>
                          <div className={`font-semibold ${emailType === 'rejection' ? 'text-red-700' : 'text-slate-700'}`}>
                            Rejection
                          </div>
                        </div>
                        {emailType === 'rejection' && (
                          <div className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </label>

                      <label className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all transform hover:scale-105 ${
                        emailType === 'document' 
                          ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-lg' 
                          : 'border-slate-300 bg-white hover:border-blue-400 hover:shadow-md'
                      }`}>
                        <input 
                          type="radio" 
                          name="emailType" 
                          value="document" 
                          checked={emailType === 'document'} 
                          onChange={(e) => setEmailType(e.target.value)}
                          className="absolute opacity-0"
                        />
                        <div className="text-center">
                          <div className="text-4xl mb-2">📄</div>
                          <div className={`font-semibold ${emailType === 'document' ? 'text-blue-700' : 'text-slate-700'}`}>
                            Documents
                          </div>
                        </div>
                        {emailType === 'document' && (
                          <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </label>

                      <label className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all transform hover:scale-105 ${
                        emailType === 'onboarding' 
                          ? 'border-green-600 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg' 
                          : 'border-slate-300 bg-white hover:border-green-400 hover:shadow-md'
                      }`}>
                        <input 
                          type="radio" 
                          name="emailType" 
                          value="onboarding" 
                          checked={emailType === 'onboarding'} 
                          onChange={(e) => setEmailType(e.target.value)}
                          className="absolute opacity-0"
                        />
                        <div className="text-center">
                          <div className="text-4xl mb-2">🎯</div>
                          <div className={`font-semibold ${emailType === 'onboarding' ? 'text-green-700' : 'text-slate-700'}`}>
                            Onboarding
                          </div>
                        </div>
                        {emailType === 'onboarding' && (
                          <div className="absolute top-2 right-2 bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </label>

                      <label className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all transform hover:scale-105 ${
                        emailType === 'custom' 
                          ? 'border-purple-600 bg-gradient-to-br from-purple-50 to-fuchsia-50 shadow-lg' 
                          : 'border-slate-300 bg-white hover:border-purple-400 hover:shadow-md'
                      }`}>
                        <input 
                          type="radio" 
                          name="emailType" 
                          value="custom" 
                          checked={emailType === 'custom'} 
                          onChange={(e) => setEmailType(e.target.value)}
                          className="absolute opacity-0"
                        />
                        <div className="text-center">
                          <div className="text-4xl mb-2">✏️</div>
                          <div className={`font-semibold ${emailType === 'custom' ? 'text-purple-700' : 'text-slate-700'}`}>
                            Custom
                          </div>
                        </div>
                        {emailType === 'custom' && (
                          <div className="absolute top-2 right-2 bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-600 p-5 rounded-xl shadow-sm">
                      <div className="text-sm text-blue-700 font-semibold mb-1">TOTAL CANDIDATES</div>
                      <div className="text-3xl font-bold text-blue-900">
                        {candidates.filter(c => selectedIds.includes(c._id) && c.email).length}
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-600 p-5 rounded-xl shadow-sm">
                      <div className="text-sm text-green-700 font-semibold mb-1">VALID EMAILS</div>
                      <div className="text-3xl font-bold text-green-900">
                        {candidates.filter(c => selectedIds.includes(c._id) && c.email && c.email.includes('@')).length}
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-l-4 border-indigo-600 p-5 rounded-xl shadow-sm">
                      <div className="text-sm text-indigo-700 font-semibold mb-1">SELECTED</div>
                      <div className="text-3xl font-bold text-indigo-900">{selectedEmails.size}</div>
                    </div>
                  </div>

                  {/* Candidate Selection Table */}
                  <div className="mb-8">
                    <h3 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
                      <span className="text-2xl">👥</span> Step 2: Select Recipients
                    </h3>
                    <div className="border-2 border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="max-h-96 overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white sticky top-0 z-10">
                            <tr>
                              <th className="p-4 text-center w-16">
                                <input 
                                  type="checkbox" 
                                  checked={selectedEmails.size === candidates.filter(c => selectedIds.includes(c._id) && c.email).length && selectedEmails.size > 0}
                                  onChange={selectAllEmails}
                                  className="w-5 h-5 cursor-pointer accent-white"
                                />
                              </th>
                              <th className="p-4 text-left font-semibold">Name</th>
                              <th className="p-4 text-left font-semibold">Email</th>
                              <th className="p-4 text-left font-semibold">Position</th>
                              <th className="p-4 text-left font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {candidates
                              .filter(c => selectedIds.includes(c._id) && c.email)
                              .map((candidate, idx) => (
                                <tr key={candidate._id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50 transition`}>
                                  <td className="p-4 text-center">
                                    <input 
                                      type="checkbox" 
                                      checked={selectedEmails.has(candidate.email)}
                                      onChange={() => toggleEmailSelection(candidate.email)}
                                      className="w-5 h-5 cursor-pointer accent-indigo-600"
                                    />
                                  </td>
                                  <td className="p-4 font-medium text-slate-800">{candidate.name}</td>
                                  <td className="p-4">
                                    <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                      </svg>
                                      {candidate.email}
                                    </span>
                                  </td>
                                  <td className="p-4 text-slate-600">{candidate.position || 'N/A'}</td>
                                  <td className="p-4">
                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                      candidate.status === 'Hired' ? 'bg-green-100 text-green-700' :
                                      candidate.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                      candidate.status === 'Interview' ? 'bg-blue-100 text-blue-700' :
                                      'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {candidate.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {selectedEmails.size === 0 && (
                      <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
                        <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-yellow-800 font-medium">Please select at least one recipient to continue</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-6 border-t-2 border-slate-200">
                    <button 
                      onClick={closeBulkEmailFlow}
                      className="flex items-center gap-2 px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition font-semibold shadow-sm"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Cancel
                    </button>
                    <button 
                      onClick={() => setBulkEmailStep('confirm')}
                      disabled={selectedEmails.size === 0}
                      className={`flex items-center gap-2 px-8 py-3 rounded-xl transition font-semibold shadow-lg transform hover:scale-105 ${
                        selectedEmails.size === 0 
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                      }`}
                    >
                      Next: Confirm
                      <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm">
                        {selectedEmails.size} selected
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CONFIRM STEP */}
            {bulkEmailStep === 'confirm' && (
              <div>
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-8 rounded-t-2xl">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-3xl font-bold mb-2">⚠️ Confirm Sending</h2>
                      <p className="text-orange-100">Review your campaign before sending</p>
                    </div>
                    <button 
                      onClick={closeBulkEmailFlow}
                      className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="p-8">
                  {/* Campaign Summary */}
                  <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-300 rounded-2xl p-8 mb-8 shadow-lg">
                    <div className="text-center mb-6">
                      <div className="text-6xl mb-4">🚀</div>
                      <p className="text-2xl font-bold text-slate-800 mb-2">
                        Ready to send <span className="text-indigo-600">{selectedEmails.size}</span> emails
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <span className="text-slate-600 text-lg">Email Type:</span>
                        <span className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl text-xl font-bold shadow-lg">
                          {emailType === 'interview' ? '📞 Interview Call' :
                           emailType === 'offer' ? '💼 Offer Letter' :
                           emailType === 'rejection' ? '❌ Rejection' :
                           emailType === 'document' ? '📄 Document Collection' :
                           emailType === 'onboarding' ? '🎯 Onboarding' :
                           '✏️ Custom Email'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white rounded-xl p-5 shadow-sm text-center border-2 border-blue-200">
                        <div className="text-3xl mb-2">📊</div>
                        <div className="text-sm text-slate-600 mb-1">Processing Speed</div>
                        <div className="text-lg font-bold text-blue-600">Batch Mode</div>
                      </div>
                      <div className="bg-white rounded-xl p-5 shadow-sm text-center border-2 border-green-200">
                        <div className="text-3xl mb-2">⏱️</div>
                        <div className="text-sm text-slate-600 mb-1">Estimated Time</div>
                        <div className="text-lg font-bold text-green-600">~{Math.ceil(selectedEmails.size / 5)}s</div>
                      </div>
                      <div className="bg-white rounded-xl p-5 shadow-sm text-center border-2 border-purple-200">
                        <div className="text-3xl mb-2">🔒</div>
                        <div className="text-sm text-slate-600 mb-1">Service</div>
                        <div className="text-lg font-bold text-purple-600">AWS SES</div>
                      </div>
                    </div>

                    <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
                      <p className="text-sm text-blue-800 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span><strong>Note:</strong> Each email will be sent once. Make sure all information is correct before proceeding.</span>
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-6 border-t-2 border-slate-200">
                    <button 
                      onClick={() => setBulkEmailStep('select')}
                      className="flex items-center gap-2 px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition font-semibold shadow-sm"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Back
                    </button>
                    <button 
                      onClick={handleConfirmSend}
                      disabled={isSendingEmail}
                      className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition font-bold shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {isSendingEmail ? (
                        <>
                          <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Send All Emails Now
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SENDING STEP */}
            {bulkEmailStep === 'sending' && campaignStatus && (
              <div>
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-8 rounded-t-2xl">
                  <div className="text-center">
                    <div className="text-6xl mb-4 animate-bounce">⏳</div>
                    <h2 className="text-3xl font-bold mb-2">Sending In Progress</h2>
                    <p className="text-blue-100">Please wait while we send your emails...</p>
                  </div>
                </div>

                <div className="p-8">
                  <div className="bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-blue-200 rounded-2xl p-8 shadow-lg">
                    <p className="text-2xl font-bold mb-8 text-center text-slate-800">
                      🚀 Sending {campaignStatus.totalEmails} emails in real-time
                    </p>

                    {/* Progress Bar */}
                    <div className="mb-8">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-lg font-semibold text-slate-700">Overall Progress</span>
                        <span className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                          {Math.min(100, Math.round(((campaignStatus.completed + campaignStatus.failed) / campaignStatus.totalEmails) * 100))}%
                        </span>
                      </div>
                      <div className="h-10 bg-slate-200 rounded-full overflow-hidden shadow-inner relative">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500 flex items-center justify-center text-white font-bold relative overflow-hidden"
                          style={{ width: `${Math.min(100, ((campaignStatus.completed + campaignStatus.failed) / campaignStatus.totalEmails) * 100)}%` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
                          {Math.min(100, ((campaignStatus.completed + campaignStatus.failed) / campaignStatus.totalEmails) * 100) > 20 && (
                            <span className="relative z-10">{campaignStatus.completed + campaignStatus.failed} / {campaignStatus.totalEmails}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500 p-6 rounded-xl shadow-md transform hover:scale-105 transition">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-blue-700 font-semibold">QUEUED</span>
                          <span className="text-2xl">⏯️</span>
                        </div>
                        <div className="text-4xl font-bold text-blue-600">{campaignStatus.waiting || 0}</div>
                      </div>
                      <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-l-4 border-yellow-500 p-6 rounded-xl shadow-md transform hover:scale-105 transition">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-yellow-700 font-semibold">PROCESSING</span>
                          <span className="text-2xl">⏳</span>
                        </div>
                        <div className="text-4xl font-bold text-yellow-600">{campaignStatus.processing || 0}</div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500 p-6 rounded-xl shadow-md transform hover:scale-105 transition">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-green-700 font-semibold">SENT</span>
                          <span className="text-2xl">✅</span>
                        </div>
                        <div className="text-4xl font-bold text-green-600">{campaignStatus.completed || 0}</div>
                      </div>
                      <div className="bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500 p-6 rounded-xl shadow-md transform hover:scale-105 transition">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-red-700 font-semibold">FAILED</span>
                          <span className="text-2xl">❌</span>
                        </div>
                        <div className="text-4xl font-bold text-red-600">{campaignStatus.failed || 0}</div>
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="inline-flex items-center gap-2 bg-white px-6 py-3 rounded-full shadow-sm">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm text-slate-600">Processing emails... Please wait</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RESULTS STEP */}
            {bulkEmailStep === 'results' && campaignStatus && (
              <div>
                {/* Header */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-8 rounded-t-2xl">
                  <div className="text-center">
                    <div className="text-7xl mb-4 animate-bounce">✨</div>
                    <h2 className="text-3xl font-bold mb-2">Campaign Complete!</h2>
                    <p className="text-green-100">Your bulk email campaign has finished processing</p>
                  </div>
                </div>

                <div className="p-8">
                  {/* Success Banner */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-2xl p-8 mb-8 shadow-lg text-center">
                    <div className="text-8xl mb-6">🎉</div>
                    <h3 className="text-3xl font-bold text-green-800 mb-3">
                      Bulk Email Campaign Finished!
                    </h3>
                    <p className="text-lg text-green-700">
                      All emails have been processed successfully
                    </p>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-300 rounded-2xl p-8 text-center shadow-md transform hover:scale-105 transition">
                      <div className="text-5xl mb-4">📊</div>
                      <div className="text-sm text-slate-600 font-semibold mb-2">TOTAL EMAILS</div>
                      <div className="text-5xl font-bold text-slate-800">{campaignStatus.totalEmails || 0}</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-400 rounded-2xl p-8 text-center shadow-md transform hover:scale-105 transition">
                      <div className="text-5xl mb-4">✅</div>
                      <div className="text-sm text-green-700 font-semibold mb-2">SUCCESSFULLY SENT</div>
                      <div className="text-5xl font-bold text-green-700">{campaignStatus.completed || 0}</div>
                    </div>
                    <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-400 rounded-2xl p-8 text-center shadow-md transform hover:scale-105 transition">
                      <div className="text-5xl mb-4">❌</div>
                      <div className="text-sm text-red-700 font-semibold mb-2">FAILED</div>
                      <div className="text-5xl font-bold text-red-700">{campaignStatus.failed || 0}</div>
                    </div>
                  </div>

                  {/* Success Rate */}
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300 rounded-2xl p-6 mb-8 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-5xl">📈</div>
                        <div>
                          <div className="text-sm text-slate-600 font-semibold mb-1">SUCCESS RATE</div>
                          <div className="text-slate-700 text-lg">Overall campaign performance</div>
                        </div>
                      </div>
                      <div className="text-6xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        {campaignStatus.successRate || '0%'}
                      </div>
                    </div>
                  </div>

                  {/* Email Type Badge */}
                  <div className="bg-white border-2 border-slate-200 rounded-xl p-6 mb-8 shadow-sm">
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-slate-600 text-lg font-semibold">Email Type:</span>
                      <span className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl text-xl font-bold shadow-lg">
                        {emailType === 'interview' ? '📞 Interview Call' :
                         emailType === 'offer' ? '💼 Offer Letter' :
                         emailType === 'rejection' ? '❌ Rejection' :
                         emailType === 'document' ? '📄 Document Collection' :
                         emailType === 'onboarding' ? '🎯 Onboarding' :
                         '✏️ Custom Email'}
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="flex justify-center pt-6 border-t-2 border-slate-200">
                    <button 
                      onClick={closeBulkEmailFlow}
                      className="flex items-center gap-3 px-12 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition font-bold text-lg shadow-xl transform hover:scale-105"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Done - Close Window
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ✅ REVIEW & FIX MODAL */}
      {showReviewModal && reviewData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full my-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-8 rounded-2xl mb-6 shadow-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-4xl font-bold mb-2">📋 Review & Import Candidates</h1>
                  <p className="text-lg text-indigo-100">✅ Ready: {reviewData.ready?.length || 0} | ⚠️ Review: {reviewData.review?.length || 0} | ❌ Blocked: {reviewData.blocked?.length || 0}</p>
                </div>
                <button 
                  onClick={() => { setShowReviewModal(false); setReviewData(null); setEditingRow(null); }} 
                  className="text-white hover:bg-white/20 p-3 rounded-lg text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b-2 border-slate-200 bg-white p-4 rounded-t-xl shadow">
              {[
                { key: 'ready', label: `✅ Ready (${reviewData.ready?.length || 0})`, color: 'bg-green-50 border-green-300 text-green-700' },
                { key: 'review', label: `⚠️ Review (${reviewData.review?.length || 0})`, color: 'bg-amber-50 border-amber-300 text-amber-700' },
                { key: 'blocked', label: `❌ Blocked (${reviewData.blocked?.length || 0})`, color: 'bg-red-50 border-red-300 text-red-700' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setReviewFilter(tab.key); setEditingRow(null); }}
                  className={`px-6 py-3 rounded-lg font-bold text-lg transition ${
                    reviewFilter === tab.key 
                      ? 'bg-indigo-600 text-white shadow-lg transform scale-105' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="bg-white rounded-b-xl shadow-lg p-6 min-h-96 max-h-[70vh] overflow-y-auto">
              {(() => {
                let categoryData;
                if (reviewFilter === 'ready') {
                  categoryData = reviewData.ready;
                } else if (reviewFilter === 'review') {
                  categoryData = reviewData.review;
                } else if (reviewFilter === 'blocked') {
                  categoryData = reviewData.blocked;
                } else { // 'all' - show all records
                  categoryData = [
                    ...(reviewData.ready || []),
                    ...(reviewData.review || []),
                    ...(reviewData.blocked || [])
                  ];
                }
                
                if (!categoryData || categoryData.length === 0) {
                  return <p className="text-slate-500 text-center py-12 text-lg">📭 No records in this category</p>;
                }

                return (
                  <div className="space-y-4">
                    {/* Records Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b-2 border-slate-300">
                            <th className="px-4 py-3 text-left font-bold text-slate-700">Name</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-700">Email</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-700">Contact</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-700">Position</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-700">CTC</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-700">Status</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-700">Confidence</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryData.map((row, idx) => (
                            <tr key={idx} className={`border-b hover:bg-slate-50 transition ${
                              row.validation.category === 'ready' ? 'bg-green-50' :
                              row.validation.category === 'review' ? 'bg-amber-50' :
                              'bg-red-50'
                            }`}>
                              <td className="px-4 py-3 font-semibold">{row.fixed?.name || '-'}</td>
                              <td className="px-4 py-3 text-sm">{row.fixed?.email || '-'}</td>
                              <td className="px-4 py-3 text-sm">{row.fixed?.contact || '-'}</td>
                              <td className="px-4 py-3 text-sm">{row.fixed?.position || '-'}</td>
                              <td className="px-4 py-3 text-sm">{row.fixed?.ctc ? `${row.fixed.ctc} LPA` : '-'}</td>
                              <td className="px-4 py-3 text-sm">{row.fixed?.status || '-'}</td>
                              <td className="px-4 py-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  row.validation.confidence >= 80 ? 'bg-green-200 text-green-800' :
                                  row.validation.confidence >= 50 ? 'bg-amber-200 text-amber-800' :
                                  'bg-red-200 text-red-800'
                                }`}>
                                  {row.validation.confidence}%
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setEditingRow(row)}
                                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition font-semibold"
                                >
                                  ✏️ Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Editing Panel */}
                    {editingRow && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl max-h-96 overflow-y-auto">
                          <h3 className="text-2xl font-bold mb-6">Edit & Save Record - {editingRow.fixed?.name}</h3>
                          
                          <div className="grid grid-cols-3 gap-4 mb-6">
                            {[
                              { field: 'name', label: 'Name', type: 'text' },
                              { field: 'email', label: 'Email', type: 'email' },
                              { field: 'contact', label: 'Contact', type: 'tel' },
                              { field: 'position', label: 'Position', type: 'text' },
                              { field: 'experience', label: 'Experience', type: 'text' },
                              { field: 'ctc', label: 'CTC (LPA)', type: 'text' },
                              { field: 'expectedCtc', label: 'Expected CTC', type: 'text' },
                              { field: 'noticePeriod', label: 'Notice Period', type: 'text' },
                              { field: 'companyName', label: 'Company', type: 'text' },
                              { field: 'location', label: 'Location', type: 'text' },
                              { field: 'client', label: 'Client', type: 'text' },
                              { field: 'source', label: 'Source', type: 'text' },
                              { field: 'fls', label: 'FLS/Non FLS', type: 'text' },
                              { field: 'spoc', label: 'SPOC', type: 'text' },
                              { field: 'date', label: 'Date', type: 'date' },
                              { field: 'status', label: 'Status', type: 'select' }
                            ].map(({ field, label, type }) => (
                              <div key={field}>
                                <label className="block text-xs font-bold text-slate-600 mb-1">{label}</label>
                                {type === 'select' ? (
                                  <select
                                    value={editingRow.fixed?.[field] || ''}
                                    onChange={(e) => setEditingRow({ ...editingRow, fixed: { ...editingRow.fixed, [field]: e.target.value } })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:border-blue-600"
                                  >
                                    <option value="">Select Status</option>
                                    {['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected', 'Interested', 'Interested and scheduled'].map(s => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type={type}
                                    value={editingRow.fixed?.[field] || ''}
                                    onChange={(e) => setEditingRow({ ...editingRow, fixed: { ...editingRow.fixed, [field]: e.target.value } })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:border-blue-600"
                                  />
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Validation Summary */}
                          {editingRow.validation && (
                            <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                              {editingRow.validation.errors?.length > 0 && (
                                <div className="mb-3">
                                  <p className="font-bold text-red-700 mb-1">❌ Errors:</p>
                                  {editingRow.validation.errors.map((e, i) => (
                                    <p key={i} className="text-sm text-red-600">• {e.field}: {e.message}</p>
                                  ))}
                                </div>
                              )}
                              {editingRow.validation.warnings?.length > 0 && (
                                <div>
                                  <p className="font-bold text-amber-700 mb-1">⚠️ Warnings:</p>
                                  {editingRow.validation.warnings.map((w, i) => (
                                    <p key={i} className="text-sm text-amber-600">• {w.field}: {w.message}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleSaveEditedRecord()}
                              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-bold hover:from-green-700 hover:to-emerald-700 transition text-base shadow-lg"
                            >
                              ✅ Save & Import Now
                            </button>
                            <button
                              onClick={() => handleRevalidateRecord(editingRow)}
                              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition text-base"
                            >
                              🔄 Re-validate
                            </button>
                            <button
                              onClick={() => setEditingRow(null)}
                              className="flex-1 px-4 py-3 bg-slate-400 text-white rounded-lg font-bold hover:bg-slate-500 transition text-base"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Import Confirmation Modal */}
            {importConfirmation?.show && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center animate-in fade-in scale-in">
                  <div className="mb-6">
                    <div className="text-6xl mb-4 animate-bounce">✅</div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Success!</h3>
                    <p className="text-slate-600 text-lg">
                      <strong>{importConfirmation.candidateName}</strong>
                    </p>
                    <p className="text-slate-600 mt-2">
                      has been successfully sent to database
                    </p>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-4 mb-6">
                    <p className="text-sm text-green-700 font-semibold">
                      💾 Candidate record saved and imported
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setImportConfirmation(null);
                      setReviewFilter('ready'); // Reset to Ready tab to show updated data
                    }}
                    className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-bold hover:from-green-700 hover:to-emerald-700 transition text-base shadow-lg"
                  >
                    OK, Continue
                  </button>
                </div>
              </div>
            )}

            {/* Footer Action Buttons */}
            <div className="flex gap-4 mt-6 justify-end">
              <button
                onClick={() => { setShowReviewModal(false); setReviewData(null); setEditingRow(null); }}
                className="px-8 py-3 bg-slate-400 text-white rounded-lg font-bold hover:bg-slate-500 transition text-lg"
              >
                ✕ Close
              </button>
              <button
                onClick={handleImportReviewed}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-bold hover:from-green-600 hover:to-emerald-700 transition text-lg shadow-lg"
              >
                ✅ Import All Ready Records
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});

ATS.displayName = 'ATS';

export default ATS;



