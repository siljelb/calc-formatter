/**
 * Custom function definitions that expand into DIPS Calc expressions.
 * 
 * These are user-definable functions that get compiled/expanded into
 * the underlying DIPS Arena calc expressions before export.
 */

/**
 * Custom function definitions.
 * Each function has:
 * - name: The function name (uppercase convention)
 * - signature: Display signature for IntelliSense
 * - detail: Description
 * - params: Array of parameter names
 * - expansion: Template string with {param} placeholders or function that returns expansion
 */
const CUSTOM_FUNCTIONS = [
  {
    name: 'BMI',
    signature: 'BMI(weight_kg, height_cm)',
    detail: 'Calculates Body Mass Index from weight (kg) and height (cm). Formula: weight / (height_m²)',
    params: ['weight_kg', 'height_cm'],
    expansion: 'ROUND({weight_kg} / (({height_cm} / 100) * ({height_cm} / 100)), 1)'
  },
  {
    name: 'IS_ADULT',
    signature: 'IS_ADULT(birthdate_ticks)',
    detail: 'Checks if person is 18 years or older based on birthdate.',
    params: ['birthdate_ticks'],
    expansion: 'AGE({birthdate_ticks}, NOW()) >= 18'
  },
  {
    name: 'IS_ELDERLY',
    signature: 'IS_ELDERLY(birthdate_ticks)',
    detail: 'Checks if person is 65 years or older based on birthdate.',
    params: ['birthdate_ticks'],
    expansion: 'AGE({birthdate_ticks}, NOW()) >= 65'
  },
  {
    name: 'AGE_YEARS',
    signature: 'AGE_YEARS(birthdate_ticks)',
    detail: 'Calculates current age in years.',
    params: ['birthdate_ticks'],
    expansion: 'AGE({birthdate_ticks}, NOW())'
  },
  {
    name: 'DAYS_SINCE',
    signature: 'DAYS_SINCE(date_ticks)',
    detail: 'Calculates number of days since a given date.',
    params: ['date_ticks'],
    expansion: 'DATEDIF({date_ticks}, NOW(), "d")'
  }
];

/**
 * Expand custom functions in a formula.
 * Recursively expands nested custom function calls.
 * 
 * @param {string} formula - The formula containing custom functions
 * @returns {string} - Formula with custom functions expanded
 */
function expandCustomFunctions(formula) {
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
        
        if (args.length !== customFunc.params.length) {
          // Wrong number of arguments - skip expansion (will be caught by validation)
          continue;
        }
        
        // Build expansion by replacing parameter placeholders
        let expansion = customFunc.expansion;
        for (let i = 0; i < customFunc.params.length; i++) {
          const paramName = customFunc.params[i];
          const argValue = args[i].trim();
          // Replace all occurrences of {paramName} with the argument value
          const paramRegex = new RegExp(`\\{${paramName}\\}`, 'g');
          expansion = expansion.replace(paramRegex, argValue);
        }
        
        // Replace the function call with its expansion
        const fullCall = expanded.substring(startIndex, closeParenIndex + 1);
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
  
  for (let i = openIndex + 1; i < text.length && depth > 0; i++) {
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
    
    if (char === '(') depth++;
    else if (char === ')') depth--;
  }
  
  return depth === 0 ? (openIndex + 1 + text.substring(openIndex + 1).indexOf(')') + (text.substring(0, openIndex + 1).match(/\(/g) || []).length - 1) : -1;
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
