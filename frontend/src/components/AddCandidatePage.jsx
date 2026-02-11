import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Upload } from 'lucide-react';
import Layout from './Layout';
import BASE_API_URL from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';

const AddCandidatePage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoParsing, setIsAutoParsing] = useState(false);

  const initialFormState = {
    srNo: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    position: '',
    fls: '',
    name: '',
    contact: '',
    email: '',
    companyName: '',
    experience: '',
    ctc: '',
    expectedCtc: '',
    noticePeriod: '',
    status: 'Applied',
    client: '',
    spoc: '',
    source: '',
    resume: null,
    callBackDate: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  // ✅ HELPER: Validate and fix email
  const validateAndFixEmail = (email) => {
    if (!email) return { isValid: false, value: '' };
    let fixed = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(fixed);
    return { isValid, value: fixed };
  };

  // ✅ HELPER: Validate and fix mobile
  const validateAndFixMobile = (mobile) => {
    if (!mobile) return { isValid: false, value: '' };
    let digitsOnly = String(mobile).replace(/\D/g, '');
    if (digitsOnly.startsWith('91') && digitsOnly.length > 10) {
      digitsOnly = digitsOnly.slice(-10);
    }
    if (digitsOnly.length > 10) {
      digitsOnly = digitsOnly.slice(-10);
    }
    const isValid = digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly);
    return { isValid, value: digitsOnly };
  };

  // ✅ HELPER: Validate and fix name
  const validateAndFixName = (name) => {
    if (!name) return { isValid: false, value: '' };
    let fixed = String(name).replace(/[0-9!@#$%^&*()_+=\[\]{};:'",.<>?/\\|`~-]/g, '').trim();
    fixed = fixed.split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    const isValid = fixed.length >= 2 && /^[a-zA-Z\s]+$/.test(fixed);
    return { isValid, value: fixed };
  };

  const handleInputChange = async (e) => {
    const { name, value, files } = e.target;

    let finalValue = value;

    if (name === 'name' && value) {
      finalValue = value.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    if (name === 'email' && value) {
      finalValue = value.toLowerCase()
        .replace(/@gnail\.con$/, '@gmail.com')
        .replace(/@gnail\.com$/, '@gmail.com')
        .replace(/@gmail\.con$/, '@gmail.com')
        .replace(/@gmal\.com$/, '@gmail.com');
    }

    if (name === 'resume') {
      const file = files[0];
      setFormData(prev => ({ ...prev, resume: file }));

      if (file) {
        setIsAutoParsing(true);
        const data = new FormData();
        data.append('resume', file);

        try {
          const response = await fetch(`${BASE_API_URL}/candidates/parse-logic`, {
            method: 'POST',
            body: data,
          });

          if (response.ok) {
            const result = await response.json();
            console.log("Parsed Data Received:", result);

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
      setFormData(prev => ({ ...prev, [name]: finalValue }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    const emailCheck = validateAndFixEmail(formData.email);
    const mobileCheck = validateAndFixMobile(formData.contact);
    const nameCheck = validateAndFixName(formData.name);

    if (!nameCheck.isValid) {
      alert('❌ Invalid name. Please enter a valid name (at least 2 characters, letters only).');
      return;
    }

    if (!emailCheck.isValid) {
      alert('❌ Invalid email address. Please enter a valid email.');
      return;
    }

    if (!mobileCheck.isValid) {
      alert('❌ Invalid mobile number. Please enter a 10-digit Indian mobile number.');
      return;
    }

    try {
      setIsLoading(true);

      const data = new FormData();
      Object.keys(formData).forEach((key) => {
        if (['statusHistory', '_id', '__v', 'updatedAt'].includes(key)) return;
        if (key === 'resume') {
          if (formData[key] instanceof File) data.append('resume', formData[key]);
        } else {
          data.append(key, formData[key] || "");
        }
      });

      const token = localStorage.getItem('token');
      const response = await fetch(`${BASE_API_URL}/candidates`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: data
      });

      if (isUnauthorized(response)) {
        handleUnauthorized();
        return;
      }

      if (response.ok) {
        alert('✅ Candidate added successfully!');
        setFormData(initialFormState);
        navigate('/ats');
      } else {
        const errJson = await response.json();
        alert('❌ Error: ' + errJson.message);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Server Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFormData(initialFormState);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/ats')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to All Candidates
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center">
              <Plus size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-slate-900">Add New Candidate</h1>
              <p className="text-slate-600 mt-1">Fill in the candidate details below</p>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="max-w-6xl mx-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 space-y-8">
            
            {/* Basic Information Section */}
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-6 pb-4 border-b-2 border-blue-200">
                📋 Basic Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Full Name"
                    required
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="email@example.com"
                    required
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Contact *</label>
                  <input
                    type="tel"
                    name="contact"
                    value={formData.contact}
                    onChange={handleInputChange}
                    placeholder="10-digit number"
                    required
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Position</label>
                  <input
                    type="text"
                    name="position"
                    value={formData.position}
                    onChange={handleInputChange}
                    placeholder="e.g., Software Engineer"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Company</label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    placeholder="Current Company"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Location</label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="City/Region"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Experience & Compensation Section */}
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-6 pb-4 border-b-2 border-blue-200">
                💼 Experience & Compensation
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Experience (Years)</label>
                  <input
                    type="text"
                    name="experience"
                    value={formData.experience}
                    onChange={handleInputChange}
                    placeholder="e.g., 5 years"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Current CTC (LPA)</label>
                  <input
                    type="text"
                    name="ctc"
                    value={formData.ctc}
                    onChange={handleInputChange}
                    placeholder="e.g., 12"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Expected CTC (LPA)</label>
                  <input
                    type="text"
                    name="expectedCtc"
                    value={formData.expectedCtc}
                    onChange={handleInputChange}
                    placeholder="e.g., 15"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Notice Period</label>
                  <input
                    type="text"
                    name="noticePeriod"
                    value={formData.noticePeriod}
                    onChange={handleInputChange}
                    placeholder="e.g., 2 weeks"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">FLS/Non FLS</label>
                  <input
                    type="text"
                    name="fls"
                    value={formData.fls}
                    onChange={handleInputChange}
                    placeholder="FLS or Non-FLS"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    <option value="Applied">Applied</option>
                    <option value="Screening">Screening</option>
                    <option value="Interview">Interview</option>
                    <option value="Offer">Offer</option>
                    <option value="Hired">Hired</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Interested">Interested</option>
                    <option value="Interested and scheduled">Interested and scheduled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Additional Information Section */}
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-6 pb-4 border-b-2 border-blue-200">
                📝 Additional Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Client</label>
                  <input
                    type="text"
                    name="client"
                    value={formData.client}
                    onChange={handleInputChange}
                    placeholder="Client Name"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">SPOC</label>
                  <input
                    type="text"
                    name="spoc"
                    value={formData.spoc}
                    onChange={handleInputChange}
                    placeholder="SPOC Name"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Source of CV</label>
                  <input
                    type="text"
                    name="source"
                    value={formData.source}
                    onChange={handleInputChange}
                    placeholder="e.g., LinkedIn"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Call Back Date</label>
                  <input
                    type="date"
                    name="callBackDate"
                    value={formData.callBackDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">SR No.</label>
                  <input
                    type="text"
                    name="srNo"
                    value={formData.srNo}
                    onChange={handleInputChange}
                    placeholder="Serial Number"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Resume Upload Section */}
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-6 pb-4 border-b-2 border-blue-200">
                📄 Resume (Optional)
              </h2>
              <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 bg-blue-50 text-center hover:bg-blue-100 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  name="resume"
                  onChange={handleInputChange}
                  accept=".pdf,.doc,.docx"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-3">
                  <Upload size={32} className="text-blue-600" />
                  <div>
                    <p className="font-semibold text-slate-800">Click to upload resume</p>
                    <p className="text-sm text-slate-600">or drag and drop (PDF, DOC, DOCX)</p>
                  </div>
                  {isAutoParsing && (
                    <div className="flex items-center gap-2 text-blue-600 font-semibold">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      Parsing resume...
                    </div>
                  )}
                  {formData.resume && (
                    <p className="text-sm text-green-600 font-semibold">✅ {formData.resume.name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-4 pt-6 border-t-2 border-slate-200">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 px-6 py-3 bg-slate-200 text-slate-800 rounded-lg font-bold hover:bg-slate-300 transition-all transform hover:scale-105"
              >
                🔄 Reset Form
              </button>
              <button
                type="button"
                onClick={() => navigate('/ats')}
                className="flex-1 px-6 py-3 bg-slate-400 text-white rounded-lg font-bold hover:bg-slate-500 transition-all transform hover:scale-105"
              >
                ✕ Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || isAutoParsing}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-bold hover:from-green-600 hover:to-emerald-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    ✅ Add Candidate
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default AddCandidatePage;
