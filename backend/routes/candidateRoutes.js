

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const candidateController = require('../controller/candidateController');
const Candidate = require('../models/Candidate'); // Baar-baar require karne se achha hai ek baar upar kar lein

// ✅ VALIDATION AND AUTO-FIX HELPERS
const validateAndFixEmail = (email) => {
    if (!email) return { isValid: false, value: '' };
    
    let fixed = String(email).trim().toLowerCase();
    
    // Check if it has @ and valid domain format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(fixed);
    
    return { isValid, value: fixed };
};

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

const is100PercentCorrect = (candidate) => {
    const emailCheck = validateAndFixEmail(candidate.email);
    const mobileCheck = validateAndFixMobile(candidate.contact);
    const nameCheck = validateAndFixName(candidate.name);
    
    return emailCheck.isValid && mobileCheck.isValid && nameCheck.isValid;
};

// Multer Setup with increased file size limits
const memoryUpload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});
const diskUpload = multer({ 
    storage: multer.diskStorage({
        destination: 'uploads/',
        filename: (req, file, cb) => {
            // Keep original extension for proper MIME type serving
            const ext = path.extname(file.originalname) || '.pdf';
            const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
            cb(null, uniqueName);
        }
    }),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// --- 1. GET ALL CANDIDATES ---
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const rawLimit = req.query.limit;
        const parsedLimit = rawLimit === 'all' ? 0 : parseInt(rawLimit, 10);
        const limit = Number.isNaN(parsedLimit) ? 50 : parsedLimit;
        const shouldPaginate = limit > 0;
        const skip = shouldPaginate ? (page - 1) * limit : 0;
        const search = (req.query.search || '').trim();
        const position = (req.query.position || '').trim();
        const location = (req.query.location || '').trim();
        const companyName = (req.query.companyName || '').trim();

        // Get raw string values for text field searches BEFORE fetching candidates
        const ctcMinStr = (req.query.ctcMin || '').trim();
        const ctcMaxStr = (req.query.ctcMax || '').trim();
        const expectedCtcMinStr = (req.query.expectedCtcMin || '').trim();
        const expectedCtcMaxStr = (req.query.expectedCtcMax || '').trim();
        
        // Try to parse as numbers for range queries
        const expMin = parseFloat(req.query.expMin);
        const expMax = parseFloat(req.query.expMax);
        const ctcMinNum = parseFloat(ctcMinStr);
        const ctcMaxNum = parseFloat(ctcMaxStr);
        const expectedCtcMinNum = parseFloat(expectedCtcMinStr);
        const expectedCtcMaxNum = parseFloat(expectedCtcMaxStr);

        // Determine if we have numeric or text field filters
        const hasNumericCTC = !isNaN(ctcMinNum) || !isNaN(ctcMaxNum);
        const hasNumericExpectedCTC = !isNaN(expectedCtcMinNum) || !isNaN(expectedCtcMaxNum);
        const hasTextCTC = ctcMinStr && isNaN(ctcMinNum);
        const hasTextExpectedCTC = expectedCtcMinStr && isNaN(expectedCtcMinNum);

        const hasRangeFilter =
            !isNaN(expMin) || !isNaN(expMax) ||
            hasNumericCTC || hasNumericExpectedCTC ||
            hasTextCTC || hasTextExpectedCTC;

        // Detect if ANY filter is active
        const hasAnyFilter = search || position || location || companyName || hasRangeFilter;

        // Build MongoDB filter - scope by the logged-in user (own + shared with me)
        const viewMode = (req.query.view || '').trim();
        const userIdRaw = req.user && req.user.id;
        if (!userIdRaw) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const userIdStr = String(userIdRaw);
        const userIdObj = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : null;
        // Query with ObjectId so DB documents (createdBy stored as ObjectId) match reliably
        const createdByMatch = userIdObj
            ? { $in: [userIdObj, userIdStr] }
            : userIdStr;
        let filter;
        if (viewMode === 'shared') {
            filter = { 'sharedWith.userId': userIdObj ? { $in: [userIdObj, userIdStr] } : userIdStr };
        } else {
            filter = {
                $or: [
                    { createdBy: createdByMatch },
                    { 'sharedWith.userId': userIdObj ? { $in: [userIdObj, userIdStr] } : userIdStr }
                ]
            };
        }

        // Fetch candidates - if ANY filter is active, get ALL candidates without pagination limit
        let candidatesQuery = Candidate.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        if (shouldPaginate && !hasAnyFilter) {
            // Only use pagination at DB level if NO filters are active
            candidatesQuery = candidatesQuery.limit(limit).skip(skip);
        }

        let candidates = await candidatesQuery;
        let usedOrphanFallback = false;
        let orphanCountForTotal = 0;

        // Fallback: if no candidates found and we're on "all" view, include legacy/orphan records (no createdBy) so list is not empty
        if (candidates.length === 0 && viewMode !== 'shared') {
            const orphanFilter = { $or: [{ createdBy: { $exists: false } }, { createdBy: null }] };
            orphanCountForTotal = await Candidate.countDocuments(orphanFilter);
            if (orphanCountForTotal > 0) {
                usedOrphanFallback = true;
                const orphanQuery = Candidate.find(orphanFilter).sort({ createdAt: -1 }).lean();
                if (shouldPaginate && !hasAnyFilter) {
                    candidates = await orphanQuery.limit(limit).skip(skip);
                } else {
                    candidates = await orphanQuery;
                }
                console.log(`📊 Backend Query - using ${candidates.length} orphan/legacy candidates (no createdBy)`);
            }
        }

        // Mark shared candidates so the frontend can distinguish them (orphans with no createdBy count as "own")
        const ownerIds = new Set();
        candidates.forEach(c => {
            const hasOwner = c.createdBy != null && String(c.createdBy) !== '';
            const isOwn = !hasOwner || String(c.createdBy) === userIdStr;
            c._isShared = !isOwn;
            if (!isOwn && hasOwner) ownerIds.add(String(c.createdBy));
        });

        // Populate owner names for shared candidates (non-blocking: list still returns if this fails)
        if (ownerIds.size > 0) {
            try {
                const User = require('mongoose').model('User');
                const ownerIdList = [...ownerIds];
                const owners = await User.find({ _id: { $in: ownerIdList } }).select('name email').lean();
                const ownerMap = {};
                owners.forEach(o => { ownerMap[String(o._id)] = o.name || o.email; });
                candidates.forEach(c => {
                    if (c._isShared) c._sharedByOwner = ownerMap[String(c.createdBy)] || 'Unknown';
                });
            } catch (ownerErr) {
                console.warn('⚠️ Shared-by owner lookup failed (candidates still returned):', ownerErr.message);
            }
        }

        console.log(`📊 Backend Query - hasAnyFilter: ${hasAnyFilter}, returned: ${candidates.length} records`);

        const parseNumber = (value) => {
            if (!value) return null;
            const numbers = String(value).match(/\d+(?:\.\d+)?/g);
            if (!numbers || numbers.length === 0) return null;
            return Math.max(...numbers.map(n => parseFloat(n)));
        };

        // Helper function to extract min and max from a range string like "3L-7L" or "0-50k"
        const parseRangeMinMax = (value) => {
            if (!value) return { min: null, max: null };
            
            const str = String(value).toLowerCase();
            // Extract all numbers
            const numbers = str.match(/\d+(?:\.\d+)?/g);
            if (!numbers || numbers.length === 0) return { min: null, max: null };
            
            const nums = numbers.map(n => parseFloat(n));
            return {
                min: Math.min(...nums),
                max: Math.max(...nums)
            };
        };

        const finalCandidates = hasAnyFilter
            ? candidates.filter((c) => {
                // General search - check all searchable fields
                if (search) {
                    const searchLower = search.toLowerCase();
                    const matchesSearch = 
                        String(c.name || '').toLowerCase().includes(searchLower) ||
                        String(c.email || '').toLowerCase().includes(searchLower) ||
                        String(c.position || '').toLowerCase().includes(searchLower) ||
                        String(c.companyName || '').toLowerCase().includes(searchLower) ||
                        String(c.contact || '').toLowerCase().includes(searchLower) ||
                        String(c.location || '').toLowerCase().includes(searchLower) ||
                        String(c.spoc || '').toLowerCase().includes(searchLower);
                    if (!matchesSearch) return false;
                }

                // Case-insensitive text filters for position, location, company
                if (position && !String(c.position || '').toLowerCase().includes(position.toLowerCase())) {
                    return false;
                }
                if (location && !String(c.location || '').toLowerCase().includes(location.toLowerCase())) {
                    return false;
                }
                if (companyName && !String(c.companyName || '').toLowerCase().includes(companyName.toLowerCase())) {
                    return false;
                }

                // Range-based filters
                const expVal = parseNumber(c.experience);
                const ctcRange = parseRangeMinMax(c.ctc);
                const expectedCRange = parseRangeMinMax(c.expectedCtc);

                // Experience validation (numeric range)
                if (!isNaN(expMin) && (expVal === null || expVal < expMin)) return false;
                if (!isNaN(expMax) && (expVal === null || expVal > expMax)) return false;
                
                // CTC validation - numeric range query
                if (hasNumericCTC) {
                    // If candidate has no CTC data, exclude them
                    if (ctcRange.max === null) return false;
                    
                    // Check if ranges overlap or candidate's CTC is within search range
                    if (!isNaN(ctcMinNum) && ctcRange.max < ctcMinNum) return false;
                    if (!isNaN(ctcMaxNum) && ctcRange.min > ctcMaxNum) return false;
                }
                
                // CTC validation - text field search (like "NA", "Fehe", etc)
                if (hasTextCTC) {
                    const ctcStr = String(c.ctc || '').toLowerCase();
                    const searchStr = ctcMinStr.toLowerCase();
                    if (!ctcStr.includes(searchStr)) return false;
                }
                
                // Expected CTC validation - numeric range query
                if (hasNumericExpectedCTC) {
                    // If candidate has no Expected CTC data, exclude them
                    if (expectedCRange.max === null) return false;
                    
                    // Check if ranges overlap or candidate's Expected CTC is within search range
                    if (!isNaN(expectedCtcMinNum) && expectedCRange.max < expectedCtcMinNum) return false;
                    if (!isNaN(expectedCtcMaxNum) && expectedCRange.min > expectedCtcMaxNum) return false;
                }
                
                // Expected CTC validation - text field search
                if (hasTextExpectedCTC) {
                    const expectedCtcStr = String(c.expectedCtc || '').toLowerCase();
                    const searchStr = expectedCtcMinStr.toLowerCase();
                    if (!expectedCtcStr.includes(searchStr)) return false;
                }

                return true;
            })
            : candidates;

        // Get total count for pagination metadata (when we used orphan fallback, use orphan total)
        const totalCount = hasAnyFilter
            ? finalCandidates.length
            : usedOrphanFallback
                ? orphanCountForTotal
                : await Candidate.countDocuments(filter);
        const totalPages = shouldPaginate ? Math.ceil(totalCount / limit) : 1;

        // Apply pagination to final candidates if ANY filter was used
        let paginatedCandidates = finalCandidates;
        if (hasAnyFilter && shouldPaginate) {
            paginatedCandidates = finalCandidates.slice(skip, skip + limit);
        } else if (!hasAnyFilter && !shouldPaginate) {
            // If limit=all and no filter, finalCandidates already has all
            paginatedCandidates = finalCandidates;
        }

        res.status(200).json({
            success: true,
            data: paginatedCandidates,
            pagination: {
                currentPage: shouldPaginate ? page : 1,
                totalPages: totalPages,
                totalCount: totalCount,
                pageSize: shouldPaginate ? limit : totalCount,
                hasMore: shouldPaginate ? page < totalPages : false
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Error fetching candidates", error: err.message });
    }
});

// --- 2. CREATE SINGLE CANDIDATE (Manual Add) ---
// Frontend se jab aap single candidate add karengi, toh wo isi route pe aayega
router.post('/', diskUpload.single('resume'), candidateController.createCandidate);

// --- 2b. BULK CREATE FROM PARSED RESUMES (JSON body, no file) ---
router.post('/bulk-from-parsed', candidateController.bulkCreateFromParsed);

// --- 3. EXTRACT HEADERS (for column mapping) ---
router.post('/extract-headers', diskUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const ExcelJS = require('exceljs');
        const fs = require('fs');
        const workbook = new ExcelJS.Workbook();
        const ext = path.extname(req.file.originalname || '').toLowerCase();
        if (ext === '.csv') {
            await workbook.csv.readFile(req.file.path);
        } else if (ext === '.xls') {
            return res.status(400).json({ success: false, message: "Old .xls format not supported. Please save as .xlsx or .csv." });
        } else {
            await workbook.xlsx.readFile(req.file.path);
        }

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            return res.status(400).json({ success: false, message: "No worksheet found" });
        }

        // Helper function to convert cell value to string
        const cellToString = (cell) => {
            if (cell === null || cell === undefined) return "";
            if (typeof cell === 'object') {
                if (cell.text) return String(cell.text).trim();
                if (cell.richText && Array.isArray(cell.richText)) return cell.richText.map(r => r.text || '').join('').trim();
                if (cell.result) return String(cell.result).trim();
                if (cell instanceof Date) return cell.toISOString().split('T')[0];
                return String(cell).trim();
            }
            return String(cell).trim();
        };

        // Detect header row (best match in first few rows)
        const detectHeaderRow = (sheet) => {
            const scores = {};
            for (let r = 1; r <= Math.min(8, sheet.rowCount); r++) {
                let score = 0;
                const row = sheet.getRow(r);
                row.eachCell((cell) => {
                    const text = cellToString(cell.value).toLowerCase();
                    if (!text) return;
                    if (text.includes('name') || text.includes('email') || text.includes('contact') || text.includes('position') || text.includes('company') || text.includes('ctc') || text.includes('client') || text.includes('experience') || text.includes('notice')) score++;
                });
                scores[r] = score;
            }
            let best = 1, bestScore = -1;
            for (const k of Object.keys(scores)) {
                if (scores[k] > bestScore) { best = Number(k); bestScore = scores[k]; }
            }
            return best;
        };

        // Extract headers from detected header row, including ALL columns (even if empty)
        const headers = [];
        const headerRowNum = detectHeaderRow(worksheet);
        const headerRow = worksheet.getRow(headerRowNum);

        // Determine last used column in header row (preserve gaps)
        let maxCol = 0;
        headerRow.eachCell((cell, colNumber) => {
            if (colNumber > maxCol) maxCol = colNumber;
        });
        maxCol = Math.max(maxCol, 20); // At least check 20 columns

        for (let col = 1; col <= maxCol; col++) {
            const cell = headerRow.getCell(col);
            const value = cellToString(cell.value);
            if (value) {
                headers.push(value);
            } else {
                headers.push(`Column ${col}`);
            }
        }

        // Trim trailing empty columns
        while (headers.length > 0 && headers[headers.length - 1].startsWith('Column')) {
            headers.pop();
        }

        console.log("--- 📋 Extracted Headers:", headers);
        console.log("--- 🧭 Header Row Detected:", headerRowNum);
        console.log("--- 📊 Total columns detected:", headers.length);

        // Cleanup
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(200).json({ success: true, headers });
    } catch (err) {
        console.error("Extract Headers Error:", err);
        res.status(500).json({ success: false, message: "Error reading file: " + err.message });
    }
});

// --- 4A. AUTO BULK UPLOAD (No column mapping needed!) ---
router.post('/bulk-upload-auto', diskUpload.single('file'), candidateController.bulkUploadCandidates);

// --- 4B. MANUAL BULK UPLOAD (With column mapping) ---
router.post('/bulk-upload', diskUpload.single('file'), (req, res, next) => {
    try {
        console.log('--- 📥 BULK UPLOAD REQUEST RECEIVED ---');
        console.log('--- 📦 req.body keys:', Object.keys(req.body || {}));
        console.log('--- 📦 req.body.columnMapping type:', typeof req.body?.columnMapping);
        console.log('--- 📦 req.body.columnMapping raw:', req.body?.columnMapping);
        console.log('--- 📄 req.file:', req.file ? {
            fieldname: req.file.fieldname,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path
        } : 'NO FILE');
    } catch (e) {
        console.error('--- ❌ Bulk upload pre-log failed:', e.message);
    }
    next();
}, candidateController.bulkUploadCandidates);

// --- 5. RESUME PARSING LOGIC (Enhanced Enterprise Version) ---
const { parseResume } = require('../services/resumeParser');
const fs = require('fs');
router.post('/parse-logic', memoryUpload.single('resume'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "File missing" });

        const mimetype = req.file.mimetype;
        const buffer = req.file.buffer;
        const filename = req.file.originalname || '';

        console.log(`🔍 Parsing resume: ${filename} (${mimetype})`);

        const parsed = await parseResume(buffer, mimetype, filename);

        // Enhanced response with confidence scores and metadata
        const response = {
            success: true,
            name: parsed.name,
            email: parsed.email,
            contact: parsed.contact,
            position: parsed.position,
            company: parsed.company,
            experience: parsed.experience,
            location: parsed.location,
            skills: parsed.skills,
            education: parsed.education,
            parsed: parsed,
            confidence: parsed.confidence,
            metadata: {
                filename,
                mimetype,
                parsedAt: new Date().toISOString(),
                extractedFields: Object.keys(parsed).filter(k => parsed[k] && k !== 'confidence'),
                averageConfidence: parsed.confidence ? Object.values(parsed.confidence).reduce((a, b) => a + b, 0) / Object.keys(parsed.confidence).length : 0
            }
        };

        console.log(`✅ Resume parsed successfully: ${response.metadata.extractedFields.length} fields extracted`);
        res.json(response);

    } catch (err) {
        // Enterprise-grade error logging with more details
        const errorLog = `${new Date().toISOString()} - ${req.file?.originalname || 'unknown'} - ${err.stack}\n`;
        fs.appendFile('backend/resume_parse_errors.log', errorLog, () => {});

        console.error('❌ Resume parsing error:', {
            filename: req.file?.originalname,
            mimetype: req.file?.mimetype,
            error: err.message
        });

        // Use the parser's error message directly if it's user-friendly
        const isUserFriendly = err.message.includes('scanned') || err.message.includes('image') || err.message.includes('text-based');
        res.status(500).json({
            error: isUserFriendly ? err.message : 'Resume parsing failed',
            details: err.message,
            filename: req.file?.originalname,
            suggestion: isUserFriendly
              ? 'Upload a text-based PDF or DOCX resume for best results'
              : 'Try uploading a PDF, DOC, DOCX, TXT, or RTF file with clear text content'
        });
    }
});

// --- 6. EMAIL CHECK ---
router.get('/check-email/:email', async (req, res) => {
    try {
        const existing = await Candidate.findOne({ email: req.params.email, createdBy: req.user.id });
        res.status(200).json({ exists: !!existing });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// --- 6.5 GET SINGLE CANDIDATE BY ID ---
router.get('/:id', async (req, res) => {
    try {
        const candidate = await Candidate.findOne({ _id: req.params.id, createdBy: req.user.id });
        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }
        res.status(200).json(candidate);
    } catch (err) {
        console.error('Error fetching candidate:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- 7. UPDATE CANDIDATE ---
router.put('/:id', diskUpload.single('resume'), candidateController.updateCandidate);

// --- 8. DELETE CANDIDATE ---
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Only delete if candidate belongs to the logged-in user
        const deletedCandidate = await Candidate.findOneAndDelete({ _id: id, createdBy: req.user.id });

        if (!deletedCandidate) {
            return res.status(404).json({ success: false, message: "Candidate not found or access denied" });
        }

        res.status(200).json({ success: true, message: "Candidate deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error deleting candidate", error: err.message });
    }
});

// --- 8A2. BULK DELETE CANDIDATES (by IDs array) ---
router.post('/bulk-delete', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'No candidate IDs provided' });
        }

        const result = await Candidate.deleteMany({
            _id: { $in: ids },
            createdBy: req.user.id
        });

        res.json({
            success: true,
            message: `Deleted ${result.deletedCount} of ${ids.length} candidates`,
            deletedCount: result.deletedCount
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error deleting candidates', error: err.message });
    }
});

// --- 8B. CLEAR ALL CANDIDATES (DANGER: Deletes entire database) ---
router.delete('/clear-all/now', async (req, res) => {
    try {
        console.log('⚠️  Clearing all candidates for user:', req.user.id);
        const result = await Candidate.deleteMany({ createdBy: req.user.id });
        
        res.status(200).json({ 
            success: true, 
            message: "All candidates deleted successfully",
            deletedCount: result.deletedCount || 0
        });
        
        console.log(`✅ Cleared ${result.deletedCount || 0} records from database`);
    } catch (err) {
        console.error('❌ Error clearing database:', err.message);
        res.status(500).json({ success: false, message: "Error clearing database", error: err.message });
    }
});

// --- 9. DATA QUALITY ANALYSIS REPORT (CORRECT DATA ONLY) ---
router.get('/analytics/data-quality', async (req, res) => {
    try {
        const allCandidates = await Candidate.find({ createdBy: req.user.id }).lean();
        const totalRecords = allCandidates.length;

        if (totalRecords === 0) {
            return res.status(200).json({
                success: true,
                totalRecords: 0,
                correctly100Percent: 0,
                percentage100Correct: '0%',
                incorrectCount: 0,
                duplicateCount: 0,
                analysis: {
                  correct: [],
                  incorrect: [],
                  duplicates: []
                }
            });
        }

        // ✅ Analyze data: Correct, Incorrect, Duplicates
        let correctCount = 0;
        let incorrectCount = 0;
        let duplicateCount = 0;
        
        const correctRecords = [];
        const incorrectRecords = [];
        const duplicateRecords = [];

        for (let i = 0; i < allCandidates.length; i++) {
            const c = allCandidates[i];

            // Check if marked as duplicate
            if (c.isDuplicate === true) {
                duplicateCount++;
                duplicateRecords.push({
                  name: c.name,
                  email: c.email,
                  contact: c.contact,
                  reason: 'Marked as duplicate during import'
                });
                continue;
            }

            // Use the simplified 3-field validation
            if (is100PercentCorrect(c)) {
                correctCount++;
                correctRecords.push({
                  name: c.name,
                  email: c.email,
                  contact: c.contact
                });
            } else {
                incorrectCount++;
                
                // Determine what's wrong
                const emailCheck = validateAndFixEmail(c.email);
                const mobileCheck = validateAndFixMobile(c.contact);
                const nameCheck = validateAndFixName(c.name);
                
                let issues = [];
                if (!emailCheck.isValid) issues.push('Invalid Email');
                if (!mobileCheck.isValid) issues.push('Invalid Mobile (not 10 digits or not 6-9)');
                if (!nameCheck.isValid) issues.push('Invalid Name (not alphabets)');
                
                incorrectRecords.push({
                  name: c.name,
                  email: c.email,
                  contact: c.contact,
                  issues: issues.join(', ')
                });
            }
        }

        const percentageCorrect = ((correctCount / totalRecords) * 100).toFixed(2);

        // 📊 LOG TO CONSOLE
        console.log('\n========== 📊 DATA QUALITY ANALYSIS ==========');
        console.log(`Total Records in Database: ${totalRecords}`);
        console.log(`✅ Correct Records: ${correctCount} (${percentageCorrect}%)`);
        console.log(`❌ Incorrect Records: ${incorrectCount}`);
        console.log(`⚠️ Duplicate Records: ${duplicateCount}`);
        console.log('=============================================\n');

        res.status(200).json({
            success: true,
            totalRecords,
            correctly100Percent: correctCount,
            percentage100Correct: percentageCorrect + '%',
            incorrectCount,
            duplicateCount,
            summary: {
                message: `Analysis Complete: ${correctCount} correct, ${incorrectCount} incorrect, ${duplicateCount} duplicates out of ${totalRecords} total`,
                correct_percentage: percentageCorrect,
                correct_count: correctCount,
                incorrect_count: incorrectCount,
                duplicate_count: duplicateCount
            }
        });

    } catch (err) {
        console.error('Error analyzing data quality:', err);
        res.status(500).json({ success: false, message: "Error analyzing data quality", error: err.message });
    }
});

// Review & Fix Workflow
// Re-validate a single record after user manual edits
router.post('/revalidate-record', candidateController.revalidateRecord);

// Import reviewed and fixed candidates to database
router.post('/import-reviewed', candidateController.importReviewedCandidates);

// ✅ Share candidate with team members
router.post('/share', candidateController.shareCandidate);

// Import shared candidates into current user's database (copy as own)
router.post('/import-shared', candidateController.importSharedCandidates);

// ================= PENDING CANDIDATES (Review / Blocked) =================
const PendingCandidate = require('../models/PendingCandidate');

// Save review/blocked records from auto import
router.post('/pending/save', async (req, res) => {
    try {
        const { records, fileName } = req.body;
        if (!records || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ success: false, message: 'No records provided' });
        }

        const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const userId = req.user.id;
        const createdByObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

        const getVal = (r, key) => r.fixed?.[key] ?? r[key];
        const docs = records.map(r => ({
            batchId,
            fileName: fileName || '',
            category: r.category || 'review',
            rowIndex: r.rowIndex ?? 0,
            name: getVal(r, 'name') || '',
            email: getVal(r, 'email') || '',
            contact: getVal(r, 'contact') || '',
            position: getVal(r, 'position') || '',
            companyName: getVal(r, 'companyName') || '',
            location: getVal(r, 'location') || '',
            ctc: getVal(r, 'ctc') || '',
            expectedCtc: getVal(r, 'expectedCtc') || '',
            experience: getVal(r, 'experience') || '',
            noticePeriod: getVal(r, 'noticePeriod') || '',
            status: getVal(r, 'status') || 'Applied',
            source: getVal(r, 'source') || '',
            client: getVal(r, 'client') || '',
            spoc: getVal(r, 'spoc') || '',
            remark: getVal(r, 'remark') || '',
            fls: getVal(r, 'fls') || '',
            date: getVal(r, 'date') || new Date().toISOString().split('T')[0],
            originalData: r.original || {},
            confidence: r.validation?.confidence || '',
            validationErrors: r.validation?.errors || [],
            validationWarnings: r.validation?.warnings || [],
            autoFixChanges: r.autoFixChanges || [],
            swaps: r.swaps || [],
            createdBy: createdByObj
        }));

        await PendingCandidate.insertMany(docs);

        res.json({ success: true, message: `Saved ${docs.length} records to pending`, batchId, count: docs.length });
    } catch (err) {
        console.error('[PENDING-SAVE] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get pending candidates (with pagination and filtering) — user sees only their own data
router.get('/pending', async (req, res) => {
    try {
        const { category, page = 1, limit = 50, search, batchId } = req.query;
        const userId = req.user.id;
        const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
        // Match both ObjectId and string so records show whether stored as either type
        const createdByFilter = { $in: [userIdObj, userId] };

        const filter = { createdBy: createdByFilter };
        if (category && category !== 'all') filter.category = category;
        if (batchId) filter.batchId = batchId;
        if (search && search.trim()) {
            const q = new RegExp(search.trim(), 'i');
            filter.$or = [
                { name: q }, { email: q }, { contact: q },
                { companyName: q }, { location: q }, { position: q }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
        const [candidates, total] = await Promise.all([
            PendingCandidate.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            PendingCandidate.countDocuments(filter)
        ]);

        const countFilter = { createdBy: createdByFilter };
        const [reviewCount, blockedCount] = await Promise.all([
            PendingCandidate.countDocuments({ ...countFilter, category: 'review' }),
            PendingCandidate.countDocuments({ ...countFilter, category: 'blocked' })
        ]);

        res.json({
            success: true,
            candidates,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            stats: { review: reviewCount, blocked: blockedCount, total: reviewCount + blockedCount }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update a pending candidate (edit fields)
router.put('/pending/:id', async (req, res) => {
    try {
        const updated = await PendingCandidate.findOneAndUpdate(
            { _id: req.params.id, createdBy: req.user.id },
            { $set: req.body },
            { new: true }
        );
        if (!updated) return res.status(404).json({ success: false, message: 'Record not found' });
        res.json({ success: true, candidate: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete pending candidate(s)
router.post('/pending/delete', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ success: false, message: 'No IDs provided' });

        const userId = req.user.id;
        const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
        const result = await PendingCandidate.deleteMany({ _id: { $in: ids }, createdBy: { $in: [userIdObj, userId] } });
        res.json({ success: true, deletedCount: result.deletedCount });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Clear all pending records for the current user (enterprise-style cleanup)
router.post('/pending/clear-all', async (req, res) => {
    try {
        const userId = req.user.id;
        const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
        const result = await PendingCandidate.deleteMany({ createdBy: { $in: [userIdObj, userId] } });
        res.json({ success: true, deletedCount: result.deletedCount, message: `Cleared ${result.deletedCount} pending records.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Import pending candidates to main database (move from pending to candidates)
router.post('/pending/import', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'No IDs provided' });
        }

        const userId = req.user.id;
        const pendingRecords = await PendingCandidate.find({ _id: { $in: ids }, createdBy: userId }).lean();

        if (pendingRecords.length === 0) {
            return res.status(404).json({ success: false, message: 'No matching records found' });
        }

        let imported = 0;
        let failed = 0;
        const errors = [];

        const bulkOps = pendingRecords.map(p => ({
            updateOne: {
                filter: { email: p.email.toLowerCase(), createdBy: userId },
                update: {
                    $set: {
                        name: p.name, contact: p.contact, position: p.position,
                        companyName: p.companyName, location: p.location, ctc: p.ctc,
                        expectedCtc: p.expectedCtc, experience: p.experience,
                        noticePeriod: p.noticePeriod, status: p.status || 'Applied',
                        source: p.source, client: p.client, spoc: p.spoc,
                        remark: p.remark, fls: p.fls, date: p.date,
                        createdBy: userId
                    },
                    $setOnInsert: { email: p.email.toLowerCase() }
                },
                upsert: true
            }
        }));

        try {
            const bulkResult = await Candidate.bulkWrite(bulkOps, { ordered: false });
            imported = (bulkResult.upsertedCount || 0) + (bulkResult.modifiedCount || 0);
        } catch (bulkErr) {
            if (bulkErr.result) {
                imported = (bulkErr.result.nUpserted || 0) + (bulkErr.result.nModified || 0);
                failed = bulkErr.writeErrors?.length || 0;
                errors.push(...(bulkErr.writeErrors || []).map(e => e.errmsg));
            } else {
                throw bulkErr;
            }
        }

        // Remove successfully imported records from pending
        if (imported > 0) {
            await PendingCandidate.deleteMany({ _id: { $in: ids }, createdBy: userId });
        }

        res.json({
            success: true,
            message: `Imported ${imported} of ${pendingRecords.length} records`,
            imported, failed, errors: errors.slice(0, 5)
        });
    } catch (err) {
        console.error('[PENDING-IMPORT] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;