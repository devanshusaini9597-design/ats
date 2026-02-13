import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Trash2, Edit2, RefreshCw, Save, X } from 'lucide-react';
import Layout from './Layout';
import BASE_API_URL from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';

const PendingReviewPage = () => {
  const toast = useToast();
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch candidates that need review
  const fetchPendingCandidates = async () => {
    try {
      setIsLoading(true);
      console.log('📋 Fetching pending review candidates...');
      
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates?limit=1000`);
      
      if (isUnauthorized(response)) {
        handleUnauthorized();
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      console.log('✅ Fetched response:', data);
      
      // Get candidates from response (could be data.candidates or data.data or just data)
      const allCandidates = data.candidates || data.data || data || [];
      console.log('✅ Fetched candidates:', allCandidates.length);
      
      // Filter candidates that need review:
      // 1. Marked with needsReview flag or Pending Review status
      // 2. Missing critical fields
      const pendingCandidates = (Array.isArray(allCandidates) ? allCandidates : []).filter(c => 
        c.status === 'Pending Review' || 
        c.needsReview === true ||
        !c.name || 
        !c.email || 
        !c.contact || 
        !c.position || 
        !c.experience || 
        !c.ctc
      );
      
      console.log('⚠️ Pending review count:', pendingCandidates.length);
      setCandidates(pendingCandidates);
    } catch (error) {
      console.error('❌ Error fetching:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingCandidates();
  }, []);

  const handleEdit = (candidate) => {
    setEditingId(candidate._id);
    setEditData({ ...candidate });
  };

  const handleSave = async (id) => {
    try {
      setIsSaving(true);
      console.log('💾 Saving candidate:', editData);

      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });

      if (!response.ok) throw new Error('Failed to save');

      const updated = await response.json();
      console.log('✅ Candidate updated:', updated);

      // Remove from pending list after saving
      setCandidates(candidates.filter(c => c._id !== id));
      setEditingId(null);
      setEditData(null);
      toast.success('Candidate updated successfully!');
    } catch (error) {
      console.error('❌ Error saving:', error);
      toast.error('Failed to save: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this candidate?')) return;

    try {
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete');

      setCandidates(candidates.filter(c => c._id !== id));
      console.log('✅ Candidate deleted');
    } catch (error) {
      console.error('❌ Error deleting:', error);
      toast.error('Failed to delete: ' + error.message);
    }
  };

  const sidebarActions = {};

  return (
    <Layout sidebarActions={sidebarActions}>
      <div className="w-full bg-gradient-to-br from-slate-50 to-indigo-50 min-h-screen p-6">
        
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-8">
          <div className="bg-gradient-to-r from-amber-600 to-red-600 text-white p-8 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <AlertCircle size={40} />
                <div>
                  <h1 className="text-4xl font-bold">⚠️ Pending Review</h1>
                  <p className="text-amber-100 mt-2">Candidates with incomplete or missing information</p>
                </div>
              </div>
              <button
                onClick={fetchPendingCandidates}
                className="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition"
              >
                <RefreshCw size={20} />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-amber-500">
              <p className="text-slate-600 text-sm font-semibold">Pending Review</p>
              <p className="text-4xl font-bold text-amber-600 mt-2">{candidates.length}</p>
              <p className="text-xs text-slate-500 mt-2">Need completion</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
              <p className="text-slate-600 text-sm font-semibold">Missing Fields</p>
              <p className="text-4xl font-bold text-blue-600 mt-2">📋</p>
              <p className="text-xs text-slate-500 mt-2">Check individual records</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
              <p className="text-slate-600 text-sm font-semibold">Quick Action</p>
              <p className="text-sm text-green-600 font-bold mt-2">Edit → Save → Done</p>
              <p className="text-xs text-slate-500 mt-2">Each field can be fixed</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-96">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent"></div>
            </div>
          ) : candidates.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <CheckCircle size={64} className="mx-auto text-green-600 mb-4" />
              <h2 className="text-2xl font-bold text-slate-800 mb-2">✅ All Caught Up!</h2>
              <p className="text-slate-600">No candidates pending review. All records are complete!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {candidates.map((candidate) => (
                <div key={candidate._id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition">
                  
                  {/* Candidate Row */}
                  {editingId !== candidate._id ? (
                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <p className="text-xs text-slate-500 font-semibold uppercase">Name</p>
                              <p className="text-lg font-bold text-slate-800">
                                {candidate.name || <span className="text-red-500">❌ Missing</span>}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-semibold uppercase">Email</p>
                              <p className="text-sm text-slate-700 break-all">
                                {candidate.email || <span className="text-red-500">❌ Missing</span>}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-semibold uppercase">Contact</p>
                              <p className="text-sm text-slate-700">
                                {candidate.contact || <span className="text-red-500">❌ Missing</span>}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-semibold uppercase">Position</p>
                              <p className="text-sm text-slate-700">
                                {candidate.position || <span className="text-red-500">❌ Missing</span>}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-slate-500 font-semibold uppercase">Experience</p>
                              <p className="text-sm text-slate-700">
                                {candidate.experience || <span className="text-red-500">❌ Missing</span>}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-semibold uppercase">CTC</p>
                              <p className="text-sm text-slate-700">
                                {candidate.ctc || <span className="text-red-500">❌ Missing</span>}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-semibold uppercase">Status</p>
                              <p className="text-sm font-bold text-amber-600">{candidate.status || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-semibold uppercase">Missing Fields</p>
                              <p className="text-sm font-bold text-red-600">
                                {[
                                  !candidate.name && 'Name',
                                  !candidate.email && 'Email',
                                  !candidate.contact && 'Contact',
                                  !candidate.position && 'Position',
                                  !candidate.experience && 'Exp',
                                  !candidate.ctc && 'CTC'
                                ].filter(f => f).join(', ') || 'None'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEdit(candidate)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-bold flex items-center gap-2 transition"
                          >
                            <Edit2 size={18} />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(candidate._id)}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-bold flex items-center gap-2 transition"
                          >
                            <Trash2 size={18} />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Edit Mode */
                    <div className="p-6 bg-blue-50">
                      <h3 className="text-lg font-bold text-slate-800 mb-4">✏️ Edit Candidate</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <input
                          type="text"
                          placeholder="Name"
                          value={editData.name || ''}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          className="border-2 border-slate-300 rounded-lg px-4 py-2 focus:border-blue-600 outline-none"
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={editData.email || ''}
                          onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                          className="border-2 border-slate-300 rounded-lg px-4 py-2 focus:border-blue-600 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Contact"
                          value={editData.contact || ''}
                          onChange={(e) => setEditData({ ...editData, contact: e.target.value })}
                          className="border-2 border-slate-300 rounded-lg px-4 py-2 focus:border-blue-600 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Position"
                          value={editData.position || ''}
                          onChange={(e) => setEditData({ ...editData, position: e.target.value })}
                          className="border-2 border-slate-300 rounded-lg px-4 py-2 focus:border-blue-600 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Experience"
                          value={editData.experience || ''}
                          onChange={(e) => setEditData({ ...editData, experience: e.target.value })}
                          className="border-2 border-slate-300 rounded-lg px-4 py-2 focus:border-blue-600 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="CTC"
                          value={editData.ctc || ''}
                          onChange={(e) => setEditData({ ...editData, ctc: e.target.value })}
                          className="border-2 border-slate-300 rounded-lg px-4 py-2 focus:border-blue-600 outline-none"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(candidate._id)}
                          disabled={isSaving}
                          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition disabled:opacity-50"
                        >
                          <Save size={18} />
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="bg-slate-400 hover:bg-slate-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition"
                        >
                          <X size={18} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Note Section */}
        <div className="max-w-7xl mx-auto mt-8 bg-blue-50 border-l-4 border-blue-600 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-2">📌 Note:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✅ Fix the missing or incomplete fields for each candidate</li>
            <li>✅ Click "Edit" button to open the edit form</li>
            <li>✅ Fill in all required information</li>
            <li>✅ Click "Save" to update the candidate</li>
            <li>✅ Once all fields are filled, candidate will be removed from this list</li>
            <li>✅ You can also "Delete" candidates that are no longer needed</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default PendingReviewPage;
