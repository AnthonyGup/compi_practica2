const { parseWisonWithJison } = require('../parsers/wison.parser');
const { tokenizeInput } = require('../services/lexer.service');

function tokenizeWithGeneratedLexer(req, res) {
  const { source, input } = req.body || {};

  if (typeof source !== 'string' || !source.trim()) {
    return res.status(400).json({
      ok: false,
      errors: ['El campo "source" es obligatorio y debe ser texto.']
    });
  }

  if (typeof input !== 'string') {
    return res.status(400).json({
      ok: false,
      errors: ['El campo "input" es obligatorio y debe ser texto.']
    });
  }

  try {
    const grammar = parseWisonWithJison(source);

    if (!grammar.ok) {
      return res.status(400).json({
        ok: false,
        grammar,
        errors: ['No se puede generar lexer porque la gramatica no es valida.']
      });
    }

    const lexicalResult = tokenizeInput(input, grammar.terminals);
    const statusCode = lexicalResult.ok ? 200 : 400;

    return res.status(statusCode).json({
      ok: lexicalResult.ok,
      grammar,
      lexical: lexicalResult
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      errors: [error.message]
    });
  }
}

module.exports = {
  tokenizeWithGeneratedLexer
};
