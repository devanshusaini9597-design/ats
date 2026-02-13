

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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
const notificationRoutes = require('./routes/notificationRoutes');
const { startNotificationScheduler } = require('./services/notificationService');
const { verifyToken, generateToken } = require('./middleware/authMiddleware');

// Models Import (Sirf User aur Job yahan rakhein, Candidate routes mein handle hoga)
const Job = require('./models/Job');
const Candidate = require('./models/Candidate');
const JDTemplate = require('./models/JDTemplate');

const app = express();
const PORT = 5000;

// Set timeout for large file uploads (5 minutes)
app.use((req, res, next) => {
  req.setTimeout(600000); // 10 minutes
  res.setTimeout(600000);
  next();
});

// Middleware
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174"] }));
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
app.use('/api/email-settings', verifyToken, emailSettingsRoutes);  // Protected
app.use('/api/notifications', verifyToken, notificationRoutes);  // Protected

// Static Folder for Uploads - serve with inline disposition for preview
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
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
}, express.static(path.join(__dirname, 'uploads')));

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
const userSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    email: { type: String, required: true, unique: true },
    phone: { type: String, default: '' },
    password: { type: String, required: true },
    emailSettings: {
        smtpEmail: { type: String, default: '' },
        smtpAppPassword: { type: String, default: '' },
        smtpProvider: { type: String, default: 'gmail' },  // gmail | custom
        smtpHost: { type: String, default: '' },
        smtpPort: { type: Number, default: 587 },
        isConfigured: { type: Boolean, default: false }
    }
});
const User = mongoose.model('User', userSchema);

/* ================= AUTH ROUTES ================= */
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        // Check if email exists
        if (!user) {
            return res.status(401).json({ 
                message: "email_not_found",
                displayMessage: "Email not registered. Please sign up first."
            });
        }
        
        // Check if password is correct
        if (user.password !== password) {
            return res.status(401).json({ 
                message: "invalid_password",
                displayMessage: "Invalid password. Please try again."
            });
        }
        
        // Generate JWT token
        const token = generateToken(user);
        
        res.json({ 
            message: "Login Successful", 
            token: token,
            user: { name: user.name || '', email: user.email, phone: user.phone || '' } 
        });
    } catch (err) { 
        res.status(500).json({ message: err.message }); 
    }
});

/* ================= REGISTER ROUTE ================= */
app.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ message: 'User already exists' });

        const newUser = new User({ name: name || '', email, phone: phone || '', password });
        await newUser.save();

        return res.status(201).json({ message: 'Registration successful' });
    } catch (err) {
        console.error('Register Error:', err.message);
        return res.status(500).json({ message: 'Server error' });
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
