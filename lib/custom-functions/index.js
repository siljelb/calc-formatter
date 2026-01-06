/**
 * Custom function definitions index.
 * 
 * This module automatically loads all custom functions from individual files.
 * 
 * To add a new custom function:
 * 1. Create a new file in this directory (e.g., my-function.js)
 * 2. Export an object with: name, signature, detail, params, expansion
 * 3. That's it! The function will be automatically loaded.
 */

const fs = require('fs');
const path = require('path');

/**
 * Array of all custom function definitions.
 * Automatically loaded from all .js files in this directory (except index.js).
 */
const CUSTOM_FUNCTIONS = [];

// Load all custom function files from this directory
const customFunctionsDir = __dirname;
const files = fs.readdirSync(customFunctionsDir);

for (const file of files) {
  // Skip index.js and non-js files
  if (file === 'index.js' || !file.endsWith('.js')) {
    continue;
  }
  
  const funcDef = require(path.join(customFunctionsDir, file));
  CUSTOM_FUNCTIONS.push(funcDef);
}

/**
 * Expand custom functions in a formula.
 * Recursively expands nested custom function calls.
 * 
 * @param {string} formula - The formula containing custom functions
 * @returns {string} - Formula with custom functions expanded
 */
function expandCustomFunctions(formula) {
  if (!formula || typeof formula !== 'string') {
    return formula;
  }
  
  let expanded = formula;
  let maxIterations = 10; // Prevent infinite loops
  let iteration = 0;
  let changed = true;
  
  while (changed && iteration < maxIterations) {
    changed = false;
    iteration++;
    
    // Find all custom function calls
    for (const customFunc of CUSTOM_FUNCTIONS) {
      const regex = new RegExp(`\\b${customFunc.name}\\s*\\(`, 'gi');
      let match;
      
      while ((match = regex.exec(expanded)) !== null) {
        const startIndex = match.index;
        const openParenIndex = startIndex + match[0].length - 1;
        
        // Find matching closing parenthesis
        const closeParenIndex = findMatchingParen(expanded, openParenIndex);
        if (closeParenIndex === -1) continue;
        
        // Extract arguments
        const argsString = expanded.substring(openParenIndex + 1, closeParenIndex);
        const args = parseArguments(argsString);
        
        // Allow fewer arguments than params for optional parameters
        // Just need at least 1 argument and not more than defined params
        if (args.length < 1 || args.length > customFunc.params.length) {
          continue;
        }
        
        // Build expansion by replacing parameter placeholders
        let expansion = customFunc.expansion;
        for (let i = 0; i < customFunc.params.length; i++) {
          // Extract param name from object or use string directly
          const paramName = typeof customFunc.params[i] === 'string' 
            ? customFunc.params[i] 
            : customFunc.params[i].name;
          // Use the argument if provided, otherwise use empty string
          const argValue = i < args.length ? args[i].trim() : '';
          // Replace all occurrences of {paramName} with the argument value
          const paramRegex = new RegExp(`\\{${paramName}\\}`, 'g');
          expansion = expansion.replace(paramRegex, argValue);
        }
        
        // Replace the function call with its expansion
        expanded = expanded.substring(0, startIndex) + `(${expansion})` + expanded.substring(closeParenIndex + 1);
        
        changed = true;
        break; // Restart the search after modification
      }
      
      if (changed) break; // Restart with first function again
    }
  }
  
  return expanded;
}

/**
 * Find matching closing parenthesis.
 * @param {string} text - Text to search
 * @param {number} openIndex - Index of opening parenthesis
 * @returns {number} - Index of closing paren, or -1 if not found
 */
function findMatchingParen(text, openIndex) {
  let depth = 1;
  let inString = false;
  let stringChar = '';
  
  for (let i = openIndex + 1; i < text.length; i++) {
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
        return i;
      }
    }
  }
  
  return -1;
}

/**
 * Parse function arguments from argument string.
 * @param {string} argsString - String containing arguments
 * @returns {Array<string>} - Array of argument strings
 */
function parseArguments(argsString) {
  const trimmed = argsString.trim();
  if (trimmed === '') return [];
  
  const args = [];
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let currentArg = '';
  
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const prevChar = i > 0 ? trimmed[i - 1] : '';
    
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
      currentArg += char;
      continue;
    }
    
    if (inString) {
      currentArg += char;
      continue;
    }
    
    if (char === '(') {
      depth++;
      currentArg += char;
    } else if (char === ')') {
      depth--;
      currentArg += char;
    } else if (char === ',' && depth === 0) {
      args.push(currentArg);
      currentArg = '';
    } else {
      currentArg += char;
    }
  }
  
  if (currentArg) {
    args.push(currentArg);
  }
  
  return args;
}

/**
 * Check if a formula contains any custom functions.
 * @param {string} formula - The formula to check
 * @returns {boolean} - True if custom functions are present
 */
function hasCustomFunctions(formula) {
  for (const customFunc of CUSTOM_FUNCTIONS) {
    const regex = new RegExp(`\\b${customFunc.name}\\s*\\(`, 'i');
    if (regex.test(formula)) {
      return true;
    }
  }
  return false;
}

module.exports = {
  CUSTOM_FUNCTIONS,
  expandCustomFunctions,
  hasCustomFunctions
};
