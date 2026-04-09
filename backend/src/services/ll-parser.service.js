function isTerminal(symbol) {
  return typeof symbol === 'string' && symbol.startsWith('$_');
}

function isNonTerminal(symbol) {
  return typeof symbol === 'string' && symbol.startsWith('%_');
}

const EPSILON = 'ε';

function buildFirstSets(grammar) {
  const first = new Map();

  // El runtime reconstruye FIRST desde la gramática ya validada.
  // Cada no terminal arranca con un conjunto vacío.
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
        if (!Array.isArray(alternative)) {
          continue;
        }

        if (alternative.length === 0) {
          // La alternativa vacía representa epsilon y se registra como tal.
          if (!firstSet.has(EPSILON)) {
            firstSet.add(EPSILON);
            changed = true;
          }
          continue;
        }

        // Igual que en validación, la secuencia solo produce epsilon si todos
        // sus símbolos lo permiten.
        let derivesEpsilon = true;

        for (const symbol of alternative) {
          if (isTerminal(symbol)) {
            // El primer terminal no anulable fija el inicio de la alternativa.
            if (!firstSet.has(symbol)) {
              firstSet.add(symbol);
              changed = true;
            }
            derivesEpsilon = false;
            break;
          }

          if (isNonTerminal(symbol)) {
            const childFirst = first.get(symbol) || new Set();
            let childHasEpsilon = false;

            // Se propagan todos los terminales de FIRST del símbolo hijo.
            // Si el hijo puede desaparecer, el análisis continúa con el siguiente.
            for (const token of childFirst) {
              if (token === EPSILON) {
                childHasEpsilon = true;
                continue;
              }

              if (!firstSet.has(token)) {
                firstSet.add(token);
                changed = true;
              }
            }

            if (!childHasEpsilon) {
              derivesEpsilon = false;
              break;
            }

            continue;
          }

          derivesEpsilon = false;
          break;
        }

        if (derivesEpsilon && !firstSet.has(EPSILON)) {
          firstSet.add(EPSILON);
          changed = true;
        }
      }
    }
  }

  return first;
}

function firstOfSequence(sequence, firstSets) {
  const result = new Set();

  if (!Array.isArray(sequence) || sequence.length === 0) {
    // Una secuencia vacía equivale a epsilon.
    result.add(EPSILON);
    return result;
  }

  let derivesEpsilon = true;

  for (const symbol of sequence) {
    if (isTerminal(symbol)) {
      // Si encontramos un terminal, ya no necesitamos mirar el resto.
      result.add(symbol);
      derivesEpsilon = false;
      break;
    }

    if (isNonTerminal(symbol)) {
      const symbolFirst = firstSets.get(symbol) || new Set();
      let symbolHasEpsilon = false;

      // Se agregan los terminales que pueden iniciar este símbolo.
      for (const token of symbolFirst) {
        if (token === EPSILON) {
          symbolHasEpsilon = true;
          continue;
        }

        result.add(token);
      }

      if (!symbolHasEpsilon) {
        derivesEpsilon = false;
        break;
      }

      continue;
    }

    derivesEpsilon = false;
    break;
  }

  if (derivesEpsilon) {
    result.add(EPSILON);
  }

  return result;
}

function buildFollowSets(grammar, firstSets) {
  const follow = new Map();

  // FOLLOW se calcula sobre los no terminales que ya conoce la gramática.
  for (const nonTerminal of grammar.nonTerminals) {
    follow.set(nonTerminal, new Set());
  }

  // El símbolo inicial siempre puede ir seguido por fin de entrada.
  if (grammar.start && follow.has(grammar.start)) {
    follow.get(grammar.start).add('$');
  }

  let changed = true;

  while (changed) {
    changed = false;

    for (const [leftSide, alternatives] of Object.entries(grammar.productions)) {
      const leftFollow = follow.get(leftSide) || new Set();

      for (const alternative of alternatives) {
        if (!Array.isArray(alternative) || alternative.length === 0) {
          continue;
        }

        // Cada aparición de un no terminal debe analizarse con su contexto local.
        for (let index = 0; index < alternative.length; index += 1) {
          const symbol = alternative[index];

          if (!isNonTerminal(symbol)) {
            continue;
          }

          const symbolFollow = follow.get(symbol) || new Set();
          const beta = alternative.slice(index + 1);
          const firstBeta = firstOfSequence(beta, firstSets);

          // Todo terminal que pueda comenzar beta puede seguir al símbolo actual.
          for (const token of firstBeta) {
            if (token === EPSILON) {
              continue;
            }

            if (!symbolFollow.has(token)) {
              symbolFollow.add(token);
              changed = true;
            }
          }

          if (beta.length === 0 || firstBeta.has(EPSILON)) {
            // Si beta desaparece, el FOLLOW del lado izquierdo también aplica.
            for (const token of leftFollow) {
              if (!symbolFollow.has(token)) {
                symbolFollow.add(token);
                changed = true;
              }
            }
          }
        }
      }
    }
  }

  return follow;
}

function selectAlternative(nonTerminal, lookaheadType, grammar, firstSets, followSets) {
  const alternatives = grammar.productions[nonTerminal] || [];
  const matches = [];
  const follow = followSets.get(nonTerminal) || new Set();

  for (const alternative of alternatives) {
    const altFirst = firstOfSequence(alternative, firstSets);

    // Caso normal: el lookahead pertenece al FIRST de la alternativa.
    if (altFirst.has(lookaheadType)) {
      matches.push(alternative);
      continue;
    }

    // Caso epsilon: se permite la alternativa vacía si el lookahead
    // pertenece al FOLLOW del no terminal actual.
    if (altFirst.has(EPSILON) && follow.has(lookaheadType)) {
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
  // El parser reconstruye FIRST/FOLLOW en runtime para tomar decisiones
  // predictivas directamente sobre la gramática ya validada.
  const firstSets = buildFirstSets(grammar);
  const followSets = buildFollowSets(grammar, firstSets);
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
      // El no terminal del tope se expande con la producción que corresponda
      // al lookahead actual.
      const selection = selectAlternative(top, lookahead, grammar, firstSets, followSets);

      if (selection.error) {
        errors.push(selection.error);
        break;
      }

      const alternative = selection.alternative;

      if (node) {
        // Si la alternativa es epsilon, se materializa como un nodo hoja
        // para que el árbol muestre explícitamente la derivación vacía.
        node.children = alternative.length === 0
          ? [{ name: EPSILON, children: [] }]
          : alternative.map((symbol) => ({
            name: symbol,
            children: []
          }));
      }

      if (alternative.length === 0) {
        // Epsilon no consume entrada ni empuja símbolos a la pila.
        continue;
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
