const express = require('express');
const router = express.Router();
const { getSources, createSource, updateSource, deleteSource } = require('../controller/sourceController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Routes
router.get('/', getSources);
router.post('/', createSource);
router.put('/:id', updateSource);
router.delete('/:id', deleteSource);

module.exports = router;
