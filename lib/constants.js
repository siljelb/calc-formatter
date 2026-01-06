/**
 * Constants for the DIPS Calc formatter extension.
 * Centralizes configuration values used across the codebase.
 */

/**
 * Indentation configuration
 */
const INDENT_UNIT = '  '; // 2 spaces
const INDENT_SIZE = 2;

/**
 * Diagnostic severity codes
 */
const DIAGNOSTIC_CODES = {
  INVALID_FUNCTION_CALL: 'invalid-function-call',
  MISSING_COMMA: 'missing-comma',
  UNKNOWN_VARIABLE: 'unknown-variable'
};

/**
 * Diagnostic source identifier
 */
const DIAGNOSTIC_SOURCE = 'dips-calc';

module.exports = {
  INDENT_UNIT,
  INDENT_SIZE,
  DIAGNOSTIC_CODES,
  DIAGNOSTIC_SOURCE
};
