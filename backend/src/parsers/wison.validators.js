//////////////////////////////////// HELPERS BASE ////////////////////////////////////

function isTerminalSymbol(symbol) {
  return symbol.startsWith('$_');
}

function isNonTerminalSymbol(symbol) {
  return symbol.startsWith('%_');
}

//////////////////////////////////// VALIDACIONES DE SINTAXIS ////////////////////////////////////

function validateLexLineSyntax(lexRaw) {
  const errors = [];
  const lines = lexRaw.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const cleanedLine = lines[index].replace(/#.*$/, '').trim();

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

function validateSyntaxLineSyntax(syntaxRaw) {
  const errors = [];
  const lines = syntaxRaw.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const cleanedLine = lines[index].replace(/#.*$/, '').trim();

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

//////////////////////////////////// VALIDACIONES DE DECLARACION ////////////////////////////////////

function validateTerminalUsage(terminals, productions) {
  const errors = [];
  const declaredTerminalNames = new Set(terminals.map((terminal) => terminal.name));

  for (const nonTerminal in productions) {
    const alternatives = productions[nonTerminal];

    for (const alternative of alternatives) {
      for (const symbol of alternative) {
        if (isTerminalSymbol(symbol) && !declaredTerminalNames.has(symbol)) {
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
        if (isNonTerminalSymbol(symbol) && !declaredNonTerminalNames.has(symbol)) {
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

//////////////////////////////////// VALIDACION LL - FIRST/FOLLOW ////////////////////////////////////

function buildFirstSets(nonTerminals, productions) {
  const firstSets = new Map();

  for (const nonTerminal of nonTerminals) {
    firstSets.set(nonTerminal, new Set());
  }

  let changed = true;

  while (changed) {
    changed = false;

    for (const nonTerminal of nonTerminals) {
      const alternatives = productions[nonTerminal] || [];
      const firstSet = firstSets.get(nonTerminal);

      for (const alternative of alternatives) {
        if (alternative.length === 0) {
          if (!firstSet.has('ε')) {
            firstSet.add('ε');
            changed = true;
          }

          continue;
        }

        let derivesEpsilon = true;

        for (const symbol of alternative) {
          if (isTerminalSymbol(symbol)) {
            if (!firstSet.has(symbol)) {
              firstSet.add(symbol);
              changed = true;
            }

            derivesEpsilon = false;
            break;
          }

          if (isNonTerminalSymbol(symbol)) {
            const symbolFirstSet = firstSets.get(symbol) || new Set();
            let symbolHasEpsilon = false;

            for (const candidate of symbolFirstSet) {
              if (candidate === 'ε') {
                symbolHasEpsilon = true;
                continue;
              }

              if (!firstSet.has(candidate)) {
                firstSet.add(candidate);
                changed = true;
              }
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

        if (derivesEpsilon && !firstSet.has('ε')) {
          firstSet.add('ε');
          changed = true;
        }
      }
    }
  }

  return firstSets;
}

function buildFollowSets(nonTerminals, productions, startSymbol, firstSets) {
  const followSets = new Map();

  for (const nonTerminal of nonTerminals) {
    followSets.set(nonTerminal, new Set());
  }

  if (startSymbol && followSets.has(startSymbol)) {
    followSets.get(startSymbol).add('$');
  }

  let changed = true;

  while (changed) {
    changed = false;

    for (const [leftSide, alternatives] of Object.entries(productions)) {
      for (const alternative of alternatives) {
        for (let index = 0; index < alternative.length; index += 1) {
          const symbol = alternative[index];

          if (!isNonTerminalSymbol(symbol) || !followSets.has(symbol)) {
            continue;
          }

          const trailingSymbols = alternative.slice(index + 1);
          const followSet = followSets.get(symbol);
          let trailingCanDeriveEpsilon = true;

          if (trailingSymbols.length === 0) {
            for (const candidate of followSets.get(leftSide) || []) {
              if (!followSet.has(candidate)) {
                followSet.add(candidate);
                changed = true;
              }
            }

            continue;
          }

          for (const trailingSymbol of trailingSymbols) {
            if (isTerminalSymbol(trailingSymbol)) {
              if (!followSet.has(trailingSymbol)) {
                followSet.add(trailingSymbol);
                changed = true;
              }

              trailingCanDeriveEpsilon = false;
              break;
            }

            if (isNonTerminalSymbol(trailingSymbol)) {
              const trailingFirstSet = firstSets.get(trailingSymbol) || new Set();
              let trailingHasEpsilon = false;

              for (const candidate of trailingFirstSet) {
                if (candidate === 'ε') {
                  trailingHasEpsilon = true;
                  continue;
                }

                if (!followSet.has(candidate)) {
                  followSet.add(candidate);
                  changed = true;
                }
              }

              if (!trailingHasEpsilon) {
                trailingCanDeriveEpsilon = false;
                break;
              }

              continue;
            }

            trailingCanDeriveEpsilon = false;
            break;
          }

          if (trailingCanDeriveEpsilon) {
            for (const candidate of followSets.get(leftSide) || []) {
              if (!followSet.has(candidate)) {
                followSet.add(candidate);
                changed = true;
              }
            }
          }
        }
      }
    }
  }

  return followSets;
}

//////////////////////////////////// VALIDACION LL - RECURSIVIDAD IZQUIERDA ////////////////////////////////////

function detectLeftRecursion(nonTerminals, productions) {
  const errors = [];
  const recursiveNonTerminals = new Set();
  const adjacency = new Map();

  for (const nonTerminal of nonTerminals) {
    adjacency.set(nonTerminal, new Set());
  }

  for (const [leftSide, alternatives] of Object.entries(productions)) {
    for (const alternative of alternatives) {
      const firstSymbol = alternative[0];

      if (isNonTerminalSymbol(firstSymbol) && adjacency.has(leftSide)) {
        adjacency.get(leftSide).add(firstSymbol);
      }
    }
  }

  function hasPath(startSymbol, targetSymbol, visited = new Set()) {
    if (visited.has(startSymbol)) {
      return false;
    }

    visited.add(startSymbol);

    const nextSymbols = adjacency.get(startSymbol) || new Set();

    for (const nextSymbol of nextSymbols) {
      if (nextSymbol === targetSymbol) {
        return true;
      }

      if (hasPath(nextSymbol, targetSymbol, new Set(visited))) {
        return true;
      }
    }

    return false;
  }

  for (const nonTerminal of nonTerminals) {
    if (hasPath(nonTerminal, nonTerminal)) {
      errors.push(`La gramática tiene recursividad por la izquierda en ${nonTerminal}.`);
      recursiveNonTerminals.add(nonTerminal);
    }
  }

  return { errors, recursiveNonTerminals };
}

/////////////////////////////////// VALIDACION LL - CONFLICTOS PREDICTIVOS ////////////////////////////////////

function validatePredictiveConflicts(nonTerminals, productions, startSymbol, recursiveNonTerminals) {
  const errors = [];
  const firstSets = buildFirstSets(nonTerminals, productions);
  const followSets = buildFollowSets(nonTerminals, productions, startSymbol, firstSets);

  for (const [nonTerminal, alternatives] of Object.entries(productions)) {
    if (recursiveNonTerminals.has(nonTerminal)) {
      continue;
    }

    const alternativeFirstSets = alternatives.map((alternative) => {
      const alternativeFirstSet = new Set();

      if (alternative.length === 0) {
        alternativeFirstSet.add('ε');
        return alternativeFirstSet;
      }

      let derivesEpsilon = true;

      for (const symbol of alternative) {
        if (isTerminalSymbol(symbol)) {
          alternativeFirstSet.add(symbol);
          derivesEpsilon = false;
          break;
        }

        if (isNonTerminalSymbol(symbol)) {
          const symbolFirstSet = firstSets.get(symbol) || new Set();
          let symbolHasEpsilon = false;

          for (const candidate of symbolFirstSet) {
            if (candidate === 'ε') {
              symbolHasEpsilon = true;
              continue;
            }

            alternativeFirstSet.add(candidate);
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
        alternativeFirstSet.add('ε');
      }

      return alternativeFirstSet;
    });

    for (let i = 0; i < alternativeFirstSets.length; i += 1) {
      for (let j = i + 1; j < alternativeFirstSets.length; j += 1) {
        const intersection = [...alternativeFirstSets[i]].filter((symbol) => alternativeFirstSets[j].has(symbol) && symbol !== 'ε');

        if (intersection.length > 0) {
          errors.push(`La gramática no está factorizada en ${nonTerminal}: las alternativas comparten FIRST(${intersection.join(', ')}).`);
        }
      }
    }

    for (const alternativeFirstSet of alternativeFirstSets) {
      if (!alternativeFirstSet.has('ε')) {
        continue;
      }

      const followSet = followSets.get(nonTerminal) || new Set();

      for (const symbol of alternativeFirstSet) {
        if (symbol === 'ε') {
          continue;
        }

        if (followSet.has(symbol)) {
          errors.push(`Conflicto LL(1) en ${nonTerminal}: FIRST/FOLLOW se intersectan con ${symbol}.`);
        }
      }
    }
  }

  return errors;
}

//////////////////////////////////// ORQUESTADOR DE VALIDACIONES ////////////////////////////////////

function validateWisonGrammar({ lexRaw, syntaxRaw, terminals, nonTerminals, startSymbol, productions }) {
  const errors = [
    ...validateLexLineSyntax(lexRaw),
    ...validateSyntaxLineSyntax(syntaxRaw),
    ...validateTerminalUsage(terminals, productions),
    ...validateNonTerminalUsage(nonTerminals, productions),
    ...validateInitialSymbol(syntaxRaw, nonTerminals, startSymbol)
  ];

  const leftRecursionResult = detectLeftRecursion(nonTerminals, productions);
  errors.push(...leftRecursionResult.errors);
  errors.push(...validatePredictiveConflicts(nonTerminals, productions, startSymbol, leftRecursionResult.recursiveNonTerminals));

  return [...new Set(errors)];
}

module.exports = {
  validateWisonGrammar
};