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
        
        // Don't provide function completions if we're typing a variable (after $)
        if (linePrefix.match(/\$[A-Za-z0-9_.\/]*$/)) {
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
      // If so, don't show function hover
      const startPos = wordRange.start;
      if (startPos.character > 0) {
        const charBefore = document.getText(new vscode.Range(
          new vscode.Position(startPos.line, startPos.character - 1),
          startPos
        ));
        if (charBefore === '$' || charBefore === '/') {
          return null;
        }
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

  context.subscriptions.push(
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
    formDescWatcher
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
