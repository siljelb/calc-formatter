/**
 * Formatting utilities for DIPS Calc expressions.
 * 
 * This module contains the formatting, minification, and comment stripping functions.
 */

const { INDENT_UNIT } = require('./constants');

/**
 * Format a formula with proper indentation and line breaks.
 * @param {string} input - The input formula
 * @returns {string} - The formatted formula
 */
function formatFormula(input) {
  if (!input.trim()) {
    return input;
  }
  const lines = input.split(/\r?\n/);
  const groups = [];
  let current = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current.length) {
        groups.push(current);
        current = [];
      }
      groups.push(null);
      continue;
    }
    // Preserve comment lines as-is
    if (trimmed.startsWith('//')) {
      if (current.length) {
        groups.push(current);
        current = [];
      }
      groups.push(['__COMMENT__' + trimmed]);
      continue;
    }
    current.push(trimmed);
  }

  if (current.length) {
    groups.push(current);
  }

  while (groups.length && groups[groups.length - 1] === null) {
    groups.pop();
  }

  const formattedLines = [];

  groups.forEach(section => {
    if (section === null) {
      if (formattedLines.length && formattedLines[formattedLines.length - 1] !== '') {
        formattedLines.push('');
      }
      return;
    }
    // Handle comment lines
    if (section.length === 1 && section[0].startsWith('__COMMENT__')) {
      formattedLines.push(section[0].slice('__COMMENT__'.length));
      return;
    }
    const formula = section.join(' ');
    const formatted = formatSingleFormula(formula);
    if (!formatted) {
      return;
    }
    formatted.split('\n').forEach(line => formattedLines.push(line));
  });

  return formattedLines.join('\n');
}

/**
 * Minify a formula by removing unnecessary whitespace.
 * @param {string} input - The input formula
 * @returns {string} - The minified formula
 */
function minifyFormula(input) {
  if (!input.trim()) {
    return input;
  }

  const lines = input.split(/\r?\n/);
  const groups = [];
  let current = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current.length) {
        groups.push(current);
        current = [];
      }
      groups.push(null);
      continue;
    }
    // Preserve comment lines as-is
    if (trimmed.startsWith('//')) {
      if (current.length) {
        groups.push(current);
        current = [];
      }
      groups.push(['__COMMENT__' + trimmed]);
      continue;
    }
    current.push(trimmed);
  }

  if (current.length) {
    groups.push(current);
  }

  while (groups.length && groups[groups.length - 1] === null) {
    groups.pop();
  }

  const minifiedLines = [];

  groups.forEach(section => {
    if (section === null) {
      if (minifiedLines.length && minifiedLines[minifiedLines.length - 1] !== '') {
        minifiedLines.push('');
      }
      return;
    }
    // Handle comment lines
    if (section.length === 1 && section[0].startsWith('__COMMENT__')) {
      minifiedLines.push(section[0].slice('__COMMENT__'.length));
      return;
    }
    const formula = section.join(' ');
    const minified = minifySingleFormula(formula);
    if (!minified) {
      return;
    }
    minifiedLines.push(minified);
  });

  return minifiedLines.join('\n');
}

/**
 * Remove all // comments from the formula.
 * @param {string} input - The input formula
 * @returns {string} - The formula without comments
 */
function stripComments(input) {
  if (!input.trim()) {
    return input;
  }

  const lines = input.split(/\r?\n/);
  const outputLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip lines that are only comments
    if (trimmed.startsWith('//')) {
      continue;
    }
    
    // Remove inline comments (// at end of line)
    const commentIndex = findCommentStart(line);
    if (commentIndex !== -1) {
      const withoutComment = line.substring(0, commentIndex).trimEnd();
      if (withoutComment) {
        outputLines.push(withoutComment);
      }
    } else {
      outputLines.push(line);
    }
  }

  // Remove trailing empty lines
  while (outputLines.length && !outputLines[outputLines.length - 1].trim()) {
    outputLines.pop();
  }

  return outputLines.join('\n');
}

/**
 * Find the start of a // comment, ignoring // inside strings.
 * @param {string} line - The line to search
 * @returns {number} - The index of the comment start, or -1 if not found
 */
function findCommentStart(line) {
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inString) {
      if (ch === stringChar) {
        // Check for escaped quote (doubled)
        if (i + 1 < line.length && line[i + 1] === stringChar) {
          i += 1;
          continue;
        }
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      continue;
    }

    if (ch === '/' && line[i + 1] === '/') {
      return i;
    }
  }

  return -1;
}

/**
 * Minify a single formula expression.
 * @param {string} formula - The formula to minify
 * @returns {string} - The minified formula
 */
function minifySingleFormula(formula) {
  const tokens = tokenize(formula);
  if (!tokens.length) {
    return formula.trim();
  }

  let result = '';
  let lastToken = null;

  tokens.forEach(token => {
    if (token.type === 'operator' || token.type === 'punct') {
      if (token.value === ')' || token.value === '}') {
        result = result.trimEnd();
      }
      result += token.value;
      lastToken = token;
      return;
    }

    if (token.type === 'word') {
      if (lastToken && (lastToken.type === 'word' || lastToken.type === 'string')) {
        result += ' ';
      }
      result += token.value;
      lastToken = token;
      return;
    }

    if (token.type === 'string') {
      if (lastToken && (lastToken.type === 'word' || lastToken.type === 'string')) {
        result += ' ';
      }
      result += token.value;
      lastToken = token;
    }
  });

  return result.trim();
}

/**
 * Format a single formula expression with proper indentation.
 * @param {string} formula - The formula to format
 * @returns {string} - The formatted formula
 */
function formatSingleFormula(formula) {
  const tokens = tokenize(formula);
  if (!tokens.length) {
    return formula.trim();
  }
  const indentUnit = INDENT_UNIT;
  let indentLevel = 0;
  const lines = [];
  let currentLine = '';
  let lastToken = null;

  // Count arguments in the upcoming parentheses group
  const countArgs = (startIndex) => {
    let depth = 0;
    let argCount = 0;
    let hasContent = false;
    
    for (let i = startIndex; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === 'punct') {
        if (token.value === '(' || token.value === '{') {
          depth++;
        } else if (token.value === ')' || token.value === '}') {
          depth--;
          if (depth === 0) {
            return hasContent ? argCount + 1 : 0;
          }
        } else if (token.value === ',' && depth === 1) {
          argCount++;
        }
      } else if (depth === 1 && (token.type === 'word' || token.type === 'string')) {
        hasContent = true;
      }
    }
    return argCount;
  };

  const ensureIndent = () => {
    if (!currentLine) {
      currentLine = indentUnit.repeat(indentLevel);
    }
  };

  const ensureSpaceBefore = () => {
    if (!currentLine) {
      ensureIndent();
      return;
    }
    if (/\s$/.test(currentLine) || currentLine.endsWith('(') || currentLine.endsWith('{')) {
      return;
    }
    currentLine += ' ';
  };

  const closeLine = () => {
    lines.push(currentLine.trimEnd());
    currentLine = '';
  };

  // Track whether current parentheses group should be multiline
  const multilineStack = [];

  tokens.forEach((token, index) => {
    if (token.type === 'punct') {
      if (token.value === '(' || token.value === '{') {
        const argCount = countArgs(index);
        const shouldMultiline = argCount > 1;
        multilineStack.push(shouldMultiline);
        
        currentLine = currentLine.trimEnd();
        ensureIndent();
        currentLine += token.value;
        
        if (shouldMultiline) {
          closeLine();
          indentLevel += 1;
        }
      } else if (token.value === ')' || token.value === '}') {
        const wasMultiline = multilineStack.pop();
        
        if (wasMultiline) {
          if (currentLine.trim().length) {
            closeLine();
          }
          indentLevel = Math.max(indentLevel - 1, 0);
          currentLine = indentUnit.repeat(indentLevel) + token.value;
        } else {
          currentLine += token.value;
        }
      } else if (token.value === ',' || token.value === ';') {
        const isMultiline = multilineStack.length > 0 && multilineStack[multilineStack.length - 1];
        currentLine = currentLine.trimEnd();
        ensureIndent();
        currentLine += token.value;
        
        if (isMultiline) {
          closeLine();
        } else {
          currentLine += ' ';
        }
      } else {
        ensureIndent();
        currentLine += token.value;
      }
      lastToken = token;
      return;
    }

    if (token.type === 'operator') {
      const atLineStart = lines.length === 0 && !currentLine.trim();
      if (token.value === '=' && atLineStart) {
        ensureIndent();
        currentLine += '=';
        lastToken = token;
        return;
      }
      const isUnary = (token.value === '-' || token.value === '+') && (!lastToken || lastToken.type === 'operator' || (lastToken.type === 'punct' && ['(', '{', ',', ';'].includes(lastToken.value)));
      ensureIndent();
      if (isUnary) {
        currentLine += token.value;
      } else {
        ensureSpaceBefore();
        currentLine += token.value;
        currentLine += ' ';
      }
      lastToken = token;
      return;
    }

    if (token.type === 'string' || token.type === 'word') {
      ensureIndent();
      if (currentLine && !/\s$/.test(currentLine) && !currentLine.endsWith('(') && !currentLine.endsWith('{') && !currentLine.endsWith('=')) {
        currentLine += ' ';
      }
      currentLine += token.value;
      lastToken = token;
      return;
    }
  });

  if (currentLine.trim().length) {
    closeLine();
  }

  return lines.join('\n');
}

/**
 * Tokenize a formula into its component parts.
 * @param {string} source - The source formula
 * @returns {Array<{type: string, value: string}>} - Array of tokens
 */
function tokenize(source) {
  const tokens = [];
  let buffer = '';
  let inString = false;
  let stringChar = '';
  let inVariable = false; // Track if we're inside a $variable

  const flushBuffer = () => {
    if (!buffer) {
      return;
    }
    tokens.push({ type: 'word', value: buffer });
    buffer = '';
    inVariable = false;
  };

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    // Handle line comments
    if (!inString && ch === '/' && source[i + 1] === '/') {
      flushBuffer();
      let comment = '//';
      i += 2;
      while (i < source.length && source[i] !== '\n') {
        comment += source[i];
        i += 1;
      }
      tokens.push({ type: 'comment', value: comment });
      if (i < source.length) {
        i -= 1; // Let the main loop handle the newline
      }
      continue;
    }

    if (inString) {
      buffer += ch;
      if (ch === stringChar) {
        // Check for escaped quote (doubled)
        if (i + 1 < source.length && source[i + 1] === stringChar) {
          buffer += source[i + 1];
          i += 1;
          continue;
        }
        tokens.push({ type: 'string', value: buffer });
        buffer = '';
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      flushBuffer();
      buffer = ch;
      stringChar = ch;
      inString = true;
      continue;
    }

    // Start of a variable
    if (ch === '$') {
      flushBuffer();
      buffer = ch;
      inVariable = true;
      continue;
    }

    // Inside a variable, allow / as part of the path (e.g., $var/value)
    if (inVariable && ch === '/') {
      buffer += ch;
      continue;
    }

    if (/\s/.test(ch)) {
      flushBuffer();
      continue;
    }

    const twoChar = source.slice(i, i + 2);
    if (twoChar === '>=' || twoChar === '<=' || twoChar === '<>') {
      flushBuffer();
      tokens.push({ type: 'operator', value: twoChar });
      i += 1;
      continue;
    }

    if (',;(){}[]'.includes(ch)) {
      flushBuffer();
      tokens.push({ type: 'punct', value: ch });
      continue;
    }

    if ('+-*/^&%=><?:'.includes(ch)) {
      flushBuffer();
      tokens.push({ type: 'operator', value: ch });
      continue;
    }

    buffer += ch;
  }

  if (buffer) {
    tokens.push({ type: 'word', value: buffer });
  }

  return tokens;
}

module.exports = {
  formatFormula,
  minifyFormula,
  stripComments,
  tokenize
};
