/**
 * Command handlers for DIPS Calc expressions.
 * 
 * This module exports functions to create all command handlers:
 * - wrapExpression - Wraps expressions in function calls
 * - minifyFormula - Minifies calc expressions
 * - beautifyFormula - Formats calc expressions
 * - stripComments - Removes comments from calc expressions
 */

/**
 * Helper to transform document or selection.
 * @param {vscode.TextEditor} editor - The active editor
 * @param {Function} transformFn - The transformation function
 */
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

/**
 * Create all command handlers.
 * @param {vscode} vscode - The VS Code API
 * @param {Function} formatFormula - Format function
 * @param {Function} minifyFormula - Minify function
 * @param {Function} stripComments - Strip comments function
 * @returns {Array} Array of command registrations
 */
function createCommands(vscode, formatFormula, minifyFormula, stripComments) {
  // Command to wrap the expression after the cursor into the function call
  const wrapExpressionCommand = vscode.commands.registerCommand('dips-calc.wrapExpression', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    
    const document = editor.document;
    const position = editor.selection.active;
    const line = document.lineAt(position.line).text;
    
    // We expect cursor to be inside empty parens: FUNC(|)
    if (position.character < 1) return;
    
    const charBefore = line[position.character - 1];
    const charAfter = line[position.character];
    
    if (charBefore !== '(' || charAfter !== ')') return;
    
    // Get the text after the closing paren
    const afterParen = line.substring(position.character + 1);
    
    // Try to match an expression to wrap
    let expressionToWrap = null;
    let expressionLength = 0;
    
    // Match variable: $name or $name/path
    const varMatch = afterParen.match(/^(\$[A-Za-z_][A-Za-z0-9_]*(?:\/[A-Za-z_][A-Za-z0-9_]*)*)/);
    if (varMatch) {
      expressionToWrap = varMatch[1];
      expressionLength = varMatch[1].length;
    }
    
    // Match function call: FUNC(...)
    if (!expressionToWrap) {
      const funcStartMatch = afterParen.match(/^([A-Z][A-Z0-9_]*)\s*\(/i);
      if (funcStartMatch) {
        let depth = 1;
        let i = funcStartMatch[0].length;
        let inString = false;
        let stringChar = '';
        
        while (i < afterParen.length && depth > 0) {
          const char = afterParen[i];
          const prevChar = i > 0 ? afterParen[i - 1] : '';
          
          if ((char === '"' || char === "'") && prevChar !== '\\') {
            if (!inString) {
              inString = true;
              stringChar = char;
            } else if (char === stringChar) {
              inString = false;
            }
          } else if (!inString) {
            if (char === '(') depth++;
            else if (char === ')') depth--;
          }
          i++;
        }
        
        if (depth === 0) {
          expressionToWrap = afterParen.substring(0, i);
          expressionLength = i;
        }
      }
    }
    
    // Match number
    if (!expressionToWrap) {
      const numMatch = afterParen.match(/^(\d+\.?\d*)/);
      if (numMatch) {
        expressionToWrap = numMatch[1];
        expressionLength = numMatch[1].length;
      }
    }
    
    // Match identifier (but not if followed by opening paren)
    if (!expressionToWrap) {
      const idMatch = afterParen.match(/^([A-Za-z_][A-Za-z0-9_]*)(?!\s*\()/);
      if (idMatch) {
        expressionToWrap = idMatch[1];
        expressionLength = idMatch[1].length;
      }
    }
    
    if (!expressionToWrap) return;
    
    // Perform the edit: delete expression from after ) and insert inside ()
    const exprStartPos = new vscode.Position(position.line, position.character + 1);
    const exprEndPos = new vscode.Position(position.line, position.character + 1 + expressionLength);
    
    await editor.edit(editBuilder => {
      editBuilder.delete(new vscode.Range(exprStartPos, exprEndPos));
      editBuilder.insert(position, expressionToWrap);
    });
    
    // Move cursor to after the closing paren
    const newCursorPos = new vscode.Position(position.line, position.character + expressionToWrap.length + 1);
    editor.selection = new vscode.Selection(newCursorPos, newCursorPos);
  });

  // Minify command
  const minifyCommand = vscode.commands.registerCommand('dips-calc.minifyFormula', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'dips-calc') {
      vscode.window.showInformationMessage('Open a DIPS Calc expression file before running minify.');
      return;
    }
    await transformDocumentOrSelection(editor, minifyFormula);
  });

  // Beautify command
  const beautifyCommand = vscode.commands.registerCommand('dips-calc.beautifyFormula', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'dips-calc') {
      vscode.window.showInformationMessage('Open a DIPS Calc expression file before running beautify.');
      return;
    }
    await transformDocumentOrSelection(editor, formatFormula);
  });

  // Strip comments command
  const stripCommentsCommand = vscode.commands.registerCommand('dips-calc.stripComments', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'dips-calc') {
      vscode.window.showInformationMessage('Open a DIPS Calc expression file before stripping comments.');
      return;
    }
    await transformDocumentOrSelection(editor, stripComments);
    vscode.window.showInformationMessage('Comments stripped. The result is ready for use in DIPS Arena.');
  });

  return [
    wrapExpressionCommand,
    minifyCommand,
    beautifyCommand,
    stripCommentsCommand
  ];
}

module.exports = {
  createCommands
};
