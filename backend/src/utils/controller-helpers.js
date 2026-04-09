const { normalizeErrorMessage } = require('./error-messages');

function validateRequiredTextFields(body, fieldNames) {
  const values = {};
  const errors = [];

  for (const fieldName of fieldNames) {
    const value = body && body[fieldName];

    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`El campo "${fieldName}" es obligatorio y debe ser texto.`);
      continue;
    }

    values[fieldName] = value;
  }

  if (errors.length > 0) {
    return {
      ok: false,
      statusCode: 400,
      payload: {
        ok: false,
        errors
      }
    };
  }

  return {
    ok: true,
    values
  };
}

function respondWithNormalizedError(res, error, statusCode = 400) {
  return res.status(statusCode).json({
    ok: false,
    errors: [normalizeErrorMessage(error)]
  });
}

module.exports = {
  validateRequiredTextFields,
  respondWithNormalizedError
};