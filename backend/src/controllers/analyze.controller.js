const { parseWisonWithJison } = require('../parsers/wison.parser');
const { tokenizeInput } = require('../services/lexer.service');
const { parseTokensWithLL } = require('../services/ll-parser.service');
const { normalizeErrorMessage } = require('../utils/error-messages');

function analyzeInput(req, res) {
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
        errors: ['No se puede analizar entrada porque la gramatica no es valida.']
      });
    }

    const lexical = tokenizeInput(input, grammar.terminals);

    if (!lexical.ok) {
      return res.status(400).json({
        ok: false,
        grammar,
        lexical,
        syntax: {
          ok: false,
          accepted: false,
          errors: ['No se ejecutó el parser LL por errores léxicos.'],
          steps: []
        }
      });
    }

    const syntax = parseTokensWithLL(lexical.tokens, grammar);
    const statusCode = syntax.ok ? 200 : 400;

    return res.status(statusCode).json({
      ok: syntax.ok,
      grammar,
      lexical,
      syntax
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      errors: [normalizeErrorMessage(error)]
    });
  }
}

module.exports = {
  analyzeInput
};
