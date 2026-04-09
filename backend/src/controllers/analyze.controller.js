const { parseWisonWithJison } = require('../parsers/wison.parser');
const { tokenizeInput } = require('../services/lexer.service');
const { parseTokensWithLL } = require('../services/ll-parser.service');
const { validateRequiredTextFields, respondWithNormalizedError } = require('../utils/controller-helpers');

function analyzeInput(req, res) {
  const validation = validateRequiredTextFields(req.body, ['source', 'input']);

  if (!validation.ok) {
    return res.status(validation.statusCode).json(validation.payload);
  }

  try {
    const { source, input } = validation.values;
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
    return respondWithNormalizedError(res, error);
  }
}

module.exports = {
  analyzeInput
};
