const vscode = require('vscode');

// Function metadata lives in a separate module for easier maintenance.
const FUNCTION_ITEMS = require('./function-items');
const FUNCTION_LOOKUP = new Map(
  FUNCTION_ITEMS.map(item => [item.name.toUpperCase(), item])
);

// Entry point for the VS Code extension lifecycle.
function activate(context) {
  const selector = { language: 'dips-calc', scheme: '*' };

  // Autocomplete provider built from FUNCTION_ITEMS above.
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    selector,
    {
      provideCompletionItems(document, position) {
        const lineText = document.lineAt(position.line).text;
        const linePrefix = lineText.substring(0, position.character);
        
        // Don't provide function completions if user already typed opening parenthesis
        if (linePrefix.match(/[A-Za-z_][A-Za-z0-9_]*\s*\($/)) {
          return [];
        }
        
        const items = FUNCTION_ITEMS.map(fn => {
          const item = new vscode.CompletionItem(fn.name, vscode.CompletionItemKind.Function);
          item.detail = fn.signature;
          item.documentation = fn.detail;
          
          // Check if function takes arguments by looking at signature
          // Functions without args have "()" directly, functions with args have something inside
          const hasArgs = !fn.signature.match(/\(\s*\)$/);
          
          if (hasArgs) {
            // Place cursor inside parentheses: FUNC(|)
            item.insertText = new vscode.SnippetString(`${fn.name}($0)`);
          } else {
            // Place cursor after parentheses: FUNC()|
            item.insertText = new vscode.SnippetString(`${fn.name}()$0`);
          }
          
          return item;
        });
        return items;
      }
    }
  );

  // Variable completion provider - triggers on '$'
  const variableCompletionProvider = vscode.languages.registerCompletionItemProvider(
    selector,
    {
      provideCompletionItems(document, position) {
        const lineText = document.lineAt(position.line).text;
        const linePrefix = lineText.substring(0, position.character);
        
        // Only provide completions if we're typing a variable (after $)
        if (!linePrefix.match(/\$[A-Za-z0-9_.]*$/)) {
          return [];
        }

        // Scan the entire document for variables
        const text = document.getText();
        const variableRegex = /\$[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/g;
        const variables = new Set();
        
        let match;
        while ((match = variableRegex.exec(text)) !== null) {
          variables.add(match[0]);
        }

        // Create completion items for each unique variable
        const items = Array.from(variables).map(varName => {
          const item = new vscode.CompletionItem(varName, vscode.CompletionItemKind.Variable);
          item.detail = 'Variable';
          // Insert without the $ since user already typed it
          item.insertText = varName.substring(1);
          item.filterText = varName;
          return item;
        });

        return items;
      }
    },
    '$' // Trigger on $ character
  );

  // Full-document formatter invoked by the built-in Format Document command.
  const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider(selector, {
    provideDocumentFormattingEdits(document) {
      const text = document.getText();
      const formatted = formatFormula(text);
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(text.length)
      );
      if (formatted === text) {
        return [];
      }
      const ensureTrailingNewline = /\r?\n$/.test(text);
      const finalText = ensureTrailingNewline && !/\r?\n$/.test(formatted) ? `${formatted}\n` : formatted;
      return [vscode.TextEdit.replace(fullRange, finalText)];
    }
  });

  // Range formatter for Format Selection scenarios.
  const rangeFormattingProvider = vscode.languages.registerDocumentRangeFormattingEditProvider(selector, {
    provideDocumentRangeFormattingEdits(document, range) {
      const text = document.getText(range);
      const formatted = formatFormula(text);
      if (formatted === text) {
        return [];
      }
      return [vscode.TextEdit.replace(range, formatted)];
    }
  });

  const hoverProvider = vscode.languages.registerHoverProvider(selector, {
    provideHover(document, position) {
      const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z][A-Za-z0-9_\.]*/);
      if (!wordRange) {
        return null;
      }

      const functionName = document.getText(wordRange).toUpperCase();
      const metadata = FUNCTION_LOOKUP.get(functionName);
      if (!metadata) {
        return null;
      }

      const markdown = new vscode.MarkdownString();
      markdown.appendCodeblock(metadata.signature, 'dips-calc');
      if (metadata.detail) {
        markdown.appendMarkdown(`\n\n${metadata.detail}`);
      }

      return new vscode.Hover(markdown, wordRange);
    }
  });

  // Command palette entry to collapse formulas to a compact representation.
  const minifyCommand = vscode.commands.registerCommand('dips-calc.minifyFormula', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'dips-calc') {
      vscode.window.showInformationMessage('Open a DIPS Calc expression file before running minify.');
      return;
    }

    await transformDocumentOrSelection(editor, minifyFormula);
  });

  const beautifyCommand = vscode.commands.registerCommand('dips-calc.beautifyFormula', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'dips-calc') {
      vscode.window.showInformationMessage('Open a DIPS Calc expression file before running beautify.');
      return;
    }

    await transformDocumentOrSelection(editor, formatFormula);
  });

  const stripCommentsCommand = vscode.commands.registerCommand('dips-calc.stripComments', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'dips-calc') {
      vscode.window.showInformationMessage('Open a DIPS Calc expression file before stripping comments.');
      return;
    }

    await transformDocumentOrSelection(editor, stripComments);
    vscode.window.showInformationMessage('Comments stripped. The result is ready for use in DIPS Arena.');
  });

  context.subscriptions.push(
    completionProvider,
    variableCompletionProvider,
    formattingProvider,
    rangeFormattingProvider,
    hoverProvider,
    minifyCommand,
    beautifyCommand,
    stripCommentsCommand
  );
}

function deactivate() {}

// Friendly formatter that breaks multi-line expressions into readable chunks.
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

// Removes all // comments from the formula so it can be used in DIPS Arena
// which does not support comments natively.
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

// Find the start of a // comment, ignoring // inside strings
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

// Removes optional whitespace while retaining separation between words/strings.
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

// Pretty-printer responsible for indentation and punctuation placement.
function formatSingleFormula(formula) {
  const tokens = tokenize(formula);
  if (!tokens.length) {
    return formula.trim();
  }
  const indentUnit = '  ';
  let indentLevel = 0;
  const lines = [];
  let currentLine = '';
  let lastToken = null;

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

  tokens.forEach((token, index) => {
    if (token.type === 'punct') {
      if (token.value === '(' || token.value === '{') {
        currentLine = currentLine.trimEnd();
        ensureIndent();
        currentLine += token.value;
        closeLine();
        indentLevel += 1;
      } else if (token.value === ')' || token.value === '}') {
        if (currentLine.trim().length) {
          closeLine();
        }
        indentLevel = Math.max(indentLevel - 1, 0);
        currentLine = indentUnit.repeat(indentLevel) + token.value;
      } else if (token.value === ',' || token.value === ';') {
        currentLine = currentLine.trimEnd();
        ensureIndent();
        currentLine += token.value;
        closeLine();
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

// Shared tokenizer so formatting and minify stay in sync.
function tokenize(source) {
  const tokens = [];
  let buffer = '';
  let inString = false;
  let stringChar = '';

  const flushBuffer = () => {
    if (!buffer) {
      return;
    }
    tokens.push({ type: 'word', value: buffer });
    buffer = '';
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

async function transformDocumentOrSelection(editor, transformFn) {
  const document = editor.document;
  const selections = editor.selections;
  const newlinePattern = /\r?\n$/;

  const hasSelection = selections.some(selection => !selection.isEmpty);
  if (hasSelection) {
    await editor.edit(editBuilder => {
      selections.forEach(selection => {
        if (selection.isEmpty) {
          return;
        }
        const original = document.getText(selection);
        const transformed = transformFn(original);
        if (transformed !== original) {
          editBuilder.replace(selection, transformed);
        }
      });
    });
    return;
  }

  const text = document.getText();
  const transformed = transformFn(text);
  if (transformed === text) {
    return;
  }

  const ensureTrailingNewline = newlinePattern.test(text);
  const finalText = ensureTrailingNewline && !newlinePattern.test(transformed)
    ? `${transformed}\n`
    : transformed;

  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(text.length)
  );

  await editor.edit(editBuilder => {
    editBuilder.replace(fullRange, finalText);
  });
}

module.exports = {
  activate,
  deactivate,
  _formatFormula: formatFormula,
  _minifyFormula: minifyFormula,
  _stripComments: stripComments,
};
