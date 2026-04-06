const { parseWisonWithJison } = require('../parsers/wison.parser');

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
    return res.status(200).json({ ok: true, grammar: result });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      errors: [error.message]
    });
  }
}

module.exports = { generateAnalyzer };
