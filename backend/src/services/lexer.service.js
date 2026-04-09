function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenizeExpression(expression) {
  const tokens = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === '(' || char === ')' || char === '*' || char === '+' || char === '?') {
      tokens.push({ type: 'symbol', value: char });
      index += 1;
      continue;
    }

    if (char === '[') {
      const end = expression.indexOf(']', index);
      if (end === -1) {
        throw new Error(`Expresion Lex invalida: clase sin cierre en ${expression}`);
      }

      tokens.push({ type: 'class', value: expression.slice(index, end + 1) });
      index = end + 1;
      continue;
    }

    if (char === "'") {
      const end = expression.indexOf("'", index + 1);
      if (end === -1) {
        throw new Error(`Expresion Lex invalida: literal sin cierre en ${expression}`);
      }

      tokens.push({ type: 'literal', value: expression.slice(index + 1, end) });
      index = end + 1;
      continue;
    }

    if (char === '$' && expression[index + 1] === '_') {
      let end = index + 2;
      while (end < expression.length && /[A-Za-z0-9_]/.test(expression[end])) {
        end += 1;
      }

      tokens.push({ type: 'reference', value: expression.slice(index, end) });
      index = end;
      continue;
    }

    throw new Error(`Expresion Lex invalida: token no reconocido cerca de '${expression.slice(index)}'`);
  }

  return tokens;
}

function expressionToRegex(expression, resolveReference) {
  const tokens = tokenizeExpression(expression);
  let regex = '';

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token.type === 'symbol') {
      if (token.value === '(' || token.value === ')' || token.value === '*' || token.value === '+' || token.value === '?') {
        regex += token.value;
      }
      continue;
    }

    if (token.type === 'class') {
      if (token.value !== '[aA-zZ]' && token.value !== '[0-9]') {
        throw new Error(`Clase no permitida en Lex: ${token.value}`);
      }

      regex += token.value;
      continue;
    }

    if (token.type === 'literal') {
      regex += escapeRegex(token.value);
      continue;
    }

    if (token.type === 'reference') {
      const referenceRegex = resolveReference(token.value);
      regex += `(?:${referenceRegex})`;
      continue;
    }
  }

  return regex;
}

function compileTerminalRegexMap(terminals) {
  const terminalMap = new Map();
  const building = new Set();

  for (const terminal of terminals) {
    terminalMap.set(terminal.name, terminal.expression);
  }

  const compiled = new Map();

  function resolveTerminal(name) {
    if (compiled.has(name)) {
      return compiled.get(name);
    }

    if (building.has(name)) {
      throw new Error(`Referencia circular en terminales Lex: ${name}`);
    }

    const expression = terminalMap.get(name);
    if (!expression) {
      throw new Error(`Terminal referenciado no existe: ${name}`);
    }

    building.add(name);
    const regexBody = expressionToRegex(expression, resolveTerminal);
    building.delete(name);

    compiled.set(name, regexBody);
    return regexBody;
  }

  for (const terminal of terminals) {
    resolveTerminal(terminal.name);
  }

  return terminals.map((terminal) => ({
    name: terminal.name,
    expression: terminal.expression,
    regexBody: compiled.get(terminal.name),
    regex: new RegExp(`^(?:${compiled.get(terminal.name)})`)
  }));
}

function tokenizeInput(input, terminals) {
  const compiledTerminals = compileTerminalRegexMap(terminals);
  const tokens = [];
  const errors = [];
  let position = 0;
  let line = 1;
  let column = 1;

  while (position < input.length) {
    const char = input[position];

    if (/\s/.test(char)) {
      if (char === '\n') {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
      position += 1;
      continue;
    }

    const chunk = input.slice(position);
    let bestMatch = null;

    for (const terminal of compiledTerminals) {
      const match = chunk.match(terminal.regex);

      if (!match || match[0].length === 0) {
        continue;
      }

      if (!bestMatch || match[0].length > bestMatch.lexeme.length) {
        bestMatch = {
          type: terminal.name,
          lexeme: match[0],
          line,
          column
        };
      }
    }

    if (!bestMatch) {
      errors.push(`Error lexico en linea ${line}, columna ${column}: caracter inesperado '${char}'.`);
      break;
    }

    tokens.push(bestMatch);

    for (const matchedChar of bestMatch.lexeme) {
      if (matchedChar === '\n') {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
    }

    position += bestMatch.lexeme.length;
  }

  return {
    ok: errors.length === 0,
    tokens,
    errors,
    terminals: compiledTerminals.map((terminal) => ({
      name: terminal.name,
      expression: terminal.expression,
      regex: terminal.regexBody
    }))
  };
}

module.exports = {
  tokenizeInput
};
