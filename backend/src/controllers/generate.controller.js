const { parseWisonWithJison } = require('../parsers/wison.parser');
const { normalizeErrorMessage } = require('../utils/error-messages');

function generateAnalyzer(req, res) {
  const { source } = req.body || {};

  if (typeof source !== 'string' || !source.trim()) {
    return res.status(400).json({
      ok: false,
      errors: ['El campo "source" es obligatorio y debe ser texto.']
    });
  }

  try {
    const result = parseWisonWithJison(source);
    if (!result.ok) {
      return res.status(400).json({ ok: false, grammar: result });
    }

    return res.status(200).json({ ok: true, grammar: result });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      errors: [normalizeErrorMessage(error)]
    });
  }
}

module.exports = { generateAnalyzer };
