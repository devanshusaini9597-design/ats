// backend/routes/exportRoutes.js
const express = require('express');
const router = express.Router();
const { exportReport, previewReport } = require('../controller/exportController');

router.post('/report', exportReport);
router.post('/preview', previewReport);

module.exports = router;
