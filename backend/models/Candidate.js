
// const mongoose = require('mongoose');

// const CandidateSchema = new mongoose.Schema({
//   srNo: { type: String },
//   date: { type: String },
//   location: { type: String },
//   position: { type: String, required: true },
//   fls: { type: String },
//   name: { type: String, required: true },
//   contact: { type: String, required: true },
//   email: { type: String, required: true },
//   callBackDate: { type: String, default: "" },
//   companyName: { type: String },
//   experience: { type: String },
//   ctc: { type: String },
//   expectedCtc: { type: String },
//   noticePeriod: { type: String },
//   status: { 
//     type: String, 
//     default: 'Applied',
//     enum: ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'] 
//   },
//   client: { type: String },
//   spoc: { type: String },
//   source: { type: String },
//   resume: { type: String }, 
  
//   // ✅ History Tracking Field
//   statusHistory: [{
//     status: { type: String },
//     remark: { type: String, default: "Status Updated" },
//     updatedAt: { type: Date, default: Date.now },
//     updatedBy: { type: String, default: 'Recruiter' }
//   }],

//   createdAt: { type: Date, default: Date.now }
// });

// module.exports = mongoose.model('Candidate', CandidateSchema);


const mongoose = require('mongoose');

const CandidateSchema = new mongoose.Schema({
  srNo: { type: String },
  date: { type: String },
  location: { type: String, default: '' },
  state: { type: String, default: '' }, // ✅ State auto-detected from location
  position: { type: String, default: '' }, // ✅ Changed to optional with default
  fls: { type: String, default: '' },
  name: { type: String, required: true }, // Name is still required
  contact: { type: String, default: '' }, // ✅ Changed to optional - auto-generated if missing
  email: { type: String, required: true, lowercase: true }, // Email still required - auto-generated if missing
  callBackDate: { type: String, default: "" },
  companyName: { type: String, default: '' },
  experience: { type: String, default: '' },
  ctc: { type: String, default: '' },
  expectedCtc: { type: String, default: '' },
  noticePeriod: { type: String, default: '' },
  status: { 
    type: String, 
    default: 'Applied',
    enum: ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined', 'Dropped', 'Rejected', 'Interested', 'Interested and scheduled'] 
  },
  client: { type: String, default: '' },
  spoc: { type: String, default: '' },
  source: { type: String, default: '' },
  feedback: { type: String, default: '' }, // ✅ Added feedback field
  skills: { type: String, default: '' }, // ✅ Skills (from resume parsing; separate from remark)
  remark: { type: String, default: '' }, // ✅ Remark field (e.g. rejection reason, notes)
  resume: { type: String, default: '' }, 
  hiredDate: { type: Date },
  statusHistory: [{
    status: { type: String },
    remark: { type: String, default: "Status Updated" },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: String, default: 'Recruiter' }
  }],

  // ✅ Data Isolation: Each candidate belongs to the user who created it
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

  // ✅ Sharing: Track which team members have access to this candidate
  sharedWith: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sharedAt: { type: Date, default: Date.now },
    sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  createdAt: { type: Date, default: Date.now }
});

// 🚀 Performance Indexes for faster queries
CandidateSchema.index({ createdBy: 1, createdAt: -1 }); // Primary query pattern: user's candidates sorted by date
CandidateSchema.index({ createdBy: 1, position: 1 }); // For filtering by position within a user
CandidateSchema.index({ createdBy: 1, email: 1 }, { unique: true }); // Unique email per user (not globally)
CandidateSchema.index({ name: 'text', email: 'text', position: 'text' }); // Full-text search
CandidateSchema.index({ 'sharedWith.userId': 1 }); // For fetching candidates shared with a user

/**
 * PRE-SAVE HOOK: Auto-normalize all text fields
 * ─────────────────────────────────────────────
 * Ensures consistent formatting regardless of which path data takes to the database
 * 
 * RULES:
 * 1. Name: Title Case + Single spaces (e.g., "DeVANshU SalNi" → "Devanshu Saini")
 * 2. Other text fields (position, location, company, etc.): Trim + Single spaces
 * 3. Email: LOWERCASE ONLY (handled by Mongoose's lowercase: true)
 * 4. Never modify empty strings
 * 
 * This ensures data consistency even if data is entered/updated through:
 * - Normal createCandidate endpoint
 * - Normal updateCandidate endpoint
 * - Bulk import endpoints
 * - Direct API calls
 * - Any other path that saves to database
 */
CandidateSchema.pre('save', function(next) {
  // ✅ Name: Title Case (First letter of each word capital)
  // "DeVANshU SalNi" → "Devanshu Saini"
  if (this.name && typeof this.name === 'string' && this.name.trim()) {
    this.name = this.name
      .trim()
      .replace(/\s+/g, ' ') // Collapse multiple spaces to one
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // ✅ Other text fields: Trim + Single spaces (keep original case)
  const textFields = ['position', 'location', 'companyName', 'client', 'spoc', 'source', 'fls', 'noticePeriod', 'feedback', 'remark'];
  textFields.forEach(field => {
    if (this[field] && typeof this[field] === 'string' && this[field].trim()) {
      this[field] = this[field].trim().replace(/\s+/g, ' ');
    }
  });

  // ✅ Email: Lowercase is handled by Mongoose schema definition (lowercase: true)
  // No need to do it here, but we ensure no extra spaces
  if (this.email && typeof this.email === 'string') {
    this.email = this.email.trim();
  }

  next();
});

/**
 * PRE-FINDONEANDUPDATE HOOK: Normalize fields during edit/update operations
 * ──────────────────────────────────────────────────────────────────────────
 * The above pre('save') hook only runs on .save() and .create()
 * This hook runs on findOneAndUpdate which is used in updateCandidate endpoint
 */
CandidateSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  if (!update) return next();

  // ✅ Normalize name if being updated
  if (update.$set?.name && typeof update.$set.name === 'string' && update.$set.name.trim()) {
    update.$set.name = update.$set.name
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // ✅ Normalize other text fields
  const textFields = ['position', 'location', 'companyName', 'client', 'spoc', 'source', 'fls', 'noticePeriod', 'feedback', 'remark'];
  textFields.forEach(field => {
    if (update.$set?.[field] && typeof update.$set[field] === 'string' && update.$set[field].trim()) {
      update.$set[field] = update.$set[field].trim().replace(/\s+/g, ' ');
    }
  });

  // ✅ Ensure email has no extra spaces
  if (update.$set?.email && typeof update.$set.email === 'string') {
    update.$set.email = update.$set.email.trim();
  }

  next();
});

module.exports = mongoose.model('Candidate', CandidateSchema);