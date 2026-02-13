const express = require('express');
const router = express.Router();
const { getClients, createClient, updateClient, deleteClient } = require('../controller/clientController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Routes
router.get('/', getClients);
router.post('/', createClient);
router.put('/:id', updateClient);
router.delete('/:id', deleteClient);

module.exports = router;
