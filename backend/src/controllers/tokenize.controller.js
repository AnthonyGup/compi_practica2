const { parseWisonWithJison } = require('../parsers/wison.parser');
const { tokenizeInput } = require('../services/lexer.service');
const { validateRequiredTextFields, respondWithNormalizedError } = require('../utils/controller-helpers');

function tokenizeWithGeneratedLexer(req, res) {
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
    return respondWithNormalizedError(res, error);
  }
}

module.exports = {
  tokenizeWithGeneratedLexer
};
