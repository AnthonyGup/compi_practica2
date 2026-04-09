function extractLineNumber(message) {
  const lineMatch = message.match(/line\s+(\d+)/i);
  if (!lineMatch) {
    return null;
  }

  return Number(lineMatch[1]);
}

function normalizeErrorMessage(error, fallbackMessage = 'Ocurrio un error al procesar la solicitud.') {
  const rawMessage = (error && error.message ? String(error.message) : '').trim();

  if (!rawMessage) {
    return fallbackMessage;
  }

  const alreadySpanishPatterns = [
    /sintaxis invalida/i,
    /estructura wison invalida/i,
    /no se pudo/i,
    /no se puede/i,
    /error lexico/i,
    /se esperaba/i,
    /produccion/i,
    /gramatica/i,
    /recursividad/i,
    /no terminal/i,
    /terminal/i
  ];

  if (alreadySpanishPatterns.some((pattern) => pattern.test(rawMessage))) {
    return rawMessage;
  }

  if (/parse error/i.test(rawMessage)) {
    const line = extractLineNumber(rawMessage);
    if (line) {
      return `Estructura Wison invalida cerca de la linea ${line}. Verifica palabras clave y delimitadores.`;
    }

    return 'Estructura Wison invalida. Verifica palabras clave y delimitadores del lenguaje Wison.';
  }

  if (/unexpected end/i.test(rawMessage)) {
    return 'Estructura Wison incompleta. Falta cerrar algun bloque o declaracion.';
  }

  if (/enoent|no such file/i.test(rawMessage)) {
    return 'No se encontro un archivo requerido para procesar la solicitud.';
  }

  return fallbackMessage;
}

module.exports = {
  normalizeErrorMessage
};