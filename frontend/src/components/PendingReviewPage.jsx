import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, CheckCircle, Trash2, Edit2, RefreshCw, Save, X, Search, ChevronLeft, ChevronRight, Upload, Loader2, AlertTriangle } from 'lucide-react';
import Layout from './Layout';
import BASE_API_URL from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import ConfirmationModal from './ConfirmationModal';

const RECORDS_PER_PAGE = 50;

const PendingReviewPage = () => {
  const toast = useToast();
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [stats, setStats] = useState({ review: 0, blocked: 0, total: 0 });
  const [selectedIds, setSelectedIds] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });

  const fetchPendingCandidates = async (page = 1, category = activeTab, search = searchQuery) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: RECORDS_PER_PAGE.toString(),
        ...(category !== 'all' && { category }),
        ...(search && { search })
      });

      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/pending?${params}`);
      if (isUnauthorized(response)) { handleUnauthorized(); return; }

      const data = await response.json();
      if (data.success) {
        setCandidates(data.candidates || []);
        setTotalRecords(data.total || 0);
        setStats(data.stats || { review: 0, blocked: 0, total: 0 });
      }
    } catch (error) {
      toast.error('Failed to load pending records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPendingCandidates(); }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSelectedIds([]);
    fetchPendingCandidates(1, tab, searchQuery);
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
    fetchPendingCandidates(1, activeTab, e.target.value);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchPendingCandidates(page, activeTab, searchQuery);
  };

  const handleEdit = (candidate) => {
    setEditingId(candidate._id);
    setEditData({ ...candidate });
  };

  const handleSave = async (id) => {
    try {
      setIsSaving(true);
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/pending/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editData.name, email: editData.email, contact: editData.contact,
          position: editData.position, companyName: editData.companyName,
          location: editData.location, ctc: editData.ctc, experience: editData.experience,
          noticePeriod: editData.noticePeriod, status: editData.status,
          source: editData.source, remark: editData.remark
        })
      });

      if (!response.ok) throw new Error('Failed to save');
      setEditingId(null);
      setEditData(null);
      toast.success('Record updated');
      fetchPendingCandidates(currentPage, activeTab, searchQuery);
    } catch (error) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (ids) => {
    const count = Array.isArray(ids) ? ids.length : 1;
    const idsArray = Array.isArray(ids) ? ids : [ids];

    setConfirmModal({
      isOpen: true, type: 'delete',
      title: `Delete ${count} Record${count > 1 ? 's' : ''}`,
      message: `Are you sure you want to delete ${count} pending record${count > 1 ? 's' : ''}? This cannot be undone.`,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          const res = await authenticatedFetch(`${BASE_API_URL}/candidates/pending/delete`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: idsArray })
          });
          const data = await res.json();
          if (data.success) {
            toast.success(`Deleted ${data.deletedCount} record(s)`);
            setSelectedIds([]);
            fetchPendingCandidates(currentPage, activeTab, searchQuery);
          }
        } catch { toast.error('Failed to delete'); }
        finally { setConfirmModal({ isOpen: false }); }
      }
    });
  };

  const handleImportSelected = () => {
    if (selectedIds.length === 0) { toast.warning('Select records to import'); return; }

    setConfirmModal({
      isOpen: true, type: 'success',
      title: `Import ${selectedIds.length} Record${selectedIds.length > 1 ? 's' : ''}`,
      message: `Import ${selectedIds.length} selected record${selectedIds.length > 1 ? 's' : ''} to the main candidate database? Records with missing required fields may fail.`,
      confirmText: `Import ${selectedIds.length}`,
      onConfirm: async () => {
        setConfirmModal({ isOpen: false });
        setIsImporting(true);
        try {
          const res = await authenticatedFetch(`${BASE_API_URL}/candidates/pending/import`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedIds })
          });
          const data = await res.json();
          if (data.success) {
            toast.success(`Imported ${data.imported} records to database`);
            if (data.failed > 0) toast.warning(`${data.failed} records failed to import`);
            setSelectedIds([]);
            fetchPendingCandidates(currentPage, activeTab, searchQuery);
          } else {
            toast.error(data.message || 'Import failed');
          }
        } catch { toast.error('Import failed'); }
        finally { setIsImporting(false); }
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === candidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(candidates.map(c => c._id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const totalPages = Math.ceil(totalRecords / RECORDS_PER_PAGE);

  const fields = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'contact', label: 'Contact' },
    { key: 'position', label: 'Position' },
    { key: 'companyName', label: 'Company' },
    { key: 'location', label: 'Location' },
    { key: 'ctc', label: 'CTC' },
    { key: 'experience', label: 'Exp' },
    { key: 'noticePeriod', label: 'NP' }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-full mx-auto">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={28} />
                  Pending Review
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Records from auto import that need review or have issues. Fix and import when ready.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Data stays here until you import to All Candidates or delete. Importing the same email again updates the existing candidate (no duplicates).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => fetchPendingCandidates(currentPage, activeTab, searchQuery)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                  <RefreshCw size={16} /> Refresh
                </button>
                {selectedIds.length > 0 && (
                  <>
                    <button onClick={handleImportSelected} disabled={isImporting}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2 disabled:opacity-50">
                      {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      Import {selectedIds.length} to Database
                    </button>
                    <button onClick={() => handleDelete(selectedIds)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-2">
                      <Trash2 size={16} /> Delete {selectedIds.length}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="w-2 h-2 bg-amber-500 rounded-full" />
                <span className="text-sm font-medium text-amber-700">Review: {stats.review}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span className="text-sm font-medium text-red-700">Blocked: {stats.blocked}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                <span className="text-sm font-medium text-gray-600">Total: {stats.total}</span>
              </div>
            </div>

            {/* Tabs + Search */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-4 pt-4 border-t border-gray-100">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {[
                  { key: 'all', label: `All (${stats.total})` },
                  { key: 'review', label: `Review (${stats.review})` },
                  { key: 'blocked', label: `Blocked (${stats.blocked})` }
                ].map(tab => (
                  <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === tab.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={searchQuery} onChange={handleSearch}
                  placeholder="Search records..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 size={32} className="animate-spin text-blue-600" />
              </div>
            ) : candidates.length === 0 ? (
              <div className="text-center py-20">
                <CheckCircle size={48} className="mx-auto text-green-500 mb-3" />
                <h2 className="text-xl font-semibold text-gray-800 mb-1">No pending records</h2>
                <p className="text-sm text-gray-500">All records have been resolved or there are no auto-imported review/blocked records.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-3 text-left">
                          <input type="checkbox" checked={selectedIds.length === candidates.length && candidates.length > 0}
                            onChange={toggleSelectAll} className="rounded border-gray-300" />
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                        {fields.map(f => (
                          <th key={f.key} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{f.label}</th>
                        ))}
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Issues</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {candidates.map(c => (
                        <tr key={c._id} className={`hover:bg-gray-50 ${selectedIds.includes(c._id) ? 'bg-blue-50/50' : ''}`}>
                          <td className="px-3 py-2.5">
                            <input type="checkbox" checked={selectedIds.includes(c._id)}
                              onChange={() => toggleSelect(c._id)} className="rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${c.category === 'review' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                              {c.category === 'review' ? 'Review' : 'Blocked'}
                            </span>
                          </td>
                          {editingId === c._id ? (
                            <>
                              {fields.map(f => (
                                <td key={f.key} className="px-2 py-1.5">
                                  <input type="text" value={editData?.[f.key] || ''} onChange={(e) => setEditData(prev => ({ ...prev, [f.key]: e.target.value }))}
                                    className="w-full px-2 py-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                </td>
                              ))}
                              <td className="px-3 py-2.5 text-xs text-gray-400">-</td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => handleSave(c._id)} disabled={isSaving}
                                    className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                  </button>
                                  <button onClick={() => { setEditingId(null); setEditData(null); }}
                                    className="p-1.5 bg-gray-400 text-white rounded hover:bg-gray-500">
                                    <X size={14} />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              {fields.map(f => (
                                <td key={f.key} className="px-3 py-2.5 text-xs text-gray-700 max-w-[150px] truncate" title={c[f.key] || ''}>
                                  {c[f.key] || <span className="text-gray-300">-</span>}
                                </td>
                              ))}
                              <td className="px-3 py-2.5">
                                {(c.validationErrors?.length > 0) && (
                                  <span className="text-xs text-red-500" title={c.validationErrors.map(e => e.message || e).join(', ')}>
                                    {c.validationErrors.length} error{c.validationErrors.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => handleEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                                    <Edit2 size={14} />
                                  </button>
                                  <button onClick={() => handleDelete(c._id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Delete">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Showing {((currentPage - 1) * RECORDS_PER_PAGE) + 1}-{Math.min(currentPage * RECORDS_PER_PAGE, totalRecords)} of {totalRecords}
                    </p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}
                        className="p-1.5 border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronLeft size={16} />
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) pageNum = i + 1;
                        else if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;
                        return (
                          <button key={pageNum} onClick={() => handlePageChange(pageNum)}
                            className={`w-8 h-8 text-xs rounded ${pageNum === currentPage ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'}`}>
                            {pageNum}
                          </button>
                        );
                      })}
                      <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages}
                        className="p-1.5 border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Help */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">How to use this page</h3>
            <ul className="text-xs text-blue-700 space-y-1 list-disc ml-4">
              <li>These records were flagged during auto import as needing review or having missing data.</li>
              <li>Click "Edit" to fix any fields, then save your changes.</li>
              <li>Select records using checkboxes, then click "Import to Database" to move them to your main candidates.</li>
              <li>Delete records you don't need anymore.</li>
            </ul>
          </div>
        </div>

        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          type={confirmModal.type}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal({ isOpen: false })}
        />
      </div>
    </Layout>
  );
};

export default PendingReviewPage;
