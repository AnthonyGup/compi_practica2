function isTerminal(symbol) {
  return typeof symbol === 'string' && symbol.startsWith('$_');
}

function isNonTerminal(symbol) {
  return typeof symbol === 'string' && symbol.startsWith('%_');
}

function buildFirstSets(grammar) {
  const first = new Map();

  for (const nonTerminal of grammar.nonTerminals) {
    first.set(nonTerminal, new Set());
  }

  let changed = true;

  while (changed) {
    changed = false;

    for (const nonTerminal of grammar.nonTerminals) {
      const alternatives = grammar.productions[nonTerminal] || [];
      const firstSet = first.get(nonTerminal);

      for (const alternative of alternatives) {
        if (!alternative || alternative.length === 0) {
          continue;
        }

        const firstSymbol = alternative[0];

        if (isTerminal(firstSymbol)) {
          if (!firstSet.has(firstSymbol)) {
            firstSet.add(firstSymbol);
            changed = true;
          }
          continue;
        }

        if (isNonTerminal(firstSymbol)) {
          const childFirst = first.get(firstSymbol) || new Set();
          for (const token of childFirst) {
            if (!firstSet.has(token)) {
              firstSet.add(token);
              changed = true;
            }
          }
        }
      }
    }
  }

  return first;
}

function firstOfAlternative(alternative, firstSets) {
  const result = new Set();

  if (!alternative || alternative.length === 0) {
    return result;
  }

  const firstSymbol = alternative[0];

  if (isTerminal(firstSymbol)) {
    result.add(firstSymbol);
    return result;
  }

  if (isNonTerminal(firstSymbol)) {
    const firstSet = firstSets.get(firstSymbol) || new Set();
    for (const token of firstSet) {
      result.add(token);
    }
  }

  return result;
}

function selectAlternative(nonTerminal, lookaheadType, grammar, firstSets) {
  const alternatives = grammar.productions[nonTerminal] || [];
  const matches = [];

  for (const alternative of alternatives) {
    const altFirst = firstOfAlternative(alternative, firstSets);
    if (altFirst.has(lookaheadType)) {
      matches.push(alternative);
    }
  }

  if (matches.length === 1) {
    return { alternative: matches[0], error: null };
  }

  if (matches.length > 1) {
    return {
      alternative: null,
      error: `Conflicto LL(1) en ${nonTerminal}: varias alternativas coinciden con ${lookaheadType}.`
    };
  }

  return {
    alternative: null,
    error: `No hay producción válida para ${nonTerminal} con lookahead ${lookaheadType}.`
  };
}

function parseTokensWithLL(tokens, grammar) {
  const errors = [];
  const steps = [];
  const firstSets = buildFirstSets(grammar);
  const input = [...tokens, { type: '$', lexeme: '$', line: null, column: null }];
  const derivationTree = {
    name: grammar.start,
    children: []
  };
  const stack = [
    { symbol: '$', node: null },
    { symbol: grammar.start, node: derivationTree }
  ];
  let index = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    const top = current.symbol;
    const node = current.node;
    const lookaheadToken = input[index];
    const lookahead = lookaheadToken.type;

    steps.push({
      stackTop: top,
      lookahead,
      remainingInput: input.slice(index)
        .map((token) => token.type)
    });

    if (top === '$') {
      if (lookahead === '$') {
        return {
          ok: errors.length === 0,
          accepted: errors.length === 0,
          errors,
          steps,
          derivationTree
        };
      }

      errors.push(`Se esperaba fin de entrada pero se encontró ${lookahead}.`);
      break;
    }

    if (isTerminal(top)) {
      if (top === lookahead) {
        if (node) {
          node.lexeme = lookaheadToken.lexeme;
        }
        index += 1;
        continue;
      }

      errors.push(`Se esperaba ${top} pero se encontró ${lookahead}.`);
      break;
    }

    if (isNonTerminal(top)) {
      const selection = selectAlternative(top, lookahead, grammar, firstSets);

      if (selection.error) {
        errors.push(selection.error);
        break;
      }

      const alternative = selection.alternative;

      if (node) {
        node.children = alternative.map((symbol) => ({
          name: symbol,
          children: []
        }));
      }

      for (let i = alternative.length - 1; i >= 0; i -= 1) {
        stack.push({
          symbol: alternative[i],
          node: node ? node.children[i] : null
        });
      }

      continue;
    }

    errors.push(`Símbolo inesperado en la pila: ${top}.`);
    break;
  }

  return {
    ok: false,
    accepted: false,
    errors,
    steps,
    derivationTree
  };
}

module.exports = {
  parseTokensWithLL
};
