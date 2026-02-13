const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
}, { timestamps: true });

CompanySchema.index({ createdBy: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Company', CompanySchema);