

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
    dest: 'uploads/',
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

        // Build MongoDB filter - only apply basic filters here
        const filter = {};
        // Note: When ANY filter is active, we fetch ALL data and filter in JavaScript

        // Fetch candidates - if ANY filter is active, get ALL candidates without pagination limit
        let candidatesQuery = Candidate.find(filter)
            .sort({ createdAt: -1 })
            .lean(); // Use .lean() for faster read-only queries

        if (shouldPaginate && !hasAnyFilter) {
            // Only use pagination at DB level if NO filters are active
            candidatesQuery = candidatesQuery.limit(limit).skip(skip);
        }

        const candidates = await candidatesQuery;
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
                        String(c.location || '').toLowerCase().includes(searchLower);
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

        // Get total count for pagination metadata
        const totalCount = hasAnyFilter
            ? finalCandidates.length
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

// --- 5. RESUME PARSING LOGIC ---
router.post('/parse-logic', memoryUpload.single('resume'), async (req, res) => {
    const pdfParse = require('pdf-parse');
    try {
        if (!req.file) return res.status(400).json({ message: "File missing" });
        const data = await pdfParse(req.file.buffer);
        const text = data.text;
        const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const phoneMatch = text.match(/(\+?\d{1,3}[- ]?)?\d{10}/);
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
        res.json({
            name: lines[0] || "",
            email: emailMatch ? emailMatch[0] : "",
            contact: phoneMatch ? phoneMatch[0] : ""
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to parse" });
    }
});

// --- 6. EMAIL CHECK ---
router.get('/check-email/:email', async (req, res) => {
    try {
        const existing = await Candidate.findOne({ email: req.params.email });
        res.status(200).json({ exists: !!existing });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// --- 7. UPDATE CANDIDATE ---
router.put('/:id', diskUpload.single('resume'), candidateController.updateCandidate);

// --- 8. DELETE CANDIDATE ---
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedCandidate = await Candidate.findByIdAndDelete(id);

        if (!deletedCandidate) {
            return res.status(404).json({ success: false, message: "Candidate not found" });
        }

        res.status(200).json({ success: true, message: "Candidate deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error deleting candidate", error: err.message });
    }
});

// --- 8B. CLEAR ALL CANDIDATES (DANGER: Deletes entire database) ---
router.delete('/clear-all/now', async (req, res) => {
    try {
        console.log('⚠️  DANGER: Clearing ALL candidates from database...');
        const result = await Candidate.deleteMany({});
        
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
        const allCandidates = await Candidate.find({}).lean();
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

// --- REVIEW & FIX WORKFLOW ---
// Re-validate a single record after user manual edits
router.post('/revalidate-record', candidateController.revalidateRecord);

// Import reviewed and fixed candidates to database
router.post('/import-reviewed', candidateController.importReviewedCandidates);

module.exports = router;