





const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Log Zoho Campaigns .env status at startup (so you can confirm vars are loaded)
(function () {
  const c = process.env.ZOHO_CAMPAIGNS_CLIENT_ID;
  const s = process.env.ZOHO_CAMPAIGNS_CLIENT_SECRET;
  const r = process.env.ZOHO_CAMPAIGNS_REFRESH_TOKEN;
  const l = process.env.ZOHO_CAMPAIGNS_LIST_KEY;
  const ok = (v) => (v && typeof v === 'string' && v.trim().length > 0);
  if (ok(c) && ok(s) && ok(r) && ok(l)) {
    const keyPreview = l.length >= 8 ? l.substring(0, 8) + '...' : '(set)';
    console.log('[Campaigns] .env: ZOHO_CAMPAIGNS_* and LIST_KEY are set. LIST_KEY starts with:', keyPreview, '— ensure this is the List Key from "Skillnix Job alerts" in Zoho (not My Sample List).');
  } else {
    const missing = [].concat(!ok(c) ? ['ZOHO_CAMPAIGNS_CLIENT_ID'] : [], !ok(s) ? ['ZOHO_CAMPAIGNS_CLIENT_SECRET'] : [], !ok(r) ? ['ZOHO_CAMPAIGNS_REFRESH_TOKEN'] : [], !ok(l) ? ['ZOHO_CAMPAIGNS_LIST_KEY'] : []);
    console.warn('[Campaigns] .env missing or empty:', missing.join(', '), '— marketing emails will fail until set and backend is restarted.');
  }
})();

// Global crash handlers - prevent server from dying on unhandled errors
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception (server stayed alive):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection (server stayed alive):', reason?.message || reason);
});

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const bcrypt = require('bcrypt');
const homeRoutes = require('./routes/home');
const companyRoutes = require('./routes/companyRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const candidateRoutes = require('./routes/candidateRoutes');
const emailRoutes = require('./routes/emailRoutes');
const emailTemplateRoutes = require('./routes/emailTemplateRoutes');
const positionRoutes = require('./routes/positionRoutes');
const clientRoutes = require('./routes/clientRoutes');
const sourceRoutes = require('./routes/sourceRoutes');
const exportRoutes = require('./routes/exportRoutes');
const emailSettingsRoutes = require('./routes/emailSettingsRoutes');
const companyEmailSettingsRoutes = require('./routes/companyEmailSettingsRoutes');  // ✅ Company-wide email config
const notificationRoutes = require('./routes/notificationRoutes');
const teamRoutes = require('./routes/teamRoutes');
const publicSubscribeRoutes = require('./routes/publicSubscribeRoutes');
const zohoOAuthRoutes = require('./routes/zohoOAuthRoutes');
const { startNotificationScheduler } = require('./services/notificationService');
const { verifyToken, generateToken, JWT_SECRET } = require('./middleware/authMiddleware');
const { normalizeText } = require('./utils/textNormalize');

// Models Import (Sirf User aur Job yahan rakhein, Candidate routes mein handle hoga)
const Job = require('./models/Job');
const Candidate = require('./models/Candidate');
const JDTemplate = require('./models/JDTemplate');

const app = express();
const PORT = process.env.PORT || 5000;

// Set timeout for large file uploads (5 minutes)
app.use((req, res, next) => {
  req.setTimeout(600000); // 10 minutes
  res.setTimeout(600000);
  next();
});

// Middleware — CORS: allow live frontend + any localhost (for local dev on any port)
const allowedOriginList = [
  "https://skillnix-ats-frontend.onrender.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL
].filter(Boolean);
function corsOrigin(origin, cb) {
  if (!origin) return cb(null, true);
  if (allowedOriginList.indexOf(origin) !== -1) return cb(null, origin);
  if (/^https?:\/\/localhost(:\d+)?$/i.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin)) return cb(null, origin);
  return cb(null, false);
}
app.use(cors({ origin: corsOrigin, credentials: true }));
// JSON parsing with limit
app.use(express.json({ limit: '100mb' }));
app.use('/api/companies', companyRoutes);  // Protected
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- ROUTES REDIRECTION ---
app.use('/api/analytics', verifyToken, analyticsRoutes);  // Protected
app.use('/api', homeRoutes);  // Public routes like /api/daily-task, /api/home-updates
// Ye line saare /candidates waale calls ko aapki router file par bhej degi
app.use('/candidates', verifyToken, candidateRoutes);  // Protected
app.use('/api/email', verifyToken, emailRoutes);  // Protected
app.use('/api/email-templates', verifyToken, emailTemplateRoutes);  // Protected
app.use('/api/positions', positionRoutes);  // Protected
app.use('/api/clients', clientRoutes);  // Protected
app.use('/api/sources', sourceRoutes);  // Protected
app.use('/api/export', verifyToken, exportRoutes);  // Protected
app.use('/api/email-settings', verifyToken, emailSettingsRoutes);  // Protected - per-user email settings
app.use('/api/company-email-settings', verifyToken, companyEmailSettingsRoutes);  // Protected - company-wide email settings (ENTERPRISE)
app.use('/api/notifications', verifyToken, notificationRoutes);  // Protected
app.use('/api/team', teamRoutes);  // Protected (verifyToken inside router)
app.use('/api/public', publicSubscribeRoutes);  // Public – no auth (subscribe for marketing list)
app.use('/oauth/zoho', zohoOAuthRoutes);        // Zoho Campaigns OAuth callback (get refresh_token)

// Static Folder for Uploads - always use backend/uploads (same as candidateRoutes resume + multer)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  
  // Known extensions - set proper headers
  if (['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
    res.setHeader('Content-Disposition', 'inline');
    next();
    return;
  }
  
  // No extension (legacy files) - detect MIME from file content magic bytes
  if (!ext) {
    const filePath = path.join(__dirname, 'uploads', req.path);
    if (fs.existsSync(filePath)) {
      try {
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(8);
        fs.readSync(fd, buffer, 0, 8, 0);
        fs.closeSync(fd);
        const header = buffer.toString('ascii', 0, 5);
        if (header.startsWith('%PDF')) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline');
        } else if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Content-Disposition', 'inline');
        } else if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Content-Disposition', 'inline');
        }
      } catch (e) { /* ignore detection errors */ }
    }
  }
  next();
}, express.static(uploadDir));

// Health check endpoint (for Render)
app.get('/health', (req, res) => res.json({ status: 'ok', version: 'v2', timestamp: new Date().toISOString() }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/allinone')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ Mongo Error:', err));

// Drop legacy unique indexes if they still exist + migrate orphan candidates
mongoose.connection.once('open', async () => {
  try {
    const indexes = await Candidate.collection.indexes();
    const hasContactIndex = indexes.find(idx => idx.name === 'contact_1');
    const hasEmailIndex = indexes.find(idx => idx.name === 'email_1');
    if (hasContactIndex) {
      await Candidate.collection.dropIndex('contact_1');
      console.log('✅ Dropped legacy contact_1 index');
    }
    if (hasEmailIndex) {
      await Candidate.collection.dropIndex('email_1');
      console.log('✅ Dropped legacy email_1 index');
    }
  } catch (err) {
    console.warn('⚠️ Failed to drop legacy indexes:', err.message);
  }

  // ✅ ONE-TIME MIGRATION: Assign orphan candidates (no createdBy) to first registered user
  try {
    const orphanCount = await Candidate.collection.countDocuments({ createdBy: { $exists: false } });
    if (orphanCount > 0) {
      // Find the first user in the database (likely the original admin/creator)
      const User = mongoose.model('User');
      const firstUser = await User.findOne().sort({ _id: 1 });
      if (firstUser) {
        const result = await Candidate.collection.updateMany(
          { createdBy: { $exists: false } },
          { $set: { createdBy: firstUser._id } }
        );
        console.log(`✅ MIGRATION: Assigned ${result.modifiedCount} orphan candidates to user ${firstUser.email}`);
      } else {
        console.warn('⚠️ MIGRATION: No users found to assign orphan candidates');
      }
    }
  } catch (err) {
    console.warn('⚠️ Migration error:', err.message);
  }

  // ✅ MIGRATION: Drop old global unique name indexes on master data collections & assign orphans
  const masterCollections = ['sources', 'positions', 'clients', 'companies'];
  for (const collName of masterCollections) {
    try {
      const coll = mongoose.connection.db.collection(collName);
      const indexes = await coll.indexes();
      
      // Drop any global unique index on 'name' field without createdBy
      for (const idx of indexes) {
        // DETECT PROBLEMATIC INDEX: unique on 'name' only, no createdBy
        const hasNameOnly = idx.key.name === 1 && Object.keys(idx.key).length === 1;
        const isUniqueGlobal = idx.unique === true;
        const isDefaultId = idx.name === '_id_';
        
        // ALSO detect old compound indexes that were meant to be dropped
        const isOldPattern = idx.name === 'name_1' || idx.name === 'name_1_createdBy_1';
        
        if (!isDefaultId && (isUniqueGlobal && hasNameOnly || isOldPattern)) {
          try {
            await coll.dropIndex(idx.name);
            console.log(`✅ Dropped problematic index on ${collName}: ${idx.name}`);
          } catch (dropErr) {
            console.warn(`⚠️ Could not drop index ${idx.name} on ${collName}:`, dropErr.message);
          }
        }
      }
      
      // Ensure correct compound index exists
      try {
        await coll.createIndex({ createdBy: 1, name: 1 }, { unique: true, sparse: false });
        console.log(`✅ Ensured correct index on ${collName}: (createdBy, name)`);
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.warn(`⚠️ Could not create compound index on ${collName}:`, err.message);
        }
      }
    } catch (err) {
      // Index may not exist, that's fine
      console.warn(`⚠️ Error checking indexes for ${collName}:`, err.message);
    }
    // Assign orphan records (no createdBy) to first user
    try {
      const coll = mongoose.connection.db.collection(collName);
      const orphans = await coll.countDocuments({ createdBy: { $exists: false } });
      if (orphans > 0) {
        const User = mongoose.model('User');
        const firstUser = await User.findOne().sort({ _id: 1 });
        if (firstUser) {
          const res = await coll.updateMany(
            { createdBy: { $exists: false } },
            { $set: { createdBy: firstUser._id } }
          );
          console.log(`✅ MIGRATION: Assigned ${res.modifiedCount} orphan ${collName} to ${firstUser.email}`);
        }
      }
    } catch (err) {
      console.warn(`⚠️ Migration ${collName}:`, err.message);
    }
  }
});

// --- USER SCHEMA ---
/**
 * USER SCHEMA - INCLUDES OPTIONAL PER-USER EMAIL CONFIGURATION
 * 
 * emailSettings FIELD PURPOSE:
 * Allows each user to configure their own personal email (different from company-wide config)
 * 
 * USE CASE:
 * - Some employees want to send from their personal Gmail
 * - Some want personal Zoho Zeptomail account
 * - Others just use company-wide config (falls back automatically)
 * 
 * DATABASE SECURITY - SENSITIVE FIELDS:
 * ⚠️  CRITICAL: These fields contain authentication credentials:
 *     - smtpAppPassword: Plain text password (should be app-specific password, not user password)
 *     - zohoZeptomailApiKey: Can authenticate to Zoho API (same risk as password)
 *
 * ✅ PROTECTION MEASURES:
 *     - NEVER return full credentials to frontend (only return hasPassword: boolean flags)
 *     - These are stored at-rest in MongoDB (no encryption yet - TODO: Add field-level encryption)
 *     - Only exposed to backend process and HTTPS API calls to Zoho
 *     - Never logged in error messages (avoid console.log with emailSettings)
 *     - All endpoints requiring these use verifyToken middleware
 *     - TODO: Add role-based access - users only modify their own emailSettings
 *
 * ✅ CASCADING PRIORITY (when sending email):
 *     1. If user.emailSettings.isConfigured? → Use their personal config
 *     2. If not, check CompanyEmailConfig → ALL employees share company API key
 *     3. If neither, email cannot be sent (error)
 * 
 * FRONTEND INTERACTION:
 * - emailSettingsRoutes.js always masks credentials when returning user data
 * - Frontend shows "API Key: ••••••••••••••" not the actual key
 * - Only full credentials stored/transmitted server-side
 */
const userSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    email: { type: String, required: true, unique: true },
    phone: { type: String, default: '' },
    password: { type: String, required: true },
    profilePicture: { type: String, default: '' },
    emailSettings: {
        // SMTP Configuration - User's personal SMTP (optional, overrides company config)
        smtpEmail: { type: String, default: '' },
        smtpAppPassword: { type: String, default: '' },  // ⚠️  SENSITIVE - Never expose via API
        smtpProvider: { type: String, default: 'gmail' },  // gmail | zoho | custom
        smtpHost: { type: String, default: '' },
        smtpPort: { type: Number, default: 587 },
        
        // Zoho Zeptomail Configuration - User's personal API (optional, overrides company config)
        zohoZeptomailApiKey: { type: String, default: '' },  // ⚠️  SENSITIVE - Never expose via API (mask as •••••)
        zohoZeptomailApiUrl: { type: String, default: '' },  // e.g., https://api.zeptomail.com/ or https://api.zeptomail.eu/
        zohoZeptomailBounceAddress: { type: String, default: '' },  // For bounce handling
        zohoZeptomailFromEmail: { type: String, default: '' },  // Email to send from
        
        isConfigured: { type: Boolean, default: false },  // Set to true when user configures either SMTP or Zoho
        emailProvider: { type: String, default: 'smtp' }  // 'smtp' or 'zoho-zeptomail' (which to use)
    }
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

// ─── COMPANY EMAIL CONFIGURATION SCHEMA (Enterprise-wide settings) ───
/**
 * DATABASE STRUCTURE FOR COMPANY-WIDE EMAIL CONFIGURATION
 * 
 * PURPOSE:
 * Stores single email configuration that ALL employees use automatically.
 * Instead of creating 30-50 individual Zoho Zeptomail accounts, company 
 * admin creates ONE and all employees share it.
 * 
 * SECURITY NOTES:
 * ⚠️  SENSITIVE DATA STORAGE:
 *   - zohoZeptomailApiKey: Treat like a password (can authenticate to Zoho)
 *   - smtpAppPassword: Same sensitivity as API key
 *   - These should ideally be encrypted at-rest in MongoDB 
 *   - Currently stored as plain text (TODO: Add field-level encryption)
 * 
 * ✅ EXPOSURE PREVENTION:
 *   - Routes always mask these values before returning to frontend
 *   - Frontend only receives boolean flags (hasZohoApiKey, hasSmtpPassword)
 *   - Full values only used server-side for API calls to Zoho
 *   - Never logged in error messages (be careful with console.log)
 *   - Never sent to analytics/monitoring services
 * 
 * ✅ ACCESS CONTROL:
 *   - All config routes require JWT (verifyToken middleware)
 *   - TODO: Add admin/owner role check to prevent regular users changing
 *   - TODO: Rate limit config changes (e.g., max 5 changes/hour)
 * 
 * ✅ AUDIT TRAIL:
 *   - configuredBy: Which user (admin) set this up
 *   - configuredAt: When it was first configured
 *   - lastModifiedBy: Which user last changed it
 *   - lastModifiedAt: When it was last modified
 *   - You can audit who made what changes to email config
 * 
 * MULTI-TENANT TODO:
 *   - Currently hardcoded as companyId: 'default-company'
 *   - For true multi-tenant, change to companyId: req.user.companyId
 *   - Then each company has isolated email config, no cross-contamination
 */
const companyEmailConfigSchema = new mongoose.Schema({
    // Only one config per company (ideally one per organization/workspace)
    companyId: { type: String, default: 'default-company' },  // For multi-tenant scenarios
    
    // ✅ Zoho Zeptomail (Company-wide - all employees use SAME API key)
    // SECURITY: These are SENSITIVE - treat like passwords
    zohoZeptomailApiKey: { type: String, default: '' },  // API authentication key
    zohoZeptomailApiUrl: { type: String, default: 'https://api.zeptomail.com/' },  // API endpoint
    zohoZeptomailFromEmail: { type: String, default: '' },  // Company domain email (e.g., noreply@company.com)
    zohoZeptomailBounceAddress: { type: String, default: '' },  // Where to route bounced emails
    
    // SMTP (Company-wide fallback)
    // SECURITY: smtpAppPassword is also SENSITIVE
    smtpEmail: { type: String, default: '' },
    smtpAppPassword: { type: String, default: '' },  // NOT plain password, should be app-specific password
    smtpProvider: { type: String, default: 'gmail' },  // 'gmail', 'yahoo', 'outlook', 'custom', 'zoho-smtp'
    smtpHost: { type: String, default: '' },
    smtpPort: { type: Number, default: 587 },
    
    // Configuration status
    primaryProvider: { type: String, default: 'zoho-zeptomail' },  // Which to use: 'zoho-zeptomail' or 'smtp'
    isConfigured: { type: Boolean, default: false },
    
    // Audit trail - who did what and when
    configuredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // Admin who configured it
    configuredAt: { type: Date, default: Date.now },
    lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastModifiedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const CompanyEmailConfig = mongoose.model('CompanyEmailConfig', companyEmailConfigSchema);

/* ================= AUTH ROUTES ================= */
app.post('/api/login', async (req, res) => {
    try {
        console.log('🔵 [LOGIN] Request received:', { email: req.body?.email, passwordLength: req.body?.password?.length || 0 });
        
        const { email, password } = req.body;
        
        if (!email || !password) {
            console.log('🔴 [LOGIN] Missing email or password');
            return res.status(400).json({ message: 'Email and password required' });
        }
        
        console.log('🔵 [LOGIN] Querying User model for email:', email);
        const user = await User.findOne({ email });
        console.log('🔵 [LOGIN] User lookup result:', user ? `Found user ${user.email}` : 'User not found');
        
        // Check if email exists
        if (!user) {
            console.log('🟡 [LOGIN] Email not found:', email);
            return res.status(401).json({ 
                message: "email_not_found",
                displayMessage: "Email not registered. Please sign up first."
            });
        }
        
        // Check if password is correct
        console.log('🔵 [LOGIN] Comparing passwords...');
        
        // Try bcrypt first (if password is hashed), then fallback to plain text (for backward compatibility)
        let passwordMatch = false;
        
        if (user.password.startsWith('$2')) {
            // Password is hashed with bcrypt
            try {
                passwordMatch = await bcrypt.compare(password, user.password);
                console.log('🔵 [LOGIN] Bcrypt comparison result:', passwordMatch);
            } catch (bcryptErr) {
                console.error('🔴 [LOGIN] Bcrypt comparison error:', bcryptErr.message);
                // Fallback to plain text comparison
                passwordMatch = (user.password === password);
            }
        } else {
            // Plain text password (backward compatibility)
            console.log('🔵 [LOGIN] Using plain text comparison (backward compatibility)');
            passwordMatch = (user.password === password);
            
            // If plain text match succeeds, upgrade to hashed password
            if (passwordMatch) {
                console.log('🔵 [LOGIN] Upgrading plain text password to bcrypt hash...');
                const hashedPassword = await bcrypt.hash(password, 10);
                user.password = hashedPassword;
                await user.save();
                console.log('🟢 [LOGIN] Password upgraded to bcrypt hash');
            }
        }
        
        if (!passwordMatch) {
            console.log('🟡 [LOGIN] Password mismatch for user:', email);
            return res.status(401).json({ 
                message: "invalid_password",
                displayMessage: "Invalid password. Please try again."
            });
        }
        
        console.log('🟢 [LOGIN] Password correct, generating token...');
        // Generate JWT token
        const token = generateToken(user);
        console.log('🟢 [LOGIN] Token generated successfully');
        
        res.json({ 
            message: "Login Successful", 
            token: token,
            user: { name: user.name || '', email: user.email, phone: user.phone || '' } 
        });
        console.log('🟢 [LOGIN] Response sent successfully for user:', email);
    } catch (err) { 
        console.error('🔴 [LOGIN] ERROR:', err.message, err.stack);
        res.status(500).json({ message: err.message }); 
    }
});

/* ================= REGISTER ROUTE ================= */
app.post('/register', async (req, res) => {
    try {
        console.log('🔵 [REGISTER] Request received for email:', req.body?.email);
        
        const { name, email, phone, password } = req.body;
        if (!email || !password) {
            console.log('🟡 [REGISTER] Missing email or password');
            return res.status(400).json({ message: 'Email and password required' });
        }

        console.log('🔵 [REGISTER] Checking if user exists:', email);
        const existing = await User.findOne({ email });
        if (existing) {
            console.log('🟡 [REGISTER] User already exists:', email);
            return res.status(400).json({ message: 'User already exists' });
        }

        console.log('🔵 [REGISTER] Hashing password and creating new user for email:', email);
        
        // Hash the password with bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({ 
            name: normalizeText(name || ''), 
            email, 
            phone: phone?.trim() || '', 
            password: hashedPassword 
        });
        await newUser.save();
        
        console.log('🟢 [REGISTER] User created successfully with hashed password:', email);
        return res.status(201).json({ message: 'Registration successful' });
    } catch (err) {
        console.error('🔴 [REGISTER] ERROR:', err.message, err.stack);
        return res.status(500).json({ message: 'Server error' });
    }
});

/* ================= PROFILE ROUTES ================= */

// GET profile
app.get('/api/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -emailSettings');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, user: { name: user.name, email: user.email, phone: user.phone, profilePicture: user.profilePicture || '' } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// UPDATE profile (name, phone)
app.put('/api/profile', verifyToken, async (req, res) => {
    try {
        const { name, phone } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (name !== undefined) user.name = normalizeText(name);
        if (phone !== undefined) user.phone = phone.trim();
        await user.save();

        // Return updated token with new name
        const token = generateToken(user);
        res.json({ success: true, message: 'Profile updated successfully', user: { name: user.name, email: user.email, phone: user.phone, profilePicture: user.profilePicture || '' }, token });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// UPLOAD profile picture
const multerProfile = require('multer');
const profilePicUpload = multerProfile({
    storage: multerProfile.diskStorage({
        destination: path.join(__dirname, 'uploads'),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname) || '.jpg';
            cb(null, `profile-${req.user.id}-${Date.now()}${ext}`);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Only image files (JPG, PNG, GIF, WebP) are allowed'));
    }
});

app.put('/api/profile/picture', verifyToken, profilePicUpload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided' });
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Delete old profile picture if exists
        if (user.profilePicture) {
            const oldPath = path.join(__dirname, user.profilePicture);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        user.profilePicture = `/uploads/${req.file.filename}`;
        await user.save();

        res.json({ success: true, message: 'Profile picture updated', profilePicture: user.profilePicture });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/profile/picture', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (user.profilePicture) {
            const picPath = path.join(__dirname, user.profilePicture);
            if (fs.existsSync(picPath)) fs.unlinkSync(picPath);
        }
        user.profilePicture = '';
        await user.save();

        res.json({ success: true, message: 'Profile picture removed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// CHANGE password
app.put('/api/profile/change-password', verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Current and new password required' });
        if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        // Verify current password using bcrypt (with backward compatibility for plain text)
        let passwordMatch = false;
        if (user.password.startsWith('$2')) {
            // Password is hashed with bcrypt
            try {
                passwordMatch = await bcrypt.compare(currentPassword, user.password);
            } catch (bcryptErr) {
                // Fallback to plain text comparison
                passwordMatch = (user.password === currentPassword);
            }
        } else {
            // Plain text password (backward compatibility)
            passwordMatch = (user.password === currentPassword);
        }
        
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }

        // Hash the new password before saving
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ================= PASSWORD RESET ROUTES ================= */
const jwt = require('jsonwebtoken');
const { sendEmail } = require('./services/emailService');

// Step 1: Request password reset (sends email with reset link)
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            // Don't reveal if user exists or not (security best practice)
            return res.json({ success: true, message: 'If this email is registered, you will receive a reset link.' });
        }

        // Generate a short-lived reset token (15 minutes)
        const resetToken = jwt.sign(
            { id: user._id, email: user.email, purpose: 'password-reset' },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        // Build reset URL (use frontend URL)
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

        // Send reset email
        try {
            // Try to use company/user email config for sending
            const htmlBody = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #4F46E5, #7C3AED); border-radius: 12px 12px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset</h1>
                        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">SkillNix ATS</p>
                    </div>
                    <div style="padding: 30px 20px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
                        <p style="color: #374151; font-size: 15px; line-height: 1.6;">Hi ${user.name || 'there'},</p>
                        <p style="color: #374151; font-size: 15px; line-height: 1.6;">We received a request to reset your password. Click the button below to create a new password:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Reset My Password</a>
                        </div>
                        <p style="color: #6B7280; font-size: 13px; line-height: 1.6;">This link expires in <strong>15 minutes</strong>. If you didn't request this, you can safely ignore this email.</p>
                        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
                        <p style="color: #9CA3AF; font-size: 12px;">If the button doesn't work, copy and paste this URL:<br><a href="${resetUrl}" style="color: #4F46E5; word-break: break-all;">${resetUrl}</a></p>
                    </div>
                </div>
            `;

            await sendEmail(
                user.email,
                'Reset Your Password - SkillNix ATS',
                htmlBody,
                `Reset your password: ${resetUrl} (expires in 15 minutes)`,
                { userId: user._id }
            );
        } catch (emailErr) {
            console.error('[PASSWORD-RESET] Email send failed:', emailErr.message);
            // Even if email fails, don't crash - user can still use the token if they have it
            // But we should let the user know
            if (emailErr.message === 'EMAIL_NOT_CONFIGURED') {
                // Fallback: return the token directly so the user can reset via URL
                return res.json({
                    success: true,
                    message: 'Email service not configured. Use the direct reset link.',
                    resetUrl: resetUrl
                });
            }
        }

        res.json({ success: true, message: 'If this email is registered, you will receive a reset link.' });
    } catch (err) {
        console.error('[PASSWORD-RESET] Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to process password reset request' });
    }
});

// Step 2: Verify reset token
app.get('/api/auth/verify-reset-token', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.purpose !== 'password-reset') {
            return res.status(400).json({ success: false, message: 'Invalid token type' });
        }

        res.json({ success: true, email: decoded.email });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(400).json({ success: false, message: 'Reset link has expired. Please request a new one.' });
        }
        res.status(400).json({ success: false, message: 'Invalid or expired reset link' });
    }
});

// Step 3: Reset password with token
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Token and new password required' });
        if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.purpose !== 'password-reset') {
            return res.status(400).json({ success: false, message: 'Invalid token type' });
        }

        const user = await User.findById(decoded.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ success: true, message: 'Password reset successfully. You can now login with your new password.' });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(400).json({ success: false, message: 'Reset link has expired. Please request a new one.' });
        }
        res.status(500).json({ success: false, message: 'Failed to reset password' });
    }
});

// GET account stats (for profile page)
app.get('/api/profile/stats', verifyToken, async (req, res) => {
    try {
        const candidateCount = await Candidate.countDocuments({ createdBy: req.user.id });
        const user = await User.findById(req.user.id).select('emailSettings.isConfigured createdAt');
        const memberSince = user?.createdAt || (user?._id ? user._id.getTimestamp() : null);
        res.json({
            success: true,
            stats: {
                totalCandidates: candidateCount,
                emailConfigured: user?.emailSettings?.isConfigured || false,
                memberSince
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ================= JOB ROUTES ================= */
app.get('/jobs', verifyToken, async (req, res) => {
    try {
        const { isTemplate } = req.query;
        const query = isTemplate === 'true' ? { isTemplate: true } : { $or: [{ isTemplate: false }, { isTemplate: { $exists: false } }] };
        const jobs = await Job.find(query).sort({ createdAt: -1 });
        res.json(jobs);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/jobs', verifyToken, async (req, res) => {
    try {
        const newJob = new Job(req.body);
        await newJob.save();
        res.status(201).json(newJob);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  const s3Resume = require('./services/s3Service').isS3Configured();
  console.log(s3Resume
    ? `[Resume storage] S3 — bucket: ${process.env.S3_BUCKET_NAME}, folder: ${process.env.S3_RESUME_PREFIX || 'resumes'}`
    : '[Resume storage] Local (uploads/) — set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME to use S3');
  // Start the callback reminder notification scheduler
  startNotificationScheduler();
});

// Ye do lines wait time badha dengi taaki Network Error na aaye
server.timeout = 600000; 
server.keepAliveTimeout = 61000;

/* ========== DIAGNOSTICS ========== */
app.get('/diagnostics', async (req, res) => {
    try {
        const dbName = mongoose.connection.name || (mongoose.connection.db && mongoose.connection.db.databaseName) || 'unknown';
        const userCount = await User.countDocuments().catch(() => 0);
        const jobCount = await Job.countDocuments().catch(() => 0);
        const candidateCount = await Candidate.countDocuments().catch(() => 0);
        const jdCount = await JDTemplate.countDocuments().catch(() => 0);

        return res.json({
            connected: mongoose.connection.readyState === 1,
            dbName,
            counts: {
                users: userCount,
                jobs: jobCount,
                candidates: candidateCount,
                jdTemplates: jdCount
            }
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});

/* ========== SEED DATA ========== */
app.get('/seed-candidates', async (req, res) => {
  try {
    const sampleCandidates = [
      {
        name: 'Mansi Rathor',
        email: 'mansi.rathor@example.com',
        contact: '9876543210',
        position: 'Full Stack Developer',
        location: 'Mumbai',
        companyName: 'Tech Corp',
        experience: '3 years',
        ctc: '12 LPA',
        expectedCtc: '15 LPA',
        status: 'Interview',
        date: new Date().toISOString().split('T')[0],
        source: 'LinkedIn'
      },
      {
        name: 'Rajesh Kumar',
        email: 'rajesh.k@example.com',
        contact: '9876543211',
        position: 'Senior Developer',
        location: 'Bangalore',
        companyName: 'InfoTech',
        experience: '5 years',
        ctc: '18 LPA',
        expectedCtc: '22 LPA',
        status: 'Offer',
        date: new Date().toISOString().split('T')[0],
        source: 'Referral'
      },
      {
        name: 'Priya Singh',
        email: 'priya.singh@example.com',
        contact: '9876543212',
        position: 'Frontend Engineer',
        location: 'Delhi',
        companyName: 'Digital Solutions',
        experience: '2 years',
        ctc: '10 LPA',
        expectedCtc: '12 LPA',
        status: 'Screening',
        date: new Date().toISOString().split('T')[0],
        source: 'Indeed'
      },
      {
        name: 'Arjun Patel',
        email: 'arjun.patel@example.com',
        contact: '9876543213',
        position: 'DevOps Engineer',
        location: 'Pune',
        companyName: 'Cloud Innovations',
        experience: '4 years',
        ctc: '14 LPA',
        expectedCtc: '16 LPA',
        status: 'Applied',
        date: new Date().toISOString().split('T')[0],
        source: 'LinkedIn'
      },
      {
        name: 'Neha Sharma',
        email: 'neha.sharma@example.com',
        contact: '9876543214',
        position: 'Backend Developer',
        location: 'Hyderabad',
        companyName: 'StartUp XYZ',
        experience: '3 years',
        ctc: '11 LPA',
        expectedCtc: '14 LPA',
        status: 'Hired',
        date: new Date().toISOString().split('T')[0],
        source: 'Referral'
      }
    ];

    // Insert candidates
    await Candidate.insertMany(sampleCandidates);
    
    // Also create a sample user for login
    const sampleUser = new User({
      email: 'admin@example.com',
      password: 'admin123'
    });
    await sampleUser.save().catch(() => null); // Ignore if already exists

    return res.json({
      success: true,
      message: `✅ Seeded ${sampleCandidates.length} candidates!`,
      candidates: sampleCandidates
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
