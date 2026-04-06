const fs = require('fs');
const path = require('path');
const { Parser } = require('jison');

const grammarPath = path.join(__dirname, 'wison.configuration.jison');
const grammarSource = fs.readFileSync(grammarPath, 'utf8');
const blockParser = new Parser(grammarSource);

function extractTerminals(lexRaw) {
  const terminals = [];
  const lines = lexRaw.split(/\r?\n/);

  for (const line of lines) {
    const cleanedLine = line.replace(/#.*$/, '').trim();

    if (!cleanedLine) {
      continue;
    }

    const terminalMatch = cleanedLine.match(/^Terminal\s+(\$_[A-Za-z0-9_]+)\s*<-\s*(.+?)\s*;\s*$/);

    if (terminalMatch) {
      terminals.push({
        name: terminalMatch[1],
        expression: terminalMatch[2].trim()
      });
    }
  }

  return terminals;
}

function validateLexLineSyntax(lexRaw) {
  const errors = [];
  const lines = lexRaw.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const originalLine = lines[index];
    const cleanedLine = originalLine.replace(/#.*$/, '').trim();

    if (!cleanedLine) {
      continue;
    }

    const isTerminalDeclaration = /^Terminal\s+\$_[A-Za-z0-9_]+\s*<-\s*.+?\s*;\s*$/.test(cleanedLine);

    if (!isTerminalDeclaration) {
      errors.push(`Sintaxis invalida en Lex (linea ${index + 1}): ${cleanedLine}`);
    }
  }

  return errors;
}

function extractNonTerminals(syntaxRaw) {
  const nonTerminals = [];
  const lines = syntaxRaw.split(/\r?\n/);

  for (const line of lines) {
    const cleanedLine = line.replace(/#.*$/, '').trim();

    if (!cleanedLine) {
      continue;
    }

    const nonTerminalMatch = cleanedLine.match(/^No_Terminal\s+(%_[A-Za-z0-9_]+)\s*;\s*$/);

    if (nonTerminalMatch) {
      nonTerminals.push(nonTerminalMatch[1]);
    }
  }

  return nonTerminals;
}

function extractStartSymbol(syntaxRaw) {
  const lines = syntaxRaw.split(/\r?\n/);

  for (const line of lines) {
    const cleanedLine = line.replace(/#.*$/, '').trim();

    if (!cleanedLine) {
      continue;
    }

    const startMatch = cleanedLine.match(/^Initial_Sim\s+(%_[A-Za-z0-9_]+)\s*;\s*$/);

    if (startMatch) {
      return startMatch[1];
    }
  }

  return null;
}

function validateSyntaxLineSyntax(syntaxRaw) {
  const errors = [];
  const lines = syntaxRaw.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const originalLine = lines[index];
    const cleanedLine = originalLine.replace(/#.*$/, '').trim();

    if (!cleanedLine) {
      continue;
    }

    const isNonTerminalDeclaration = /^No_Terminal\s+%_[A-Za-z0-9_]+\s*;\s*$/.test(cleanedLine);
    const isInitialSymbolDeclaration = /^Initial_Sim\s+%_[A-Za-z0-9_]+\s*;\s*$/.test(cleanedLine);
    const isProduction = /^%_[A-Za-z0-9_]+\s*<=\s*.+?\s*;\s*$/.test(cleanedLine);

    if (!isNonTerminalDeclaration && !isInitialSymbolDeclaration && !isProduction) {
      errors.push(`Sintaxis invalida en Syntax (linea ${index + 1}): ${cleanedLine}`);
    }
  }

  return errors;
}

function extractProductions(syntaxRaw) {
  const productions = {};
  const lines = syntaxRaw.split(/\r?\n/);

  for (const line of lines) {
    const cleanedLine = line.replace(/#.*$/, '').trim();

    if (!cleanedLine) {
      continue;
    }

    const productionMatch = cleanedLine.match(/^(%_[A-Za-z0-9_]+)\s*<=\s*(.+?)\s*;\s*$/);

    if (!productionMatch) {
      continue;
    }

    const leftSide = productionMatch[1];
    const rightSide = productionMatch[2];
    const alternatives = rightSide.split('|').map((alternative) => {
      const trimmedAlternative = alternative.trim();

      if (!trimmedAlternative) {
        return [];
      }

      return trimmedAlternative.split(/\s+/).filter(Boolean);
    });

    if (!productions[leftSide]) {
      productions[leftSide] = [];
    }

    productions[leftSide].push(...alternatives);
  }

  return productions;
}

function validateTerminalUsage(terminals, productions) {
  const errors = [];
  const declaredTerminalNames = new Set(terminals.map((t) => t.name));

  for (const nonTerminal in productions) {
    const alternatives = productions[nonTerminal];

    for (const alternative of alternatives) {
      for (const symbol of alternative) {
        if (symbol.startsWith('$_') && !declaredTerminalNames.has(symbol)) {
          errors.push(`Terminal ${symbol} usado en producción de ${nonTerminal} pero no fue declarado en el bloque Lex.`);
        }
      }
    }
  }

  return errors;
}

function validateNonTerminalUsage(nonTerminals, productions) {
  const errors = [];
  const declaredNonTerminalNames = new Set(nonTerminals);

  for (const nonTerminal in productions) {
    if (!declaredNonTerminalNames.has(nonTerminal)) {
      errors.push(`No terminal ${nonTerminal} tiene producciones pero no fue declarado con No_Terminal.`);
    }

    const alternatives = productions[nonTerminal];

    for (const alternative of alternatives) {
      for (const symbol of alternative) {
        if (symbol.startsWith('%_') && !declaredNonTerminalNames.has(symbol)) {
          errors.push(`No terminal ${symbol} usado en producción de ${nonTerminal} pero no fue declarado con No_Terminal.`);
        }
      }
    }
  }

  return errors;
}

function validateInitialSymbol(syntaxRaw, nonTerminals, startSymbol) {
  const errors = [];
  const lines = syntaxRaw.split(/\r?\n/);
  let initialSimCount = 0;

  for (const line of lines) {
    const cleanedLine = line.replace(/#.*$/, '').trim();

    if (!cleanedLine) {
      continue;
    }

    if (/^Initial_Sim\s+%_[A-Za-z0-9_]+\s*;\s*$/.test(cleanedLine)) {
      initialSimCount += 1;
    }
  }

  if (!startSymbol) {
    errors.push('Falta la declaración obligatoria de Initial_Sim.');
    return errors;
  }

  if (initialSimCount > 1) {
    errors.push('Solo se permite una declaración de Initial_Sim.');
  }

  if (!nonTerminals.includes(startSymbol)) {
    errors.push(`El símbolo inicial ${startSymbol} no fue declarado con No_Terminal.`);
  }

  return errors;
}

function parseWisonWithJison(source) {
  let parsed;

  try {
    parsed = blockParser.parse(source);
  } catch (error) {
    throw new Error(`Estructura Wison invalida: ${error.message}`);
  }

  if (!parsed || typeof parsed.lexRaw !== 'string' || typeof parsed.syntaxRaw !== 'string') {
    throw new Error('No se pudieron detectar los bloques Lex y Syntax.');
  }

  const terminals = extractTerminals(parsed.lexRaw);
  const nonTerminals = extractNonTerminals(parsed.syntaxRaw);
  const startSymbol = extractStartSymbol(parsed.syntaxRaw);
  const productionsObj = extractProductions(parsed.syntaxRaw);

  const errors = [
    ...validateLexLineSyntax(parsed.lexRaw),
    ...validateSyntaxLineSyntax(parsed.syntaxRaw),
    ...validateTerminalUsage(terminals, productionsObj),
    ...validateNonTerminalUsage(nonTerminals, productionsObj),
    ...validateInitialSymbol(parsed.syntaxRaw, nonTerminals, startSymbol)
  ];
  const uniqueErrors = [...new Set(errors)];

  return {
    ok: uniqueErrors.length === 0,
    terminals,
    nonTerminals,
    productions: productionsObj,
    start: startSymbol,
    errors: uniqueErrors,
    raw: {
      lex: parsed.lexRaw.trim(),
      syntax: parsed.syntaxRaw.trim()
    }
  };
}

module.exports = { parseWisonWithJison };
