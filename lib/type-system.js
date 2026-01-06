/**
 * Type system for DIPS Calc expressions.
 * Handles type compatibility, inference, and mapping from openEHR types.
 */

/**
 * Type compatibility rules - which types can be used where another is expected.
 */
const TYPE_COMPATIBILITY = {
  // number accepts: number, integer
  'number': ['number', 'integer', 'any'],
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
  'iso8601_datetime': ['iso8601_datetime', 'text', 'any'],
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
  
  // String literal
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
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
  
  // Variable reference
  if (trimmed.startsWith('$')) {
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
  
  // Comparison operators return boolean - check BEFORE function calls
  // so expressions like "MAX(...) > 305" are correctly typed as boolean
  if (/[<>=!]|<>|>=|<=|==|!=/.test(trimmed)) {
    return { type: 'boolean', confidence: 'medium' };
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
  
  // Arithmetic expression (contains +, -, *, /, ^) - likely number
  if (/[+\-*\/^%]/.test(trimmed) && !/["']/.test(trimmed)) {
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
