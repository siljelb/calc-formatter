/**
 * Validation logic for DIPS Calc expressions.
 */

const { countFunctionArguments, extractFunctionArguments } = require('./function-parsing');
const { isTypeCompatible, inferExpressionType, formatTypeName } = require('./type-system');

/**
 * Validate ISO8601 date, datetime, time, or duration string.
 * @param {string} str - The string to validate (with quotes)
 * @returns {{valid: boolean, type: string|null, message: string|null}}
 */
function validateISO8601String(str) {
  const trimmed = str.trim();
  if (!trimmed.startsWith('"') && !trimmed.startsWith("'")) {
    return { valid: true, type: null, message: null };
  }
  
  const content = trimmed.slice(1, -1);
  
  // ISO8601 datetime: YYYY-MM-DDTHH:MM:SS[.mmm][±HH:MM|Z]
  const datetimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/;
  const datetimeMatch = content.match(datetimePattern);
  if (datetimeMatch) {
    const [, year, month, day, hour, minute, second] = datetimeMatch;
    const y = parseInt(year), m = parseInt(month), d = parseInt(day);
    const h = parseInt(hour), min = parseInt(minute), s = parseInt(second);
    
    if (m < 1 || m > 12) {
      return { valid: false, type: 'iso8601_datetime', message: `Invalid month: ${m} (must be 01-12)` };
    }
    if (d < 1 || d > 31) {
      return { valid: false, type: 'iso8601_datetime', message: `Invalid day: ${d} (must be 01-31)` };
    }
    if (h > 23) {
      return { valid: false, type: 'iso8601_datetime', message: `Invalid hour: ${h} (must be 00-23)` };
    }
    if (min > 59) {
      return { valid: false, type: 'iso8601_datetime', message: `Invalid minute: ${min} (must be 00-59)` };
    }
    if (s > 59) {
      return { valid: false, type: 'iso8601_datetime', message: `Invalid second: ${s} (must be 00-59)` };
    }
    return { valid: true, type: 'iso8601_datetime', message: null };
  }
  
  // ISO8601 date: YYYY-MM-DD
  const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const dateMatch = content.match(datePattern);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const y = parseInt(year), m = parseInt(month), d = parseInt(day);
    
    if (m < 1 || m > 12) {
      return { valid: false, type: 'iso8601_date', message: `Invalid month: ${m} (must be 01-12)` };
    }
    if (d < 1 || d > 31) {
      return { valid: false, type: 'iso8601_date', message: `Invalid day: ${d} (must be 01-31)` };
    }
    return { valid: true, type: 'iso8601_date', message: null };
  }
  
  // ISO8601 time: HH:MM:SS[.mmm][±HH:MM|Z]
  const timePattern = /^(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/;
  const timeMatch = content.match(timePattern);
  if (timeMatch) {
    const [, hour, minute, second] = timeMatch;
    const h = parseInt(hour), min = parseInt(minute), s = parseInt(second);
    
    if (h > 23) {
      return { valid: false, type: 'iso8601_time', message: `Invalid hour: ${h} (must be 00-23)` };
    }
    if (min > 59) {
      return { valid: false, type: 'iso8601_time', message: `Invalid minute: ${min} (must be 00-59)` };
    }
    if (s > 59) {
      return { valid: false, type: 'iso8601_time', message: `Invalid second: ${s} (must be 00-59)` };
    }
    return { valid: true, type: 'iso8601_time', message: null };
  }
  
  // ISO8601 duration: P[nY][nM][nD][T[nH][nM][nS]]
  const durationPattern = /^P(?:(\d+(?:\.\d+)?Y)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?W)?(\d+(?:\.\d+)?D)?)?(?:T(?:(\d+(?:\.\d+)?H)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?S)?)?)?$/;
  const durationMatch = content.match(durationPattern);
  if (durationMatch && content.startsWith('P')) {
    // Check that at least one component exists
    const hasComponents = durationMatch.slice(1).some(component => component !== undefined);
    if (!hasComponents) {
      return { valid: false, type: 'iso8601_duration', message: 'Duration must have at least one time component (e.g., P1D, PT1H)' };
    }
    return { valid: true, type: 'iso8601_duration', message: null };
  }
  
  // Check if it looks like an attempted ISO8601 format
  // Date/datetime patterns
  if (/\d{4}-\d{2}/.test(content)) {
    return { valid: false, type: 'unknown', message: 'Invalid ISO 8601 date/datetime format' };
  }
  // Time patterns
  if (/\d{2}:\d{2}/.test(content)) {
    return { valid: false, type: 'unknown', message: 'Invalid ISO 8601 time format' };
  }
  // Duration patterns - check for P followed by duration components
  if (content.startsWith('P') || /P\d+[YMWDTHS]/.test(content)) {
    return { valid: false, type: 'unknown', message: 'Invalid ISO 8601 duration format' };
  }
  
  return { valid: true, type: null, message: null };
}

/**
 * Parse function calls from document text and validate arguments.
 * @param {object} vscode - VS Code API
 * @param {object} document - TextDocument
 * @param {Map<string, VariableInfo>} variables - Variables from form_description.json
 * @param {Map<string, any>} functionLookup - Function metadata lookup
 * @returns {Array} - Array of diagnostics
 */
function validateFunctionCalls(vscode, document, variables, functionLookup) {
  const text = document.getText();
  const diagnostics = [];
  
  // Match function calls: FUNCTIONNAME(...)
  const functionCallRegex = /\b([A-Z][A-Z0-9_]*)\s*\(/gi;
  
  let match;
  while ((match = functionCallRegex.exec(text)) !== null) {
    const funcName = match[1].toUpperCase();
    const funcInfo = functionLookup.get(funcName);
    
    // Find the matching closing parenthesis
    const openParenIndex = match.index + match[0].length - 1;
    let depth = 1;
    let closeParenIndex = -1;
    let inString = false;
    let stringChar = '';
    
    for (let i = openParenIndex + 1; i < text.length && depth > 0; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';
      
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        continue;
      }
      
      if (inString) continue;
      
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth === 0) {
          closeParenIndex = i;
        }
      }
    }
    
    if (!funcInfo) {
      // Unknown function - add warning
      if (closeParenIndex !== -1) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(closeParenIndex + 1);
        const range = new vscode.Range(startPos, endPos);
        
        const diagnostic = new vscode.Diagnostic(
          range,
          `Unknown function: ${match[1]}`,
          vscode.DiagnosticSeverity.Warning
        );
        diagnostic.source = 'dips-calc';
        diagnostic.code = 'unknown-function';
        diagnostics.push(diagnostic);
      }
      continue;
    }
    
    if (closeParenIndex === -1) {
      continue; // Unclosed parenthesis
    }
    
    // Extract and validate arguments
    const argsString = text.substring(openParenIndex + 1, closeParenIndex);
    const argCount = countFunctionArguments(argsString);
    
    const minArgs = funcInfo.minArgs !== undefined ? funcInfo.minArgs : 0;
    const maxArgs = funcInfo.maxArgs;
    const isVariadic = maxArgs === '*';
    
    let message = null;
    
    if (argCount < minArgs) {
      if (!isVariadic && minArgs === maxArgs) {
        message = `${funcName} expects exactly ${minArgs} argument${minArgs !== 1 ? 's' : ''}, but got ${argCount}`;
      } else {
        message = `${funcName} expects at least ${minArgs} argument${minArgs !== 1 ? 's' : ''}, but got ${argCount}`;
      }
    } else if (!isVariadic && argCount > maxArgs) {
      if (minArgs === maxArgs) {
        message = `${funcName} expects exactly ${maxArgs} argument${maxArgs !== 1 ? 's' : ''}, but got ${argCount}`;
      } else {
        message = `${funcName} expects at most ${maxArgs} argument${maxArgs !== 1 ? 's' : ''}, but got ${argCount}`;
      }
    }
    
    if (message) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(closeParenIndex + 1);
      const range = new vscode.Range(startPos, endPos);
      
      const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
      diagnostic.source = 'dips-calc';
      diagnostic.code = 'invalid-argument-count';
      diagnostics.push(diagnostic);
    }
    
    // Special validation: ISNULL with GENERIC_FIELD
    if (funcName === 'ISNULL' && !message) {
      const args = extractFunctionArguments(argsString);
      if (args.length > 0) {
        const firstArg = args[0].text.trim();
        if (firstArg.startsWith('$')) {
          const varName = firstArg.replace(/^[$]/, '').split('/')[0];
          const varInfo = variables?.get(varName);
          if (varInfo?.rmType === 'GENERIC_FIELD') {
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(closeParenIndex + 1);
            const range = new vscode.Range(startPos, endPos);
            
            const diagnostic = new vscode.Diagnostic(
              range,
              `ISNULL() does not work with GENERIC_FIELD variables. Use ISBLANK(${firstArg}) instead.`,
              vscode.DiagnosticSeverity.Error
            );
            diagnostic.source = 'dips-calc';
            diagnostic.code = 'isnull-generic-field';
            diagnostics.push(diagnostic);
          }
        }
      }
    }
    
    // Type validation
    if (!message && funcInfo.params && funcInfo.params.length > 0) {
      const args = extractFunctionArguments(argsString);
      
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        let expectedParam;
        if (i < funcInfo.params.length) {
          expectedParam = funcInfo.params[i];
        } else if (isVariadic && funcInfo.params.length > 0) {
          const lastParam = funcInfo.params[funcInfo.params.length - 1];
          expectedParam = lastParam.optional ? lastParam : funcInfo.params.find(p => p.optional) || lastParam;
        } else {
          continue;
        }
        
        if (!expectedParam || expectedParam.type === 'any') {
          continue;
        }
        
        const inferredType = inferExpressionType(arg.text, variables, functionLookup);
        
        const argStartInDoc = openParenIndex + 1 + argsString.indexOf(arg.text);
        const argEndInDoc = argStartInDoc + arg.text.length;
        const argStartPos = document.positionAt(argStartInDoc);
        const argEndPos = document.positionAt(argEndInDoc);
        const argRange = new vscode.Range(argStartPos, argEndPos);
        
        // ISO8601 validation for string literals
        const iso8601Types = ['iso8601_datetime', 'iso8601_date', 'iso8601_time', 'iso8601_duration'];
        if (iso8601Types.includes(expectedParam.type)) {
          const trimmedArg = arg.text.trim();
          if ((trimmedArg.startsWith('"') && trimmedArg.endsWith('"')) || 
              (trimmedArg.startsWith("'") && trimmedArg.endsWith("'"))) {
            const validation = validateISO8601String(trimmedArg);
            if (!validation.valid) {
              const isoDiagnostic = new vscode.Diagnostic(
                argRange,
                validation.message,
                vscode.DiagnosticSeverity.Error
              );
              isoDiagnostic.source = 'dips-calc';
              isoDiagnostic.code = 'invalid-iso8601';
              diagnostics.push(isoDiagnostic);
              continue;
            }
          }
        }
        
        // Type checking
        if (inferredType.type && inferredType.confidence === 'high') {
          if (!isTypeCompatible(inferredType.type, expectedParam.type)) {
            const typeMessage = `Argument ${i + 1} (${expectedParam.name}): expected ${formatTypeName(expectedParam.type)}, but got ${formatTypeName(inferredType.type)}`;
            
            const typeDiagnostic = new vscode.Diagnostic(
              argRange,
              typeMessage,
              vscode.DiagnosticSeverity.Warning
            );
            typeDiagnostic.source = 'dips-calc';
            typeDiagnostic.code = 'type-mismatch';
            diagnostics.push(typeDiagnostic);
          }
        }
      }
    }
  }
  
  return diagnostics;
}

/**
 * Detect potential missing commas between function arguments.
 * @param {object} vscode - VS Code API
 * @param {object} document - TextDocument
 * @returns {Array<{range: Range, insertPosition: Position}>}
 */
function detectMissingCommas(vscode, document) {
  const text = document.getText();
  const missingCommas = [];
  
  const functionCallRegex = /\b([A-Z][A-Z0-9_]*)\s*\(/gi;
  
  let match;
  while ((match = functionCallRegex.exec(text)) !== null) {
    const openParenIndex = match.index + match[0].length - 1;
    let depth = 1;
    let closeParenIndex = -1;
    let inString = false;
    let stringChar = '';
    
    for (let i = openParenIndex + 1; i < text.length && depth > 0; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';
      
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        continue;
      }
      
      if (inString) continue;
      
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth === 0) {
          closeParenIndex = i;
        }
      }
    }
    
    if (closeParenIndex === -1) continue;
    
    const argsText = text.substring(openParenIndex + 1, closeParenIndex);
    const argsStartOffset = openParenIndex + 1;
    
    let argDepth = 0;
    let argInString = false;
    let argStringChar = '';
    let lastValueEnd = -1;
    
    for (let i = 0; i < argsText.length; i++) {
      const char = argsText[i];
      const prevChar = i > 0 ? argsText[i - 1] : '';
      
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!argInString) {
          if (lastValueEnd !== -1) {
            const gapText = argsText.substring(lastValueEnd, i);
            if (/^\s+$/.test(gapText)) {
              const insertOffset = argsStartOffset + lastValueEnd;
              const insertPos = document.positionAt(insertOffset);
              let stringEnd = i + 1;
              while (stringEnd < argsText.length && argsText[stringEnd] !== char) {
                stringEnd++;
              }
              stringEnd++;
              const rangeStart = document.positionAt(argsStartOffset + lastValueEnd);
              const rangeEnd = document.positionAt(argsStartOffset + Math.min(stringEnd, argsText.length));
              missingCommas.push({
                range: new vscode.Range(rangeStart, rangeEnd),
                insertPosition: insertPos
              });
            }
          }
          argInString = true;
          argStringChar = char;
        } else if (char === argStringChar) {
          argInString = false;
          lastValueEnd = i + 1;
        }
        continue;
      }
      
      if (argInString) continue;
      
      if (char === '(') {
        argDepth++;
        continue;
      }
      if (char === ')') {
        argDepth--;
        if (argDepth === 0) {
          lastValueEnd = i + 1;
        }
        continue;
      }
      
      if (argDepth > 0) continue;
      
      if (char === ',') {
        lastValueEnd = -1;
        continue;
      }
      
      if ('+-*/^&%=<>?:'.includes(char)) {
        lastValueEnd = -1;
        continue;
      }
      
      if (i + 1 < argsText.length) {
        const twoChar = argsText.substring(i, i + 2);
        if (twoChar === '<>' || twoChar === '>=' || twoChar === '<=') {
          lastValueEnd = -1;
          i++;
          continue;
        }
      }
      
      if (/\s/.test(char)) {
        continue;
      }
      
      if (char === '$' || /[A-Za-z_]/.test(char) || /\d/.test(char)) {
        let tokenEnd = i;
        if (char === '$') {
          tokenEnd++;
          while (tokenEnd < argsText.length && /[A-Za-z0-9_./]/.test(argsText[tokenEnd])) {
            tokenEnd++;
          }
        } else if (/[A-Za-z_]/.test(char)) {
          while (tokenEnd < argsText.length && /[A-Za-z0-9_]/.test(argsText[tokenEnd])) {
            tokenEnd++;
          }
          let checkPos = tokenEnd;
          while (checkPos < argsText.length && /\s/.test(argsText[checkPos])) {
            checkPos++;
          }
          if (argsText[checkPos] === '(') {
            i = tokenEnd - 1;
            continue;
          }
        } else {
          while (tokenEnd < argsText.length && /[\d.]/.test(argsText[tokenEnd])) {
            tokenEnd++;
          }
        }
        
        if (lastValueEnd !== -1) {
          const gapText = argsText.substring(lastValueEnd, i);
          if (/^\s+$/.test(gapText)) {
            const insertOffset = argsStartOffset + lastValueEnd;
            const insertPos = document.positionAt(insertOffset);
            const rangeStart = document.positionAt(argsStartOffset + lastValueEnd);
            const rangeEnd = document.positionAt(argsStartOffset + tokenEnd);
            missingCommas.push({
              range: new vscode.Range(rangeStart, rangeEnd),
              insertPosition: insertPos
            });
          }
        }
        
        lastValueEnd = tokenEnd;
        i = tokenEnd - 1;
      }
    }
  }
  
  return missingCommas;
}

module.exports = {
  validateISO8601String,
  validateFunctionCalls,
  detectMissingCommas
};
