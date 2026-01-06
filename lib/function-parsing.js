/**
 * Utilities for parsing function calls and arguments.
 */

/**
 * Count function arguments, handling nested parentheses and strings correctly.
 * @param {string} argsString - The string inside the function parentheses
 * @returns {number} - Number of arguments (0 for empty, otherwise count commas at depth 0 + 1)
 */
function countFunctionArguments(argsString) {
  const trimmed = argsString.trim();
  if (trimmed === '') {
    return 0;
  }
  
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let argCount = 1;
  
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const prevChar = i > 0 ? trimmed[i - 1] : '';
    
    // Handle string literals
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
    
    // Track nested parentheses
    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
    } else if (char === ',' && depth === 0) {
      argCount++;
    }
  }
  
  return argCount;
}

/**
 * Extract individual arguments from an arguments string.
 * @param {string} argsString - The string inside the function parentheses
 * @returns {Array<{text: string, start: number, end: number}>} - Array of argument info
 */
function extractFunctionArguments(argsString) {
  const trimmed = argsString.trim();
  if (trimmed === '') {
    return [];
  }
  
  const args = [];
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let argStart = 0;
  
  for (let i = 0; i <= trimmed.length; i++) {
    const char = i < trimmed.length ? trimmed[i] : ','; // Treat end as comma
    const prevChar = i > 0 ? trimmed[i - 1] : '';
    
    // Handle string literals
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
    
    // Track nested parentheses
    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
    } else if ((char === ',' && depth === 0) || i === trimmed.length) {
      const argText = trimmed.substring(argStart, i).trim();
      args.push({
        text: argText,
        start: argStart,
        end: i
      });
      argStart = i + 1;
    }
  }
  
  return args;
}

/**
 * Find the matching closing parenthesis for an opening parenthesis.
 * @param {string} text - The full text to search in
 * @param {number} openParenIndex - Index of the opening parenthesis
 * @returns {number} - Index of closing parenthesis, or -1 if not found
 */
function findMatchingParenthesis(text, openParenIndex) {
  let depth = 1;
  let inString = false;
  let stringChar = '';
  
  for (let i = openParenIndex + 1; i < text.length && depth > 0; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';
    
    // Handle string literals
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
        return i;
      }
    }
  }
  
  return -1;
}

module.exports = {
  countFunctionArguments,
  extractFunctionArguments,
  findMatchingParenthesis
};
