/**
 * Signature help provider for DIPS Calc expressions.
 * Shows function signatures and parameter information while typing.
 */

/**
 * Create signature help provider.
 * @param {object} vscode - VS Code API
 * @param {Map} FUNCTION_LOOKUP - Function metadata lookup
 * @returns {object} Signature help provider
 */
function createSignatureHelpProvider(vscode, FUNCTION_LOOKUP) {
  return {
    provideSignatureHelp(document, position) {
      const text = document.getText();
      const offset = document.offsetAt(position);
      
      // Find the function call we're currently in
      const result = findCurrentFunctionCall(text, offset);
      if (!result) {
        return null;
      }
      
      const { functionName, argIndex, openParenOffset } = result;
      const funcInfo = FUNCTION_LOOKUP.get(functionName.toUpperCase());
      
      if (!funcInfo) {
        return null;
      }
      
      // Create signature information
      const sigHelp = new vscode.SignatureHelp();
      const sigInfo = new vscode.SignatureInformation(funcInfo.signature, funcInfo.detail);
      
      // Add parameter information
      if (funcInfo.params) {
        for (const param of funcInfo.params) {
          // Handle both object format {name, type, optional} and simple string format
          if (typeof param === 'string') {
            // Custom function format - simple string array
            sigInfo.parameters.push(
              new vscode.ParameterInformation(param)
            );
          } else {
            // Standard function format - object with name, type, optional
            const paramLabel = param.optional ? `[${param.name}]` : param.name;
            const paramDoc = param.type ? `(${param.type})` : '';
            sigInfo.parameters.push(
              new vscode.ParameterInformation(paramLabel, paramDoc)
            );
          }
        }
      }
      
      sigHelp.signatures = [sigInfo];
      sigHelp.activeSignature = 0;
      sigHelp.activeParameter = Math.min(argIndex, sigInfo.parameters.length - 1);
      
      return sigHelp;
    }
  };
}

/**
 * Find the function call context at the given offset.
 * @param {string} text - Document text
 * @param {number} offset - Current cursor offset
 * @returns {{functionName: string, argIndex: number, openParenOffset: number}|null}
 */
function findCurrentFunctionCall(text, offset) {
  let parenDepth = 0;
  let inString = false;
  let stringChar = '';
  let functionStart = -1;
  let openParenOffset = -1;
  let argIndex = 0;
  let currentDepthArgIndex = 0;
  
  // Scan backwards from cursor to find the opening parenthesis
  for (let i = offset - 1; i >= 0; i--) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';
    
    // Handle string literals
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
    
    // Track parenthesis depth
    if (char === ')') {
      parenDepth++;
    } else if (char === '(') {
      if (parenDepth === 0) {
        // Found the opening paren for our function
        openParenOffset = i;
        
        // Find the function name before the paren
        let nameEnd = i - 1;
        while (nameEnd >= 0 && /\s/.test(text[nameEnd])) {
          nameEnd--;
        }
        
        let nameStart = nameEnd;
        while (nameStart >= 0 && /[A-Z0-9_]/i.test(text[nameStart])) {
          nameStart--;
        }
        
        const functionName = text.substring(nameStart + 1, nameEnd + 1);
        if (functionName && /^[A-Z][A-Z0-9_]*$/i.test(functionName)) {
          return {
            functionName,
            argIndex: currentDepthArgIndex,
            openParenOffset
          };
        }
        
        return null;
      }
      parenDepth--;
    } else if (char === ',' && parenDepth === 0) {
      // Count commas at the current depth
      currentDepthArgIndex++;
    }
  }
  
  return null;
}

module.exports = {
  createSignatureHelpProvider
};
