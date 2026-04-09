const express = require('express');
const { tokenizeWithGeneratedLexer } = require('../controllers/tokenize.controller');

const router = express.Router();

router.post('/', tokenizeWithGeneratedLexer);

module.exports = router;
