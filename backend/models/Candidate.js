
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
  remark: { type: String, default: '' }, // ✅ Remark field (e.g. rejection reason)
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

  createdAt: { type: Date, default: Date.now }
});

// 🚀 Performance Indexes for faster queries
CandidateSchema.index({ createdBy: 1, createdAt: -1 }); // Primary query pattern: user's candidates sorted by date
CandidateSchema.index({ createdBy: 1, position: 1 }); // For filtering by position within a user
CandidateSchema.index({ createdBy: 1, email: 1 }, { unique: true }); // Unique email per user (not globally)
CandidateSchema.index({ name: 'text', email: 'text', position: 'text' }); // Full-text search

module.exports = mongoose.model('Candidate', CandidateSchema);