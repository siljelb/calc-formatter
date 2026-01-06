const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// Function metadata lives in a separate module for easier maintenance.
const FUNCTION_ITEMS = require('./function-items');
const FUNCTION_LOOKUP = new Map(
  FUNCTION_ITEMS.map(item => [item.name.toUpperCase(), item])
);

// Cache for form_description.json calcId values and their allowed values
const formDescriptionCache = new Map(); // Map<folderPath, { variables: Map<string, VariableInfo>, mtime: number }>

/**
 * @typedef {Object} VariableInfo
 * @property {string} calcId - The variable name
 * @property {string} [name] - The localized name of the field
 * @property {string} [rmType] - The RM type (e.g., DV_DATE_TIME, DV_CODED_TEXT)
 * @property {Array<{value: string, label: string}>} [values] - Allowed values from inputs.list
 */

/**
 * Recursively extract all calcId values and their associated input values from a form_description.json structure.
 * @param {any} obj - The JSON object to traverse
 * @param {Map<string, VariableInfo>} variables - Map to collect variable info
 */
function extractVariables(obj, variables) {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach(item => extractVariables(item, variables));
    return;
  }

  // Check for calcId in annotations
  const calcId = obj.viewConfig?.annotations?.calcId || obj.annotations?.calcId;
  if (calcId) {
    // Determine the actual data type:
    // - For GENERIC_FIELD elements, the data type is in viewConfig.field.type
    // - For other elements, use rmType directly
    let dataType = obj.rmType || null;
    if (obj.rmType === 'GENERIC_FIELD' && obj.viewConfig?.field?.type) {
      dataType = obj.viewConfig.field.type;
    }
    
    const variableInfo = {
      calcId,
      name: obj.localizedName || obj.name || calcId,
      rmType: dataType,
      values: []
    };

    // Extract values from inputs array
    if (Array.isArray(obj.inputs)) {
      for (const input of obj.inputs) {
        if (Array.isArray(input.list)) {
          for (const listItem of input.list) {
            if (listItem.value) {
              variableInfo.values.push({
                value: listItem.value,
                label: listItem.label || listItem.localizedLabels?.nb || listItem.localizedLabels?.en || listItem.value
              });
            }
          }
        }
      }
    }

    variables.set(calcId, variableInfo);
  }

  // Recurse into all object properties, but skip viewConfig since we already extracted from it
  for (const key of Object.keys(obj)) {
    if (key === 'viewConfig') {
      continue; // Skip viewConfig to avoid duplicate extraction
    }
    extractVariables(obj[key], variables);
  }
}

/**
 * Find form_description.json in the same folder or immediate parent folder of the given file.
 * Only checks these two locations to avoid picking up unrelated form_description.json files.
 * @param {string} filePath - Path to the current .calc file
 * @returns {string|null} - Path to form_description.json or null if not found
 */
function findFormDescriptionJson(filePath) {
  const dir = path.dirname(filePath);
  
  // Check same folder first
  const sameFolder = path.join(dir, 'form_description.json');
  if (fs.existsSync(sameFolder)) {
    return sameFolder;
  }
  
  // Check immediate parent folder
  const parentDir = path.dirname(dir);
  if (parentDir && parentDir !== dir) {
    const parentFolder = path.join(parentDir, 'form_description.json');
    if (fs.existsSync(parentFolder)) {
      return parentFolder;
    }
  }

  return null;
}

/**
 * Get variables from form_description.json, using cache when possible.
 * @param {string} formDescPath - Path to form_description.json
 * @returns {Map<string, VariableInfo>} - Map of calcId to variable info
 */
function getVariablesFromFormDescription(formDescPath) {
  try {
    const stats = fs.statSync(formDescPath);
    const mtime = stats.mtimeMs;
    const folderPath = path.dirname(formDescPath);

    // Check cache - but only use if it has values extracted (for migration from old cache format)
    const cached = formDescriptionCache.get(folderPath);
    if (cached && cached.mtime === mtime) {
      // Check if any variable has values - if not, force re-parse (migration from old format)
      let hasValues = false;
      for (const [, varInfo] of cached.variables) {
        if (varInfo.values && varInfo.values.length > 0) {
          hasValues = true;
          break;
        }
      }
      if (hasValues) {
        return cached.variables;
      }
    }

    // Parse and extract
    const content = fs.readFileSync(formDescPath, 'utf8');
    const json = JSON.parse(content);
    const variables = new Map();
    extractVariables(json, variables);

    // Update cache
    formDescriptionCache.set(folderPath, { variables, mtime });

    return variables;
  } catch (error) {
    console.error(`Error reading form_description.json: ${error.message}`);
    return new Map();
  }
}

// Entry point for the VS Code extension lifecycle.
function activate(context) {
  // Clear cache on activation to ensure fresh data after extension updates
  formDescriptionCache.clear();
  
  const selector = { language: 'dips-calc', scheme: '*' };

  // Command to wrap the expression after the cursor into the function call
  // This is called via completion item's command property after insertion
  const wrapExpressionCommand = vscode.commands.registerCommand('dips-calc.wrapExpression', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    
    const document = editor.document;
    const position = editor.selection.active;
    const line = document.lineAt(position.line).text;
    
    // We expect cursor to be inside empty parens: FUNC(|)
    // Check if we're inside ()
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
    
    // Now perform the edit:
    // 1. Delete the expression from after the )
    // 2. Insert it inside the ()
    const exprStartPos = new vscode.Position(position.line, position.character + 1);
    const exprEndPos = new vscode.Position(position.line, position.character + 1 + expressionLength);
    
    await editor.edit(editBuilder => {
      // Delete the expression from after the paren
      editBuilder.delete(new vscode.Range(exprStartPos, exprEndPos));
      // Insert it at the cursor position (inside the parens)
      editBuilder.insert(position, expressionToWrap);
    });
    
    // Move cursor to after the closing paren
    const newCursorPos = new vscode.Position(position.line, position.character + expressionToWrap.length + 1);
    editor.selection = new vscode.Selection(newCursorPos, newCursorPos);
  });

  // Autocomplete provider built from FUNCTION_ITEMS above.
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    selector,
    {
      provideCompletionItems(document, position) {
        const lineText = document.lineAt(position.line).text;
        const linePrefix = lineText.substring(0, position.character);
        const lineSuffix = lineText.substring(position.character);
        
        // Don't provide function completions if user already typed opening parenthesis
        if (linePrefix.match(/[A-Za-z_][A-Za-z0-9_]*\s*\($/)) {
          return [];
        }
        
        // Don't provide function completions if we're typing a variable (after $)
        if (linePrefix.match(/\$[A-Za-z0-9_.\/]*$/)) {
          return [];
        }
        
        // Find the word prefix that the user is typing (for setting the replace range)
        const wordPrefixMatch = linePrefix.match(/([A-Za-z_][A-Za-z0-9_]*)$/);
        const wordPrefix = wordPrefixMatch ? wordPrefixMatch[1] : '';
        const replaceStartPos = new vscode.Position(position.line, position.character - wordPrefix.length);
        
        // Check if there's an expression immediately after the cursor that we should wrap
        // This matches: $variable, $variable/path, FUNCTION(...), identifier, or number
        let expressionToWrap = null;
        let expressionEndPos = position;
        
        // Match variable: $name or $name/path
        const varMatch = lineSuffix.match(/^(\$[A-Za-z_][A-Za-z0-9_]*(?:\/[A-Za-z_][A-Za-z0-9_]*)*)/);
        if (varMatch) {
          expressionToWrap = varMatch[1];
          expressionEndPos = new vscode.Position(position.line, position.character + varMatch[1].length);
        }
        
        // Match function call: FUNC(...) - need to find matching closing paren
        if (!expressionToWrap) {
          const funcStartMatch = lineSuffix.match(/^([A-Z][A-Z0-9_]*)\s*\(/i);
          if (funcStartMatch) {
            // Find the matching closing parenthesis
            let depth = 1;
            let i = funcStartMatch[0].length;
            let inString = false;
            let stringChar = '';
            
            while (i < lineSuffix.length && depth > 0) {
              const char = lineSuffix[i];
              const prevChar = i > 0 ? lineSuffix[i - 1] : '';
              
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
              expressionToWrap = lineSuffix.substring(0, i);
              expressionEndPos = new vscode.Position(position.line, position.character + i);
            }
          }
        }
        
        // Match number
        if (!expressionToWrap) {
          const numMatch = lineSuffix.match(/^(\d+\.?\d*)/);
          if (numMatch) {
            expressionToWrap = numMatch[1];
            expressionEndPos = new vscode.Position(position.line, position.character + numMatch[1].length);
          }
        }
        
        // Match identifier (but not if followed by opening paren - that's a function call handled above)
        if (!expressionToWrap) {
          const idMatch = lineSuffix.match(/^([A-Za-z_][A-Za-z0-9_]*)(?!\s*\()/);
          if (idMatch) {
            expressionToWrap = idMatch[1];
            expressionEndPos = new vscode.Position(position.line, position.character + idMatch[1].length);
          }
        }
        
        const items = FUNCTION_ITEMS.map(fn => {
          const item = new vscode.CompletionItem(fn.name, vscode.CompletionItemKind.Function);
          item.detail = fn.signature;
          item.documentation = fn.detail;
          
          // Check if function takes arguments by looking at signature
          // Functions without args have "()" directly, functions with args have something inside
          const hasArgs = !fn.signature.match(/\(\s*\)$/);
          
          // Use filterText to control what the user types to match this completion
          item.filterText = fn.name;
          
          if (expressionToWrap && hasArgs) {
            // Use a post-completion command to wrap the expression
            // The completion inserts FUNC() with cursor inside parens via $0
            // Then the command detects the expression after ) and moves it inside
            item.range = new vscode.Range(replaceStartPos, position);
            item.insertText = new vscode.SnippetString(`${fn.name}($0)`);
            item.command = {
              command: 'dips-calc.wrapExpression',
              title: 'Wrap Expression'
            };
          } else if (hasArgs) {
            // No wrapping - just replace the typed prefix
            item.range = new vscode.Range(replaceStartPos, position);
            // Place cursor inside parentheses: FUNC(|)
            item.insertText = new vscode.SnippetString(`${fn.name}($0)`);
          } else {
            // No args - just replace the typed prefix
            item.range = new vscode.Range(replaceStartPos, position);
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
        
        // Check if we're typing a variable (after $)
        // Variables can be like: $name, $name.subname, $name/value, $name/value/path
        const variableMatch = linePrefix.match(/\$([A-Za-z0-9_.\/]*)$/);
        if (!variableMatch) {
          return [];
        }

        // Map rmType to a short display name (matching icon file names where available)
        // Icons exist for: boolean, coded_text, count, datetime, duration, ordinal, proportion, quantity, text
        const typeDisplayNames = {
          'DV_BOOLEAN': 'Boolean',
          'DV_CODED_TEXT': 'Coded Text',
          'DV_COUNT': 'Count',
          'DV_DATE_TIME': 'DateTime',
          'DV_DATE': 'Date',
          'DV_TIME': 'Time',
          'DV_DURATION': 'Duration',
          'DV_EHR_URI': 'EHR URI',
          'DV_URI': 'URI',
          'DV_MULTIMEDIA': 'Multimedia',
          'DV_PARSABLE': 'Parsable',
          'DV_ORDINAL': 'Ordinal',
          'DV_PROPORTION': 'Proportion',
          'DV_QUANTITY': 'Quantity',
          'DV_TEXT': 'Text',
          'DV_IDENTIFIER': 'Identifier',
          'DV_SCALE': 'Scale',
        };

        // Map rmType to CompletionItemKind for appropriate icons
        const typeToKind = {
          'DV_BOOLEAN': vscode.CompletionItemKind.Value,
          'DV_CODED_TEXT': vscode.CompletionItemKind.EnumMember,
          'DV_COUNT': vscode.CompletionItemKind.Value,
          'DV_DATE_TIME': vscode.CompletionItemKind.Value,
          'DV_DATE': vscode.CompletionItemKind.Value,
          'DV_TIME': vscode.CompletionItemKind.Value,
          'DV_DURATION': vscode.CompletionItemKind.Value,
          'DV_EHR_URI': vscode.CompletionItemKind.Reference,
          'DV_URI': vscode.CompletionItemKind.Reference,
          'DV_MULTIMEDIA': vscode.CompletionItemKind.File,
          'DV_PARSABLE': vscode.CompletionItemKind.Struct,
          'DV_ORDINAL': vscode.CompletionItemKind.EnumMember,
          'DV_PROPORTION': vscode.CompletionItemKind.Value,
          'DV_QUANTITY': vscode.CompletionItemKind.Unit,
          'DV_TEXT': vscode.CompletionItemKind.Text,
          'DV_IDENTIFIER': vscode.CompletionItemKind.Constant,
          'DV_SCALE': vscode.CompletionItemKind.EnumMember,
        };

        const items = [];
        const seenVariables = new Set();

        // 1. Get variables from form_description.json if available
        if (document.uri.scheme === 'file') {
          const formDescPath = findFormDescriptionJson(document.uri.fsPath);
          if (formDescPath) {
            const variables = getVariablesFromFormDescription(formDescPath);
            for (const [calcId, varInfo] of variables) {
              const varName = '$' + calcId;
              if (!seenVariables.has(varName)) {
                seenVariables.add(varName);
                
                // Get type display name and completion item kind
                const typeDisplay = typeDisplayNames[varInfo.rmType] || varInfo.rmType || 'Unknown';
                const itemKind = typeToKind[varInfo.rmType] || vscode.CompletionItemKind.Variable;
                
                const item = new vscode.CompletionItem(calcId, itemKind);
                // Show type name in the completion list description
                item.label = {
                  label: calcId,
                  description: typeDisplay
                };
                item.detail = `${varInfo.name} (${varInfo.rmType || 'Unknown type'})`;
                
                // Build documentation with field name and allowed values
                let docText = `**${varInfo.name}**\n\nType: \`${varInfo.rmType || 'Unknown'}\`\n\nField with \`calcId: "${calcId}"\``;
                if (varInfo.values && varInfo.values.length > 0) {
                  docText += `\n\n**Allowed values:**\n`;
                  for (const v of varInfo.values) {
                    docText += `- \`"${v.value}"\` - ${v.label}\n`;
                  }
                }
                item.documentation = new vscode.MarkdownString(docText);
                item.sortText = '0' + calcId; // Sort form_description variables first
                items.push(item);
              }
            }
          }
        }

        // 2. Scan the current document for additional variables
        // Variables can be like: $name, $name.subname, $name/value, $name/value/path
        const text = document.getText();
        const variableRegex = /\$([A-Za-z_][A-Za-z0-9_]*(?:[.\/][A-Za-z_][A-Za-z0-9_]*)*)/g;
        
        let match;
        while ((match = variableRegex.exec(text)) !== null) {
          const calcId = match[1]; // Just the name without $
          const varName = '$' + calcId;
          if (!seenVariables.has(varName)) {
            seenVariables.add(varName);
            const item = new vscode.CompletionItem(calcId, vscode.CompletionItemKind.Variable);
            item.detail = 'Variable (from document)';
            item.sortText = '1' + calcId; // Sort document variables after form_description
            items.push(item);
          }
        }

        return items;
      }
    },
    '$' // Trigger on $ character
  );

  // Variable value completion provider - triggers on '"' after $variableName = 
  const valueCompletionProvider = vscode.languages.registerCompletionItemProvider(
    selector,
    {
      provideCompletionItems(document, position) {
        const lineText = document.lineAt(position.line).text;
        const linePrefix = lineText.substring(0, position.character);
        
        // Check if we're in a pattern like: $variableName = " or $variableName = '
        // Also match patterns like: $var = " or $var <> " or $var="
        // Variables can have /value suffix like $operasjonsDato/value
        const valueMatch = linePrefix.match(/\$([A-Za-z_][A-Za-z0-9_]*(?:[.\/][A-Za-z_][A-Za-z0-9_]*)*)\s*(?:=|<>)\s*["']?$/);
        
        if (!valueMatch) {
          return [];
        }

        const variableName = valueMatch[1];
        // Extract base variable name (without /value or .subpath suffix) for lookup
        const baseVariableName = variableName.split(/[.\/]/)[0];
        
        // Get variables from form_description.json
        if (document.uri.scheme !== 'file') {
          return [];
        }
        
        const formDescPath = findFormDescriptionJson(document.uri.fsPath);
        if (!formDescPath) {
          return [];
        }

        const variables = getVariablesFromFormDescription(formDescPath);
        const varInfo = variables.get(baseVariableName);
        
        if (!varInfo || !varInfo.values || varInfo.values.length === 0) {
          return [];
        }

        // Check if user already typed the opening quote
        const hasOpeningQuote = linePrefix.match(/["']$/);

        const items = varInfo.values.map((v, index) => {
          // Show both value and label in the completion list
          const item = new vscode.CompletionItem(v.value, vscode.CompletionItemKind.EnumMember);
          item.label = {
            label: v.value,
            description: v.label
          };
          item.detail = v.label;
          item.documentation = new vscode.MarkdownString(`Value for **${varInfo.name}**\n\n\`"${v.value}"\` = ${v.label}`);
          item.sortText = String(index).padStart(3, '0'); // Keep original order
          
          // If user already typed the opening quote, just insert the value (without quotes)
          // VS Code may auto-insert the closing quote, so we don't add it
          if (hasOpeningQuote) {
            item.insertText = v.value;
          } else {
            item.insertText = '"' + v.value + '"';
          }
          
          return item;
        });

        return items;
      }
    },
    '"', "'" // Trigger on quote characters
  );

  // Path completion provider - triggers on '/' after a variable name to suggest paths like /value, /magnitude
  const pathCompletionProvider = vscode.languages.registerCompletionItemProvider(
    selector,
    {
      provideCompletionItems(document, position) {
        const lineText = document.lineAt(position.line).text;
        const linePrefix = lineText.substring(0, position.character);
        
        // Check if we're in a variable path context
        // Match $variableName/ or $variableName/partial_path/
        const pathMatch = linePrefix.match(/\$([A-Za-z_][A-Za-z0-9_]*)((?:\/[A-Za-z_][A-Za-z0-9_]*)*)\/([A-Za-z_]*)$/);
        if (!pathMatch) {
          return [];
        }

        const variableName = pathMatch[1];
        const existingPath = pathMatch[2]; // e.g., "" or "/defining_code"
        const typedSegment = pathMatch[3]; // What user has typed after the last /
        
        // Get variables from form_description.json
        if (document.uri.scheme !== 'file') {
          return [];
        }
        
        const formDescPath = findFormDescriptionJson(document.uri.fsPath);
        if (!formDescPath) {
          return [];
        }

        const variables = getVariablesFromFormDescription(formDescPath);
        const varInfo = variables.get(variableName);
        
        if (!varInfo) {
          return [];
        }

        // Define path suggestions based on rmType
        const pathsByType = {
          'DV_BOOLEAN': [
            { path: 'value', detail: 'Boolean value (true/false)' },
          ],
          'DV_CODED_TEXT': [
            { path: 'defining_code/code_string', detail: 'Code value (e.g., at0009)' },
            { path: 'value', detail: 'Display text' },
            { path: 'defining_code/terminology_id/value', detail: 'Terminology ID' },
          ],
          'DV_COUNT': [
            { path: 'magnitude', detail: 'Integer count value' },
          ],
          'DV_DATE_TIME': [
            { path: 'value', detail: 'ISO 8601 date/time string' },
          ],
          'DV_DATE': [
            { path: 'value', detail: 'ISO 8601 date string' },
          ],
          'DV_TIME': [
            { path: 'value', detail: 'ISO 8601 time string' },
          ],
          'DV_DURATION': [
            { path: 'value', detail: 'ISO 8601 duration string' },
          ],
          'DV_EHR_URI': [
            { path: 'value', detail: 'EHR URI value' },
          ],
          'DV_URI': [
            { path: 'value', detail: 'URI value' },
          ],
          'DV_MULTIMEDIA': [
            { path: 'value', detail: 'Multimedia content' },
            { path: 'size', detail: 'Size of the content' },
          ],
          'DV_PARSABLE': [
            { path: 'value', detail: 'Parsable content' },
            { path: 'size', detail: 'Size of the content' },
          ],
          'DV_ORDINAL': [
            { path: 'value', detail: 'Ordinal integer value' },
            { path: 'symbol/value', detail: 'Display symbol text' },
            { path: 'symbol/defining_code/code_string', detail: 'Symbol code string' },
            { path: 'symbol/defining_code/terminology_id/value', detail: 'Symbol terminology ID' },
          ],
          'DV_PROPORTION': [
            { path: 'numerator', detail: 'Numerator value' },
            { path: 'denominator', detail: 'Denominator value' },
          ],
          'DV_QUANTITY': [
            { path: 'magnitude', detail: 'Numeric value' },
            { path: 'units', detail: 'Unit string' },
          ],
          'DV_TEXT': [
            { path: 'value', detail: 'Text content' },
          ],
          'DV_IDENTIFIER': [
            { path: 'issuer', detail: 'Issuer of the identifier' },
            { path: 'assigner', detail: 'Assigner of the identifier' },
            { path: 'id', detail: 'Identifier value' },
            { path: 'type', detail: 'Type of identifier' },
          ],
          'DV_SCALE': [
            { path: 'value', detail: 'Scale value' },
            { path: 'symbol/value', detail: 'Display symbol text' },
            { path: 'symbol/defining_code/code_string', detail: 'Symbol code string' },
            { path: 'symbol/defining_code/terminology_id/value', detail: 'Symbol terminology ID' },
          ],
        };

        // Get paths for this type, or provide generic paths
        const rmType = varInfo.rmType || '';
        let availablePaths = pathsByType[rmType];
        
        if (!availablePaths) {
          // Generic fallback paths
          availablePaths = [
            { path: 'value', detail: 'The primary value' },
          ];
        }

        // Filter paths based on what's already typed
        // existingPath is like "" or "/defining_code", we need to strip the leading /
        const currentPrefix = existingPath ? existingPath.substring(1) + '/' : '';
        
        // Filter to only show paths that start with the current prefix
        // and extract the next segment to complete
        const matchingPaths = [];
        const seenNextSegments = new Set();
        
        for (const p of availablePaths) {
          if (p.path.startsWith(currentPrefix)) {
            // Get the remaining path after the prefix
            const remaining = p.path.substring(currentPrefix.length);
            // Get the next segment (up to the next / or end)
            const nextSlash = remaining.indexOf('/');
            const nextSegment = nextSlash >= 0 ? remaining.substring(0, nextSlash) : remaining;
            
            if (nextSegment && !seenNextSegments.has(nextSegment)) {
              seenNextSegments.add(nextSegment);
              const isComplete = nextSlash < 0; // This is a complete path
              matchingPaths.push({
                segment: nextSegment,
                fullPath: currentPrefix + (nextSlash >= 0 ? remaining.substring(0, nextSlash) : remaining),
                detail: isComplete ? p.detail : `Continue path...`,
                isComplete
              });
            }
          }
        }

        const items = matchingPaths.map((p, index) => {
          const item = new vscode.CompletionItem(p.segment, vscode.CompletionItemKind.Property);
          item.detail = p.detail;
          item.documentation = new vscode.MarkdownString(
            `Path for **${varInfo.name}** (${rmType || 'unknown type'})\n\n\`$${variableName}/${p.fullPath}\``
          );
          item.sortText = String(index).padStart(3, '0');
          // Insert just the segment
          item.insertText = p.segment;
          return item;
        });

        return items;
      }
    },
    '/' // Trigger on / character
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

      // Check if this word is part of a variable path (preceded by $ or /)
      const startPos = wordRange.start;
      let isVariable = false;
      let varRange = wordRange;
      
      if (startPos.character > 0) {
        const charBefore = document.getText(new vscode.Range(
          new vscode.Position(startPos.line, startPos.character - 1),
          startPos
        ));
        if (charBefore === '$' || charBefore === '/') {
          isVariable = true;
          // Extend range to include the $ or /
          varRange = new vscode.Range(
            new vscode.Position(startPos.line, startPos.character - 1),
            wordRange.end
          );
        }
      }

      // If it's a variable, try to show variable info
      if (isVariable) {
        const formDescPath = findFormDescriptionJson(document.uri.fsPath);
        
        if (formDescPath) {
          const variables = getVariablesFromFormDescription(formDescPath);
          
          // Get the full variable path including any suffixes
          // Look backwards from the $ to get the base variable name
          // Then look forwards to get any path suffixes like /value
          const line = document.lineAt(position.line).text;
          const dollarIndex = line.lastIndexOf('$', position.character);
          
          if (dollarIndex !== -1) {
            // Extract the full path: $varName/path/suffix
            const pathMatch = line.substring(dollarIndex).match(/^\$([A-Za-z_][A-Za-z0-9_.]*)([\/A-Za-z_][A-Za-z0-9_./]*)?/);
            
            if (pathMatch) {
              const baseVarName = pathMatch[1];
              const pathSuffix = pathMatch[2] || '';
              const fullPath = '$' + baseVarName + pathSuffix;
              
              const varInfo = variables.get(baseVarName);
              
              if (varInfo) {
                const markdown = new vscode.MarkdownString();
                markdown.appendMarkdown(`**${varInfo.name}**\n\n`);
                
                // Determine the actual type based on rmType and path suffix
                let displayType = varInfo.rmType;
                let typeDescription = null;
                
                if (pathSuffix === '/value') {
                  // The /value path returns the actual value type
                  const valueTypeMapping = {
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
                  displayType = valueTypeMapping[varInfo.rmType] || varInfo.rmType;
                  typeDescription = 'value';
                } else if (pathSuffix === '/magnitude') {
                  displayType = 'number';
                  typeDescription = 'magnitude';
                } else if (pathSuffix === '/units') {
                  displayType = 'text';
                  typeDescription = 'units';
                } else if (pathSuffix === '/numerator') {
                  displayType = 'number';
                  typeDescription = 'numerator';
                } else if (pathSuffix === '/denominator') {
                  displayType = 'number';
                  typeDescription = 'denominator';
                } else if (pathSuffix === '/symbol') {
                  displayType = 'integer';
                  typeDescription = 'symbol (ordinal value)';
                } else if (pathSuffix.startsWith('/defining_code')) {
                  displayType = 'code';
                  typeDescription = 'terminology code';
                }
                
                if (varInfo.rmType) {
                  if (typeDescription) {
                    markdown.appendMarkdown(`*Type:* \`${displayType}\` (${typeDescription} of \`${varInfo.rmType}\`)\n\n`);
                  } else {
                    markdown.appendMarkdown(`*Type:* \`${displayType}\`\n\n`);
                  }
                }
                
                markdown.appendMarkdown(`*Variable:* \`${fullPath}\`\n\n`);
                
                if (varInfo.values && varInfo.values.length > 0) {
                  markdown.appendMarkdown('**Allowed values:**\n\n');
                  const maxDisplay = 10;
                  const displayValues = varInfo.values.slice(0, maxDisplay);
                  for (const val of displayValues) {
                    markdown.appendMarkdown(`- \`${val.value}\` — ${val.label}\n`);
                  }
                  if (varInfo.values.length > maxDisplay) {
                    markdown.appendMarkdown(`\n*...and ${varInfo.values.length - maxDisplay} more*\n`);
                  }
                }
                
                return new vscode.Hover(markdown, varRange);
              }
            }
          }
        }
        
        // If no variable info found, return null so no hover is shown
        return null;
      }

      // Not a variable, check if it's a function
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

  // Watch for changes to form_description.json files to invalidate cache
  const formDescWatcher = vscode.workspace.createFileSystemWatcher('**/form_description.json');
  formDescWatcher.onDidChange(uri => {
    const folderPath = path.dirname(uri.fsPath);
    formDescriptionCache.delete(folderPath);
  });
  formDescWatcher.onDidDelete(uri => {
    const folderPath = path.dirname(uri.fsPath);
    formDescriptionCache.delete(folderPath);
  });
  formDescWatcher.onDidCreate(uri => {
    const folderPath = path.dirname(uri.fsPath);
    formDescriptionCache.delete(folderPath);
  });

  // Diagnostics collection for function parameter validation
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('dips-calc');
  
  /**
   * Validate ISO8601 date, datetime, time, or duration string.
   * @param {string} str - The string to validate (with quotes)
   * @returns {{valid: boolean, type: string|null, message: string|null}}
   */
  function validateISO8601String(str) {
    const trimmed = str.trim();
    if (!trimmed.startsWith('"') && !trimmed.startsWith("'")) {
      return { valid: true, type: null, message: null };
    }
    
    const content = trimmed.slice(1, -1);
    
    // ISO8601 datetime: YYYY-MM-DDTHH:MM:SS[.mmm][±HH:MM|Z]
    const datetimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/;
    const datetimeMatch = content.match(datetimePattern);
    if (datetimeMatch) {
      const [, year, month, day, hour, minute, second] = datetimeMatch;
      const y = parseInt(year), m = parseInt(month), d = parseInt(day);
      const h = parseInt(hour), min = parseInt(minute), s = parseInt(second);
      
      if (m < 1 || m > 12) {
        return { valid: false, type: 'iso8601_datetime', message: `Invalid month: ${m} (must be 01-12)` };
      }
      if (d < 1 || d > 31) {
        return { valid: false, type: 'iso8601_datetime', message: `Invalid day: ${d} (must be 01-31)` };
      }
      if (h > 23) {
        return { valid: false, type: 'iso8601_datetime', message: `Invalid hour: ${h} (must be 00-23)` };
      }
      if (min > 59) {
        return { valid: false, type: 'iso8601_datetime', message: `Invalid minute: ${min} (must be 00-59)` };
      }
      if (s > 59) {
        return { valid: false, type: 'iso8601_datetime', message: `Invalid second: ${s} (must be 00-59)` };
      }
      return { valid: true, type: 'iso8601_datetime', message: null };
    }
    
    // ISO8601 date: YYYY-MM-DD
    const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
    const dateMatch = content.match(datePattern);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      const y = parseInt(year), m = parseInt(month), d = parseInt(day);
      
      if (m < 1 || m > 12) {
        return { valid: false, type: 'iso8601_date', message: `Invalid month: ${m} (must be 01-12)` };
      }
      if (d < 1 || d > 31) {
        return { valid: false, type: 'iso8601_date', message: `Invalid day: ${d} (must be 01-31)` };
      }
      return { valid: true, type: 'iso8601_date', message: null };
    }
    
    // ISO8601 time: HH:MM:SS[.mmm][±HH:MM|Z]
    const timePattern = /^(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/;
    const timeMatch = content.match(timePattern);
    if (timeMatch) {
      const [, hour, minute, second] = timeMatch;
      const h = parseInt(hour), min = parseInt(minute), s = parseInt(second);
      
      if (h > 23) {
        return { valid: false, type: 'iso8601_time', message: `Invalid hour: ${h} (must be 00-23)` };
      }
      if (min > 59) {
        return { valid: false, type: 'iso8601_time', message: `Invalid minute: ${min} (must be 00-59)` };
      }
      if (s > 59) {
        return { valid: false, type: 'iso8601_time', message: `Invalid second: ${s} (must be 00-59)` };
      }
      return { valid: true, type: 'iso8601_time', message: null };
    }
    
    // ISO8601 duration: P[nY][nM][nD][T[nH][nM][nS]]
    const durationPattern = /^P(?:(\d+(?:\.\d+)?Y)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?W)?(\d+(?:\.\d+)?D)?)?(?:T(?:(\d+(?:\.\d+)?H)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?S)?)?)?$/;
    const durationMatch = content.match(durationPattern);
    if (durationMatch && content.startsWith('P')) {
      // Check that at least one component exists
      const hasComponents = durationMatch.slice(1).some(component => component !== undefined);
      if (!hasComponents) {
        return { valid: false, type: 'iso8601_duration', message: 'Duration must have at least one time component (e.g., P1D, PT1H)' };
      }
      return { valid: true, type: 'iso8601_duration', message: null };
    }
    
    // Check if it looks like an attempted ISO8601 format
    // Date/datetime patterns
    if (/\d{4}-\d{2}/.test(content)) {
      return { valid: false, type: 'unknown', message: 'Invalid ISO 8601 date/datetime format' };
    }
    // Time patterns
    if (/\d{2}:\d{2}/.test(content)) {
      return { valid: false, type: 'unknown', message: 'Invalid ISO 8601 time format' };
    }
    // Duration patterns - check for P followed by duration components
    if (content.startsWith('P') || /P\d+[YMWDTHS]/.test(content)) {
      return { valid: false, type: 'unknown', message: 'Invalid ISO 8601 duration format' };
    }
    
    return { valid: true, type: null, message: null };
  }
  
  /**
   * Count function arguments, handling nested parentheses and strings correctly.
   * @param {string} argsString - The string inside the function parentheses
   * @returns {number} - Number of arguments (0 for empty, otherwise count commas at depth 0 + 1)
   */
  function countFunctionArguments(argsString) {
    const trimmed = argsString.trim();
    if (trimmed === '') {
      return 0;
    }
    
    let depth = 0;
    let inString = false;
    let stringChar = '';
    let argCount = 1;
    
    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      const prevChar = i > 0 ? trimmed[i - 1] : '';
      
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
      
      // Track nested parentheses
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
      } else if (char === ',' && depth === 0) {
        argCount++;
      }
    }
    
    return argCount;
  }

  /**
   * Extract individual arguments from an arguments string.
   * @param {string} argsString - The string inside the function parentheses
   * @returns {Array<{text: string, start: number, end: number}>} - Array of argument info
   */
  function extractFunctionArguments(argsString) {
    const trimmed = argsString.trim();
    if (trimmed === '') {
      return [];
    }
    
    const args = [];
    let depth = 0;
    let inString = false;
    let stringChar = '';
    let argStart = 0;
    
    for (let i = 0; i <= trimmed.length; i++) {
      const char = i < trimmed.length ? trimmed[i] : ','; // Treat end as comma
      const prevChar = i > 0 ? trimmed[i - 1] : '';
      
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
      
      // Track nested parentheses
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
      } else if ((char === ',' && depth === 0) || i === trimmed.length) {
        const argText = trimmed.substring(argStart, i).trim();
        args.push({
          text: argText,
          start: argStart,
          end: i
        });
        argStart = i + 1;
      }
    }
    
    return args;
  }

  /**
   * Type compatibility rules - which types can be used where another is expected.
   */
  const TYPE_COMPATIBILITY = {
    // number accepts: number, integer
    'number': ['number', 'integer', 'any'],
    // integer accepts: integer only
    'integer': ['integer', 'number', 'any'],
    // text accepts: text, iso8601_datetime, iso8601_date, iso8601_time, iso8601_duration
    'text': ['text', 'iso8601_datetime', 'iso8601_date', 'iso8601_time', 'iso8601_duration', 'any'],
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
   * @returns {{type: string|null, confidence: 'high'|'medium'|'low'}}
   */
  function inferExpressionType(expr, variables) {
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
        const rmTypeMapping = {
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
        const mappedType = rmTypeMapping[varInfo.rmType];
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
    if (funcMatch) {
      const funcName = funcMatch[1].toUpperCase();
      const funcInfo = FUNCTION_LOOKUP.get(funcName);
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
  
  /**
   * Parse function calls from document text and validate arguments.
   * @param {vscode.TextDocument} document 
   * @param {Map<string, VariableInfo>} variables - Variables from form_description.json
   * @returns {vscode.Diagnostic[]}
   */
  function validateFunctionCalls(document, variables) {
    const text = document.getText();
    const diagnostics = [];
    
    // Match function calls: FUNCTIONNAME(...)
    // This regex finds function names followed by opening parenthesis
    const functionCallRegex = /\b([A-Z][A-Z0-9_]*)\s*\(/gi;
    
    let match;
    while ((match = functionCallRegex.exec(text)) !== null) {
      const funcName = match[1].toUpperCase();
      const funcInfo = FUNCTION_LOOKUP.get(funcName);
      
      // Find the matching closing parenthesis first (needed for both known and unknown functions)
      const openParenIndex = match.index + match[0].length - 1;
      let depth = 1;
      let closeParenIndex = -1;
      let inString = false;
      let stringChar = '';
      
      for (let i = openParenIndex + 1; i < text.length && depth > 0; i++) {
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
        
        if (char === '(') {
          depth++;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            closeParenIndex = i;
          }
        }
      }
      
      if (!funcInfo) {
        // Unknown function - add warning
        // Only warn if closing paren was found (valid function call syntax)
        if (closeParenIndex !== -1) {
          const startPos = document.positionAt(match.index);
          const endPos = document.positionAt(closeParenIndex + 1);
          const range = new vscode.Range(startPos, endPos);
          
          const diagnostic = new vscode.Diagnostic(
            range,
            `Unknown function: ${match[1]}`,
            vscode.DiagnosticSeverity.Warning
          );
          diagnostic.source = 'dips-calc';
          diagnostic.code = 'unknown-function';
          diagnostics.push(diagnostic);
        }
        continue;
      }
      
      if (closeParenIndex === -1) {
        // Unclosed parenthesis - skip this function call
        continue;
      }
      
      // Extract arguments string
      const argsString = text.substring(openParenIndex + 1, closeParenIndex);
      const argCount = countFunctionArguments(argsString);
      
      // Validate argument count
      // maxArgs can be a number or '*' for unlimited
      const minArgs = funcInfo.minArgs !== undefined ? funcInfo.minArgs : 0;
      const maxArgs = funcInfo.maxArgs;
      const isVariadic = maxArgs === '*';
      
      let message = null;
      let severity = vscode.DiagnosticSeverity.Error;
      
      if (argCount < minArgs) {
        if (!isVariadic && minArgs === maxArgs) {
          message = `${funcName} expects exactly ${minArgs} argument${minArgs !== 1 ? 's' : ''}, but got ${argCount}`;
        } else {
          message = `${funcName} expects at least ${minArgs} argument${minArgs !== 1 ? 's' : ''}, but got ${argCount}`;
        }
      } else if (!isVariadic && argCount > maxArgs) {
        if (minArgs === maxArgs) {
          message = `${funcName} expects exactly ${maxArgs} argument${maxArgs !== 1 ? 's' : ''}, but got ${argCount}`;
        } else {
          message = `${funcName} expects at most ${maxArgs} argument${maxArgs !== 1 ? 's' : ''}, but got ${argCount}`;
        }
      }
      
      if (message) {
        // Create range for the function call (from function name to closing paren)
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(closeParenIndex + 1);
        const range = new vscode.Range(startPos, endPos);
        
        const diagnostic = new vscode.Diagnostic(range, message, severity);
        diagnostic.source = 'dips-calc';
        diagnostic.code = 'invalid-argument-count';
        diagnostics.push(diagnostic);
      }
      
      // Special validation: ISNULL should not be used with GENERIC_FIELD variables
      // GENERIC_FIELD variables require ISBLANK() instead
      if (funcName === 'ISNULL' && !message) {
        const args = extractFunctionArguments(argsString);
        if (args.length > 0) {
          const firstArg = args[0].text.trim();
          // Check if the argument is a variable reference
          if (firstArg.startsWith('$')) {
            const varName = firstArg.replace(/^[$]/, '').split('/')[0];
            const varInfo = variables?.get(varName);
            if (varInfo?.rmType === 'GENERIC_FIELD') {
              const startPos = document.positionAt(match.index);
              const endPos = document.positionAt(closeParenIndex + 1);
              const range = new vscode.Range(startPos, endPos);
              
              const diagnostic = new vscode.Diagnostic(
                range,
                `ISNULL() does not work with GENERIC_FIELD variables. Use ISBLANK(${firstArg}) instead.`,
                vscode.DiagnosticSeverity.Error
              );
              diagnostic.source = 'dips-calc';
              diagnostic.code = 'isnull-generic-field';
              diagnostics.push(diagnostic);
            }
          }
        }
      }
      
      // Type validation - only if argument count is valid
      if (!message && funcInfo.params && funcInfo.params.length > 0) {
        const args = extractFunctionArguments(argsString);
        
        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          
          // Determine expected type for this parameter
          let expectedParam;
          if (i < funcInfo.params.length) {
            expectedParam = funcInfo.params[i];
          } else if (isVariadic && funcInfo.params.length > 0) {
            // For variadic functions, use the last non-optional param type or find the repeating param
            // Most variadic functions repeat the pattern of their last few params
            const lastParam = funcInfo.params[funcInfo.params.length - 1];
            if (lastParam.optional) {
              expectedParam = lastParam;
            } else {
              // Find the first optional param's type for extra args
              const optionalParam = funcInfo.params.find(p => p.optional);
              expectedParam = optionalParam || lastParam;
            }
          } else {
            // Extra args beyond what's defined - skip type checking
            continue;
          }
          
          if (!expectedParam || expectedParam.type === 'any') {
            continue;
          }
          
          // Infer type of the provided argument
          const inferredType = inferExpressionType(arg.text, variables);
          
          // Calculate argument position (needed for both type checking and ISO8601 validation)
          const argStartInDoc = openParenIndex + 1 + argsString.indexOf(arg.text);
          const argEndInDoc = argStartInDoc + arg.text.length;
          const argStartPos = document.positionAt(argStartInDoc);
          const argEndPos = document.positionAt(argEndInDoc);
          const argRange = new vscode.Range(argStartPos, argEndPos);
          
          // Special validation: if parameter expects ISO8601 type and argument is a string literal, validate it
          const iso8601Types = ['iso8601_datetime', 'iso8601_date', 'iso8601_time', 'iso8601_duration'];
          if (iso8601Types.includes(expectedParam.type)) {
            const trimmedArg = arg.text.trim();
            if ((trimmedArg.startsWith('"') && trimmedArg.endsWith('"')) || 
                (trimmedArg.startsWith("'") && trimmedArg.endsWith("'"))) {
              const validation = validateISO8601String(trimmedArg);
              if (!validation.valid) {
                const isoDiagnostic = new vscode.Diagnostic(
                  argRange,
                  validation.message,
                  vscode.DiagnosticSeverity.Error
                );
                isoDiagnostic.source = 'dips-calc';
                isoDiagnostic.code = 'invalid-iso8601';
                diagnostics.push(isoDiagnostic);
                // Skip type checking if ISO8601 validation failed
                continue;
              }
            }
          }
          
          // Only report type errors for high confidence inferences
          if (inferredType.type && inferredType.confidence === 'high') {
            if (!isTypeCompatible(inferredType.type, expectedParam.type)) {
              const typeMessage = `Argument ${i + 1} (${expectedParam.name}): expected ${formatTypeName(expectedParam.type)}, but got ${formatTypeName(inferredType.type)}`;
              
              const typeDiagnostic = new vscode.Diagnostic(
                argRange,
                typeMessage,
                vscode.DiagnosticSeverity.Warning
              );
              typeDiagnostic.source = 'dips-calc';
              typeDiagnostic.code = 'type-mismatch';
              diagnostics.push(typeDiagnostic);
            }
          }
        }
      }
    }
    
    return diagnostics;
  }
  
  /**
   * Update diagnostics for a document.
   * @param {vscode.TextDocument} document 
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
    
    const diagnostics = validateFunctionCalls(document, variables);
    
    // Add diagnostics for missing commas
    const missingCommas = detectMissingCommas(document);
    for (const mc of missingCommas) {
      const diagnostic = new vscode.Diagnostic(
        mc.range,
        'Possible missing comma between arguments',
        vscode.DiagnosticSeverity.Warning
      );
      diagnostic.source = 'dips-calc';
      diagnostic.code = 'missing-comma';
      diagnostics.push(diagnostic);
    }
    
    diagnosticCollection.set(document.uri, diagnostics);
  }
  
  /**
   * Detect potential missing commas between function arguments.
   * Looks for patterns like: expression expression (without comma between)
   * @param {vscode.TextDocument} document
   * @returns {Array<{range: vscode.Range, insertPosition: vscode.Position}>}
   */
  function detectMissingCommas(document) {
    const text = document.getText();
    const missingCommas = [];
    
    // Find all function calls and check their arguments
    const functionCallRegex = /\b([A-Z][A-Z0-9_]*)\s*\(/gi;
    
    let match;
    while ((match = functionCallRegex.exec(text)) !== null) {
      const openParenIndex = match.index + match[0].length - 1;
      let depth = 1;
      let closeParenIndex = -1;
      let inString = false;
      let stringChar = '';
      
      for (let i = openParenIndex + 1; i < text.length && depth > 0; i++) {
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
        
        if (char === '(') {
          depth++;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            closeParenIndex = i;
          }
        }
      }
      
      if (closeParenIndex === -1) continue;
      
      // Get the arguments text
      const argsText = text.substring(openParenIndex + 1, closeParenIndex);
      const argsStartOffset = openParenIndex + 1;
      
      // Tokenize the arguments to find adjacent tokens that should have a comma
      // A missing comma is: TOKEN WHITESPACE TOKEN where no comma or operator is between
      const tokenPattern = /(\$[A-Za-z_][A-Za-z0-9_./]*|[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)|[A-Za-z_][A-Za-z0-9_]*|"[^"]*"|'[^']*'|\d+\.?\d*)/g;
      
      // Instead of complex tokenization, look for specific patterns that indicate missing commas
      // Pattern: end of expression (variable, number, string, closing paren) followed by whitespace, then start of new expression
      
      // Simpler approach: scan through looking for whitespace gaps between value-like things
      let argDepth = 0;
      let argInString = false;
      let argStringChar = '';
      let lastValueEnd = -1; // Position after the last value token ended
      
      for (let i = 0; i < argsText.length; i++) {
        const char = argsText[i];
        const prevChar = i > 0 ? argsText[i - 1] : '';
        
        // Handle strings
        if ((char === '"' || char === "'") && prevChar !== '\\') {
          if (!argInString) {
            // Starting a string
            // Check if we should have had a comma before this
            if (lastValueEnd !== -1) {
              const gapText = argsText.substring(lastValueEnd, i);
              // If gap is only whitespace (no comma, no operator), it's a missing comma
              if (/^\s+$/.test(gapText)) {
                const insertOffset = argsStartOffset + lastValueEnd;
                const insertPos = document.positionAt(insertOffset);
                // Create a range that includes the next token for better lightbulb visibility
                // Find where the string ends
                let stringEnd = i + 1;
                while (stringEnd < argsText.length && argsText[stringEnd] !== char) {
                  stringEnd++;
                }
                stringEnd++; // Include closing quote
                const rangeStart = document.positionAt(argsStartOffset + lastValueEnd);
                const rangeEnd = document.positionAt(argsStartOffset + Math.min(stringEnd, argsText.length));
                missingCommas.push({
                  range: new vscode.Range(rangeStart, rangeEnd),
                  insertPosition: insertPos
                });
              }
            }
            argInString = true;
            argStringChar = char;
          } else if (char === argStringChar) {
            argInString = false;
            lastValueEnd = i + 1;
          }
          continue;
        }
        
        if (argInString) continue;
        
        // Track nested parentheses
        if (char === '(') {
          argDepth++;
          continue;
        }
        if (char === ')') {
          argDepth--;
          if (argDepth === 0) {
            lastValueEnd = i + 1;
          }
          continue;
        }
        
        // Inside nested parens - don't analyze
        if (argDepth > 0) continue;
        
        // Comma resets - we found a proper separator
        if (char === ',') {
          lastValueEnd = -1;
          continue;
        }
        
        // Operators reset - these are valid separators within an expression
        if ('+-*/^&%=<>?:'.includes(char)) {
          lastValueEnd = -1;
          continue;
        }
        
        // Two-char operators
        if (i + 1 < argsText.length) {
          const twoChar = argsText.substring(i, i + 2);
          if (twoChar === '<>' || twoChar === '>=' || twoChar === '<=') {
            lastValueEnd = -1;
            i++; // Skip next char
            continue;
          }
        }
        
        // Whitespace - just skip
        if (/\s/.test(char)) {
          continue;
        }
        
        // Start of a value token: $variable, identifier, or number
        if (char === '$' || /[A-Za-z_]/.test(char) || /\d/.test(char)) {
          // Find end of this token first (we need it for the range)
          let tokenEnd = i;
          if (char === '$') {
            // Variable: $name or $name/path
            tokenEnd++;
            while (tokenEnd < argsText.length && /[A-Za-z0-9_./]/.test(argsText[tokenEnd])) {
              tokenEnd++;
            }
          } else if (/[A-Za-z_]/.test(char)) {
            // Identifier - could be a function call
            while (tokenEnd < argsText.length && /[A-Za-z0-9_]/.test(argsText[tokenEnd])) {
              tokenEnd++;
            }
            // Check if followed by ( - it's a function call, will be handled by depth tracking
            // Skip whitespace to check
            let checkPos = tokenEnd;
            while (checkPos < argsText.length && /\s/.test(argsText[checkPos])) {
              checkPos++;
            }
            if (argsText[checkPos] === '(') {
              // It's a function call - the ) will set lastValueEnd
              i = tokenEnd - 1;
              continue;
            }
          } else {
            // Number
            while (tokenEnd < argsText.length && /[\d.]/.test(argsText[tokenEnd])) {
              tokenEnd++;
            }
          }
          
          // Check if we should have had a comma before this
          if (lastValueEnd !== -1) {
            const gapText = argsText.substring(lastValueEnd, i);
            // If gap is only whitespace (no comma, no operator), it's a missing comma
            if (/^\s+$/.test(gapText)) {
              const insertOffset = argsStartOffset + lastValueEnd;
              const insertPos = document.positionAt(insertOffset);
              // Create a range that includes the next token for better lightbulb visibility
              const rangeStart = document.positionAt(argsStartOffset + lastValueEnd);
              const rangeEnd = document.positionAt(argsStartOffset + tokenEnd);
              missingCommas.push({
                range: new vscode.Range(rangeStart, rangeEnd),
                insertPosition: insertPos
              });
            }
          }
          
          lastValueEnd = tokenEnd;
          i = tokenEnd - 1; // -1 because loop will increment
        }
      }
    }
    
    return missingCommas;
  }
  
  // Code Action provider for quick fixes (missing comma insertion)
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    selector,
    {
      provideCodeActions(document, range, context) {
        const actions = [];
        
        // Collect missing-comma diagnostics
        // First check context.diagnostics (passed by VS Code for diagnostics at cursor)
        const diagnosticsToFix = [];
        
        for (const d of context.diagnostics) {
          if (d.code === 'missing-comma') {
            diagnosticsToFix.push(d);
          }
        }
        
        // If none found in context, check our diagnostic collection directly
        // This handles cases where VS Code didn't pass the diagnostic
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
          
          // Check if there's already whitespace after the insertion point
          // The diagnostic range covers the whitespace gap, so we just insert a comma
          // The existing whitespace will serve as the space after the comma
          fix.edit.insert(document.uri, diagnostic.range.start, ',');
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
  
  // Update diagnostics when document opens or changes
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(updateDiagnostics),
    vscode.workspace.onDidChangeTextDocument(event => updateDiagnostics(event.document)),
    vscode.workspace.onDidCloseTextDocument(doc => diagnosticCollection.delete(doc.uri))
  );
  
  // Update diagnostics for all open documents on activation
  vscode.workspace.textDocuments.forEach(updateDiagnostics);

  context.subscriptions.push(
    wrapExpressionCommand,
    completionProvider,
    variableCompletionProvider,
    valueCompletionProvider,
    pathCompletionProvider,
    formattingProvider,
    rangeFormattingProvider,
    hoverProvider,
    minifyCommand,
    beautifyCommand,
    stripCommentsCommand,
    formDescWatcher,
    diagnosticCollection,
    codeActionProvider
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

// Shared tokenizer so formatting and minify stay in sync.
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
