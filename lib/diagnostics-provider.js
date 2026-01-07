/**
 * Diagnostics provider for DIPS Calc expressions.
 * 
 * This module creates the diagnostics system including:
 * - Function call validation
 * - Missing comma detection
 * - Code action provider for quick fixes
 */

const { DIAGNOSTIC_CODES, DIAGNOSTIC_SOURCE } = require('./constants');

/**
 * Create diagnostics provider.
 * @param {vscode} vscode - The VS Code API
 * @param {object} selector - Language selector
 * @param {Map} FUNCTION_LOOKUP - Function metadata map
 * @param {Function} findFormDescriptionJson - Function to find form_description.json
 * @param {Function} getVariablesFromFormDescription - Function to get variables
 * @param {Function} validateFunctionCalls - Function validation
 * @param {Function} detectMissingCommas - Missing comma detection
 * @param {Function} detectMissingDollarSign - Missing $ prefix detection
 * @param {Function} detectUndeclaredVariables - Undeclared variable detection
 * @returns {object} Diagnostics collection and subscriptions
 */
function createDiagnosticsProvider(
  vscode,
  selector,
  FUNCTION_LOOKUP,
  findFormDescriptionJson,
  getVariablesFromFormDescription,
  validateFunctionCalls,
  detectMissingCommas,
  detectMissingDollarSign,
  detectUndeclaredVariables
) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('dips-calc');
  
  /**
   * Update diagnostics for a document.
   */
  function updateDiagnostics(document) {
    if (document.languageId !== 'dips-calc') {
      return;
    }
    
    // Get variables from form_description.json for type inference
    let variables = new Map();
    if (document.uri.scheme === 'file') {
      const formDescPath = findFormDescriptionJson(document.uri.fsPath);
      if (formDescPath) {
        variables = getVariablesFromFormDescription(formDescPath);
      }
    }
    
    const diagnostics = validateFunctionCalls(vscode, document, variables, FUNCTION_LOOKUP);
    
    // Add diagnostics for missing commas
    const missingCommas = detectMissingCommas(vscode, document);
    for (const mc of missingCommas) {
      const diagnostic = new vscode.Diagnostic(
        mc.range,
        'Possible missing comma between arguments',
        vscode.DiagnosticSeverity.Warning
      );
      diagnostic.source = DIAGNOSTIC_SOURCE;
      diagnostic.code = DIAGNOSTIC_CODES.MISSING_COMMA;
      diagnostics.push(diagnostic);
    }
    
    // Add diagnostics for variables missing $ prefix
    const missingDollarSigns = detectMissingDollarSign(vscode, document, variables, FUNCTION_LOOKUP);
    diagnostics.push(...missingDollarSigns);
    
    // Add diagnostics for undeclared variables
    const undeclaredVariables = detectUndeclaredVariables(vscode, document, variables);
    diagnostics.push(...undeclaredVariables);
    
    diagnosticCollection.set(document.uri, diagnostics);
  }
  
  // Code Action provider for quick fixes (missing comma insertion)
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    selector,
    {
      provideCodeActions(document, range, context) {
        const actions = [];
        
        // Collect missing-comma diagnostics
        const diagnosticsToFix = [];
        
        for (const d of context.diagnostics) {
          if (d.code === DIAGNOSTIC_CODES.MISSING_COMMA) {
            diagnosticsToFix.push(d);
          }
        }
        
        // Collect missing-dollar-sign diagnostics
        const missingDollarDiagnostics = [];
        for (const d of context.diagnostics) {
          if (d.code === 'missing-dollar-sign') {
            missingDollarDiagnostics.push(d);
          }
        }
        
        // If none found in context, check diagnostic collection directly
        if (diagnosticsToFix.length === 0) {
          const allDiagnostics = diagnosticCollection.get(document.uri) || [];
          for (const diagnostic of allDiagnostics) {
            if (diagnostic.code === 'missing-comma' && diagnostic.range.contains(range.start)) {
              diagnosticsToFix.push(diagnostic);
            }
          }
        }
        
        for (const diagnostic of diagnosticsToFix) {
          const fix = new vscode.CodeAction(
            'Insert missing comma',
            vscode.CodeActionKind.QuickFix
          );
          fix.edit = new vscode.WorkspaceEdit();
          fix.edit.insert(document.uri, diagnostic.range.start, ',');
          fix.isPreferred = true;
          fix.diagnostics = [diagnostic];
          actions.push(fix);
        }
        
        // Add quick fixes for missing dollar signs
        for (const diagnostic of missingDollarDiagnostics) {
          const varName = document.getText(diagnostic.range);
          const fix = new vscode.CodeAction(
            `Add $ prefix to ${varName}`,
            vscode.CodeActionKind.QuickFix
          );
          fix.edit = new vscode.WorkspaceEdit();
          fix.edit.insert(document.uri, diagnostic.range.start, '$');
          fix.isPreferred = true;
          fix.diagnostics = [diagnostic];
          actions.push(fix);
        }
        
        return actions;
      }
    },
    {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    }
  );
  
  return {
    diagnosticCollection,
    codeActionProvider,
    updateDiagnostics
  };
}

module.exports = {
  createDiagnosticsProvider
};
