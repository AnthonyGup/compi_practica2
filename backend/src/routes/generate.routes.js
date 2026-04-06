const express = require('express');
const { generateAnalyzer } = require('../controllers/generate.controller');

const router = express.Router();

router.post('/', generateAnalyzer);

module.exports = router;
