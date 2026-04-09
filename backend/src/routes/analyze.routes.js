const express = require('express');
const { analyzeInput } = require('../controllers/analyze.controller');

const router = express.Router();

router.post('/', analyzeInput);

module.exports = router;
