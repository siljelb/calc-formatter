/**
 * Type system for DIPS Calc expressions.
 * Handles type compatibility, inference, and mapping from openEHR types.
 */

/**
 * Type compatibility rules - which types can be used where another is expected.
 */
const TYPE_COMPATIBILITY = {
  // number accepts: number, integer
  'number': ['number', 'integer', 'ticks', 'any'],
  // integer accepts: integer only
  'integer': ['integer', 'number', 'any'],
  // text accepts: text, iso8601_datetime, iso8601_date, iso8601_time, iso8601_duration
  'text': ['text', 'number', 'iso8601_datetime', 'iso8601_date', 'iso8601_time', 'iso8601_duration', 'any'],
  // boolean accepts: boolean only
  'boolean': ['boolean', 'any'],
  // ticks is numeric
  'ticks': ['ticks', 'number', 'integer', 'any'],
  // datetime accepts: datetime
  'datetime': ['datetime', 'any'],
  // ISO types
  'iso8601_datetime': ['iso8601_datetime', 'iso8601_date', 'text', 'any'],
  'iso8601_date': ['iso8601_date', 'text', 'any'],
  'iso8601_time': ['iso8601_time', 'text', 'any'],
  'iso8601_duration': ['iso8601_duration', 'text', 'any'],
  // any accepts everything
  'any': ['any', 'number', 'integer', 'text', 'boolean', 'ticks', 'datetime', 
          'iso8601_datetime', 'iso8601_date', 'iso8601_time', 'iso8601_duration', 'null'],
  // null
  'null': ['null', 'any']
};

/**
 * Mapping from openEHR rmTypes to internal type system.
 */
const RM_TYPE_MAPPING = {
  'DV_DATE_TIME': 'iso8601_datetime',
  'DV_DATE': 'iso8601_date',
  'DV_TIME': 'iso8601_time',
  'DV_DURATION': 'iso8601_duration',
  'DV_QUANTITY': 'number',
  'DV_COUNT': 'integer',
  'DV_PROPORTION': 'number',
  'DV_ORDINAL': 'integer',
  'DV_BOOLEAN': 'boolean',
  'DV_TEXT': 'text',
  'DV_CODED_TEXT': 'text',
  'DV_IDENTIFIER': 'text',
  'DV_URI': 'text'
};

/**
 * Mapping for /value accessor on openEHR types.
 * Returns the type of the value property for each rmType.
 */
const VALUE_TYPE_MAPPING = {
  'DV_DATE_TIME': 'ISO8601 datetime string',
  'DV_DATE': 'ISO8601 date string',
  'DV_TIME': 'ISO8601 time string',
  'DV_DURATION': 'ISO8601 duration string',
  'DV_QUANTITY': 'number',
  'DV_COUNT': 'integer',
  'DV_PROPORTION': 'number',
  'DV_ORDINAL': 'integer',
  'DV_BOOLEAN': 'boolean',
  'DV_TEXT': 'text',
  'DV_CODED_TEXT': 'text',
  'DV_IDENTIFIER': 'text',
  'DV_URI': 'text'
};

/**
 * Check if a given type is compatible with an expected type.
 * @param {string} givenType - The type that was provided
 * @param {string} expectedType - The type that was expected
 * @returns {boolean}
 */
function isTypeCompatible(givenType, expectedType) {
  if (!givenType || !expectedType) return true;
  if (givenType === expectedType) return true;
  if (expectedType === 'any') return true;
  if (givenType === 'any') return true;
  
  const compatibleTypes = TYPE_COMPATIBILITY[expectedType];
  if (compatibleTypes) {
    return compatibleTypes.includes(givenType);
  }
  
  return false;
}

/**
 * Infer the type of an expression.
 * @param {string} expr - The expression to analyze
 * @param {Map<string, VariableInfo>} variables - Variables from form_description.json
 * @param {Map<string, any>} functionLookup - Function metadata lookup
 * @returns {{type: string|null, confidence: 'high'|'medium'|'low'}}
 */
function inferExpressionType(expr, variables, functionLookup) {
  const trimmed = expr.trim();
  
  // Empty expression
  if (!trimmed) {
    return { type: null, confidence: 'low' };
  }
  
  // String literal - must be a complete quoted string (opening quote matches closing quote)
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    // Verify it's actually a single string literal by checking the quotes match
    const quoteChar = trimmed[0];
    let escaped = false;
    let quoteCount = 0;
    
    for (let i = 0; i < trimmed.length; i++) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (trimmed[i] === '\\') {
        escaped = true;
        continue;
      }
      if (trimmed[i] === quoteChar) {
        quoteCount++;
      }
    }
    
    // If there are exactly 2 quotes (opening and closing), it's a string literal
    if (quoteCount === 2) {
      // Check if it looks like an ISO date/time
      const content = trimmed.slice(1, -1);
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(content)) {
        return { type: 'iso8601_datetime', confidence: 'high' };
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(content)) {
        return { type: 'iso8601_date', confidence: 'high' };
      }
      if (/^\d{2}:\d{2}:\d{2}/.test(content)) {
        return { type: 'iso8601_time', confidence: 'high' };
      }
      if (/^P(\d+Y)?(\d+M)?(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/.test(content)) {
        return { type: 'iso8601_duration', confidence: 'high' };
      }
      return { type: 'text', confidence: 'high' };
    }
    // Otherwise fall through - it's not a simple string literal
  }
  
  // Numeric literal
  if (/^-?\d+$/.test(trimmed)) {
    return { type: 'integer', confidence: 'high' };
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return { type: 'number', confidence: 'high' };
  }
  
  // Boolean literals
  if (/^(true|false)$/i.test(trimmed)) {
    return { type: 'boolean', confidence: 'high' };
  }
  
  // Comparison operators return boolean - check BEFORE variable references and function calls
  // This needs to come early because expressions like "$var = 5" should be boolean, not the variable's type
  // BUT only if they're at the TOP LEVEL (not inside function parentheses)
  // so expressions like "MAX(...) > 305" are correctly typed as boolean
  // but "IF(x > 0, 1, 0)" is typed by IF's return type
  if (/[<>=!]/.test(trimmed)) {
    // Parse to check if operator is outside of quotes AND outside of parentheses
    let inQuotes = false;
    let quoteChar = null;
    let parenDepth = 0;
    let foundTopLevelComparison = false;
    
    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      
      // Track quote state
      if ((char === '"' || char === "'") && (i === 0 || trimmed[i-1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = null;
        }
        continue;
      }
      
      if (inQuotes) continue;
      
      // Track parenthesis depth
      if (char === '(') {
        parenDepth++;
      } else if (char === ')') {
        parenDepth--;
      } else if (parenDepth === 0) {
        // At top level, check for comparison operators
        if (char === '=' || char === '<' || char === '>' || char === '!') {
          foundTopLevelComparison = true;
          break;
        }
      }
    }
    
    if (foundTopLevelComparison) {
      return { type: 'boolean', confidence: 'high' };
    }
  }
  
  // Variable reference - match variable with optional path accessors (e.g., $var or $var/path/to/field)
  // Only if it's JUST a variable reference with no operators
  const varPattern = /^\$[a-zA-Z_][a-zA-Z0-9_]*(\/[a-zA-Z_][a-zA-Z0-9_]*)*$/;
  if (varPattern.test(trimmed)) {
    const varName = trimmed.replace(/^[$]/, '').split('/')[0];
    const varInfo = variables?.get(varName);
    if (varInfo?.rmType) {
      const mappedType = RM_TYPE_MAPPING[varInfo.rmType];
      if (mappedType) {
        return { type: mappedType, confidence: 'high' };
      }
    }
    return { type: null, confidence: 'low' };
  }
  // BUT only if they're at the TOP LEVEL (not inside function parentheses)
  // so expressions like "MAX(...) > 305" are correctly typed as boolean
  // but "IF(x > 0, 1, 0)" is typed by IF's return type
  if (/[<>=!]/.test(trimmed)) {
    // Parse to check if operator is outside of quotes AND outside of parentheses
    let inQuotes = false;
    let quoteChar = null;
    let parenDepth = 0;
    let foundTopLevelComparison = false;
    
    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      
      // Track quote state
      if ((char === '"' || char === "'") && (i === 0 || trimmed[i-1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = null;
        }
        continue;
      }
      
      if (inQuotes) continue;
      
      // Track parenthesis depth
      if (char === '(') {
        parenDepth++;
      } else if (char === ')') {
        parenDepth--;
      } else if (parenDepth === 0) {
        // At top level, check for comparison operators
        if (char === '=' || char === '<' || char === '>' || char === '!') {
          foundTopLevelComparison = true;
          break;
        }
      }
    }
    
    if (foundTopLevelComparison) {
      return { type: 'boolean', confidence: 'high' };
    }
  }
  
  // Function call - infer from function's return type
  const funcMatch = trimmed.match(/^([A-Z][A-Z0-9_]*)\s*\(/i);
  if (funcMatch && functionLookup) {
    const funcName = funcMatch[1].toUpperCase();
    const funcInfo = functionLookup.get(funcName);
    if (funcInfo?.returns) {
      return { type: funcInfo.returns, confidence: 'high' };
    }
  }
  
  // Arithmetic expression (contains +, -, *, /, ^) - check operands are numeric
  if (/[+\-*\/^%]/.test(trimmed) && !/["']/.test(trimmed)) {
    // For simple binary operations like $var/number, check if the variable is numeric
    const simpleVarOp = trimmed.match(/^\$([a-zA-Z_][a-zA-Z0-9_]*)\s*[+\-*\/^%]/);
    if (simpleVarOp && variables) {
      const varName = simpleVarOp[1];
      const varInfo = variables.get(varName);
      if (varInfo?.rmType) {
        const mappedType = RM_TYPE_MAPPING[varInfo.rmType];
        // If the variable is text or other non-numeric type, don't infer as number
        if (mappedType && !['number', 'integer', 'ticks'].includes(mappedType)) {
          // Return the actual variable type with high confidence to flag the error
          return { type: mappedType, confidence: 'high' };
        }
      }
    }
    return { type: 'number', confidence: 'medium' };
  }
  
  // & is string concatenation
  if (trimmed.includes('&')) {
    return { type: 'text', confidence: 'medium' };
  }
  
  return { type: null, confidence: 'low' };
}

/**
 * Get a human-readable type description.
 * @param {string} type 
 * @returns {string}
 */
function formatTypeName(type) {
  const typeNames = {
    'number': 'number',
    'integer': 'integer',
    'text': 'text',
    'boolean': 'boolean',
    'ticks': 'ticks (numeric timestamp)',
    'datetime': 'datetime',
    'iso8601_datetime': 'ISO 8601 datetime string',
    'iso8601_date': 'ISO 8601 date string',
    'iso8601_time': 'ISO 8601 time string',
    'iso8601_duration': 'ISO 8601 duration string',
    'any': 'any',
    'null': 'null'
  };
  return typeNames[type] || type;
}

module.exports = {
  TYPE_COMPATIBILITY,
  RM_TYPE_MAPPING,
  VALUE_TYPE_MAPPING,
  isTypeCompatible,
  inferExpressionType,
  formatTypeName
};
