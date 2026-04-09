const fs = require('fs');
const path = require('path');
const { Parser } = require('jison');
const { validateWisonGrammar } = require('./wison.validators');
const { normalizeErrorMessage } = require('../utils/error-messages');

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

function extractProductions(syntaxRaw) {
  const productions = {};
  const lines = syntaxRaw.split(/\r?\n/);

  for (const line of lines) {
    const cleanedLine = line.replace(/#.*$/, '').trim();

    if (!cleanedLine) {
      continue;
    }

    const productionMatch = cleanedLine.match(/^(%_[A-Za-z0-9_]+)\s*<=\s*(.*?)\s*;\s*$/);

    if (!productionMatch) {
      continue;
    }

    const leftSide = productionMatch[1];
    const rightSide = productionMatch[2];
    const alternatives = rightSide.split('|').map((alternative) => {
      const trimmedAlternative = alternative.trim();

      if (!trimmedAlternative || /^(?:ε|epsilon|EPSILON)$/.test(trimmedAlternative)) {
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


function parseWisonWithJison(source) {
  let parsed;

  try {
    parsed = blockParser.parse(source);
  } catch (error) {
    throw new Error(normalizeErrorMessage(error, 'Estructura Wison invalida.'));
  }

  if (!parsed || typeof parsed.lexRaw !== 'string' || typeof parsed.syntaxRaw !== 'string') {
    throw new Error('No se pudieron detectar los bloques Lex y Syntax.');
  }

  const terminals = extractTerminals(parsed.lexRaw);
  const nonTerminals = extractNonTerminals(parsed.syntaxRaw);
  const startSymbol = extractStartSymbol(parsed.syntaxRaw);
  const productionsObj = extractProductions(parsed.syntaxRaw);

  const uniqueErrors = validateWisonGrammar({
    lexRaw: parsed.lexRaw,
    syntaxRaw: parsed.syntaxRaw,
    terminals,
    nonTerminals,
    startSymbol,
    productions: productionsObj
  });

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
