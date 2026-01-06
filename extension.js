const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// Function metadata lives in a separate module for easier maintenance.
const FUNCTION_ITEMS = require('./function-items');
const FUNCTION_LOOKUP = new Map(
  FUNCTION_ITEMS.map(item => [item.name.toUpperCase(), item])
);

// Import modular components
const { 
  findFormDescriptionJson, 
  getVariablesFromFormDescription, 
  clearCache: clearFormDescCache, 
  invalidateCache: invalidateFormDescCache 
} = require('./lib/form-description');

const { 
  isTypeCompatible, 
  inferExpressionType, 
  formatTypeName 
} = require('./lib/type-system');

const { 
  countFunctionArguments, 
  extractFunctionArguments 
} = require('./lib/function-parsing');

const { 
  validateISO8601String,
  validateFunctionCalls, 
  detectMissingCommas 
} = require('./lib/validation');

const { 
  createHoverProvider 
} = require('./lib/hover-provider');

const {
  formatFormula,
  minifyFormula,
  stripComments
} = require('./lib/formatting');

const {
  createCompletionProviders
} = require('./lib/completion-providers');

const {
  createCommands
} = require('./lib/commands');

const {
  createDiagnosticsProvider
} = require('./lib/diagnostics-provider');

// Entry point for the VS Code extension lifecycle.
function activate(context) {
  // Clear cache on activation to ensure fresh data after extension updates
  clearFormDescCache();
  
  const selector = { language: 'dips-calc', scheme: '*' };

  // Create command handlers
  const commands = createCommands(vscode, formatFormula, minifyFormula, stripComments);

  // Create completion providers
  const completionProviders = createCompletionProviders(
    vscode,
    selector,
    FUNCTION_ITEMS,
    findFormDescriptionJson,
    getVariablesFromFormDescription
  );

  // Create diagnostics provider
  const diagnostics = createDiagnosticsProvider(
    vscode,
    selector,
    FUNCTION_LOOKUP,
    findFormDescriptionJson,
    getVariablesFromFormDescription,
    validateFunctionCalls,
    detectMissingCommas
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

  const hoverProvider = vscode.languages.registerHoverProvider(
    selector,
    createHoverProvider(vscode, FUNCTION_LOOKUP, findFormDescriptionJson, getVariablesFromFormDescription)
  );

  // Watch for changes to form_description.json files to invalidate cache
  const formDescWatcher = vscode.workspace.createFileSystemWatcher('**/form_description.json');
  formDescWatcher.onDidChange(uri => {
    const folderPath = path.dirname(uri.fsPath);
    invalidateFormDescCache(folderPath);
  });
  formDescWatcher.onDidDelete(uri => {
    const folderPath = path.dirname(uri.fsPath);
    invalidateFormDescCache(folderPath);
  });
  formDescWatcher.onDidCreate(uri => {
    const folderPath = path.dirname(uri.fsPath);
    invalidateFormDescCache(folderPath);
  });

  // Update diagnostics when document opens or changes
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(diagnostics.updateDiagnostics),
    vscode.workspace.onDidChangeTextDocument(event => diagnostics.updateDiagnostics(event.document)),
    vscode.workspace.onDidCloseTextDocument(doc => diagnostics.diagnosticCollection.delete(doc.uri))
  );
  
  // Update diagnostics for all open documents on activation
  vscode.workspace.textDocuments.forEach(diagnostics.updateDiagnostics);

  context.subscriptions.push(
    ...commands,
    ...completionProviders,
    formattingProvider,
    rangeFormattingProvider,
    hoverProvider,
    formDescWatcher,
    diagnostics.diagnosticCollection,
    diagnostics.codeActionProvider
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  _formatFormula: formatFormula,
  _minifyFormula: minifyFormula,
  _stripComments: stripComments,
};
