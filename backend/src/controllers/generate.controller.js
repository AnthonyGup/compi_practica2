const { parseWisonWithJison } = require('../parsers/wison.parser');
const { validateRequiredTextFields, respondWithNormalizedError } = require('../utils/controller-helpers');

function generateAnalyzer(req, res) {
  const validation = validateRequiredTextFields(req.body, ['source']);

  if (!validation.ok) {
    return res.status(validation.statusCode).json(validation.payload);
  }

  try {
    const { source } = validation.values;
    const result = parseWisonWithJison(source);
    if (!result.ok) {
      return res.status(400).json({ ok: false, grammar: result });
    }

    return res.status(200).json({ ok: true, grammar: result });
  } catch (error) {
    return respondWithNormalizedError(res, error);
  }
}

module.exports = { generateAnalyzer };
