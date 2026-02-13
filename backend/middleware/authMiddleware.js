const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token AND check user still exists
const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1] || req.query.token;

        if (!token) {
            return res.status(401).json({ message: 'Authorization token required' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if user still exists in database
        const User = mongoose.model('User');
        const userExists = await User.findById(decoded.id).select('_id').lean();
        if (!userExists) {
            return res.status(401).json({ message: 'USER_DELETED', displayMessage: 'Your account no longer exists. Please register again.' });
        }
        
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired. Please login again.' });
        }
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, email: user.email, name: user.name || '' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

module.exports = { verifyToken, generateToken, JWT_SECRET };
