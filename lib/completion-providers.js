/**
 * Completion providers for DIPS Calc expressions.
 * 
 * This module exports functions to create all completion providers:
 * - Function completion
 * - Variable completion
 * - Value completion (for coded variables)
 * - Path completion (for variable paths like /value)
 */

/**
 * Create all completion providers.
 * @param {vscode} vscode - The VS Code API
 * @param {object} selector - Language selector
 * @param {Map} FUNCTION_ITEMS - Function metadata array
 * @param {Function} findFormDescriptionJson - Function to find form_description.json
 * @param {Function} getVariablesFromFormDescription - Function to get variables
 * @returns {Array} Array of completion providers to register
 */
function createCompletionProviders(vscode, selector, FUNCTION_ITEMS, findFormDescriptionJson, getVariablesFromFormDescription) {
  // Autocomplete provider built from FUNCTION_ITEMS
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
            // Trigger signature help after insertion
            item.command = {
              command: 'editor.action.triggerParameterHints',
              title: 'Trigger Parameter Hints'
            };
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

        // Map rmType to a short display name
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

  // Path completion provider - triggers on '/' after a variable name
  const pathCompletionProvider = vscode.languages.registerCompletionItemProvider(
    selector,
    {
      provideCompletionItems(document, position) {
        const lineText = document.lineAt(position.line).text;
        const linePrefix = lineText.substring(0, position.character);
        
        // Check if we're in a variable path context
        const pathMatch = linePrefix.match(/\$([A-Za-z_][A-Za-z0-9_]*)((?:\/[A-Za-z_][A-Za-z0-9_]*)*)\/([A-Za-z_]*)$/);
        if (!pathMatch) {
          return [];
        }

        const variableName = pathMatch[1];
        const existingPath = pathMatch[2];
        const typedSegment = pathMatch[3];
        
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
          'DV_BOOLEAN': [{ path: 'value', detail: 'Boolean value (true/false)' }],
          'DV_CODED_TEXT': [
            { path: 'defining_code/code_string', detail: 'Code value (e.g., at0009)' },
            { path: 'value', detail: 'Display text' },
            { path: 'defining_code/terminology_id/value', detail: 'Terminology ID' },
          ],
          'DV_COUNT': [{ path: 'magnitude', detail: 'Integer count value' }],
          'DV_DATE_TIME': [{ path: 'value', detail: 'ISO 8601 date/time string' }],
          'DV_DATE': [{ path: 'value', detail: 'ISO 8601 date string' }],
          'DV_TIME': [{ path: 'value', detail: 'ISO 8601 time string' }],
          'DV_DURATION': [{ path: 'value', detail: 'ISO 8601 duration string' }],
          'DV_EHR_URI': [{ path: 'value', detail: 'EHR URI value' }],
          'DV_URI': [{ path: 'value', detail: 'URI value' }],
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
          'DV_TEXT': [{ path: 'value', detail: 'Text content' }],
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

        const rmType = varInfo.rmType || '';
        let availablePaths = pathsByType[rmType] || [{ path: 'value', detail: 'The primary value' }];

        const currentPrefix = existingPath ? existingPath.substring(1) + '/' : '';
        
        // Filter to only show paths that start with the current prefix
        const matchingPaths = [];
        const seenNextSegments = new Set();
        
        for (const p of availablePaths) {
          if (p.path.startsWith(currentPrefix)) {
            const remaining = p.path.substring(currentPrefix.length);
            const nextSlash = remaining.indexOf('/');
            const nextSegment = nextSlash >= 0 ? remaining.substring(0, nextSlash) : remaining;
            
            if (nextSegment && !seenNextSegments.has(nextSegment)) {
              seenNextSegments.add(nextSegment);
              const isComplete = nextSlash < 0;
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
          item.insertText = p.segment;
          return item;
        });

        return items;
      }
    },
    '/' // Trigger on / character
  );

  return [
    completionProvider,
    variableCompletionProvider,
    valueCompletionProvider,
    pathCompletionProvider
  ];
}

module.exports = {
  createCompletionProviders
};
