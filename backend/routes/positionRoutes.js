const express = require('express');
const router = express.Router();
const { getPositions, createPosition, updatePosition, deletePosition } = require('../controller/positionController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Routes
router.get('/', getPositions);
router.post('/', createPosition);
router.put('/:id', updatePosition);
router.delete('/:id', deletePosition);

module.exports = router;
