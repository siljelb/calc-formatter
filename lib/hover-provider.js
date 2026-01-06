/**
 * Hover provider for DIPS Calc expressions.
 */

const { VALUE_TYPE_MAPPING } = require('./type-system');

/**
 * Create hover provider for variables and functions.
 * @param {object} vscode - VS Code API
 * @param {Map} functionLookup - Function metadata lookup
 * @param {function} findFormDescriptionJson - Function to find form_description.json
 * @param {function} getVariablesFromFormDescription - Function to get variables
 * @returns {object} - Hover provider
 */
function createHoverProvider(vscode, functionLookup, findFormDescriptionJson, getVariablesFromFormDescription) {
  return {
    provideHover(document, position) {
      const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z][A-Za-z0-9_\.]*/);
      if (!wordRange) {
        return null;
      }

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
          varRange = new vscode.Range(
            new vscode.Position(startPos.line, startPos.character - 1),
            wordRange.end
          );
        }
      }

      // Variable hover
      if (isVariable) {
        const formDescPath = findFormDescriptionJson(document.uri.fsPath);
        
        if (formDescPath) {
          const variables = getVariablesFromFormDescription(formDescPath);
          const line = document.lineAt(position.line).text;
          const dollarIndex = line.lastIndexOf('$', position.character);
          
          if (dollarIndex !== -1) {
            const pathMatch = line.substring(dollarIndex).match(/^\$([A-Za-z_][A-Za-z0-9_.]*)([\/A-Za-z_][A-Za-z0-9_./]*)?/);
            
            if (pathMatch) {
              const baseVarName = pathMatch[1];
              const pathSuffix = pathMatch[2] || '';
              const fullPath = '$' + baseVarName + pathSuffix;
              
              const varInfo = variables.get(baseVarName);
              
              if (varInfo) {
                const markdown = new vscode.MarkdownString();
                markdown.appendMarkdown(`**${varInfo.name}**\n\n`);
                
                let displayType = varInfo.rmType;
                let typeDescription = null;
                
                if (pathSuffix === '/value') {
                  displayType = VALUE_TYPE_MAPPING[varInfo.rmType] || varInfo.rmType;
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
        
        return null;
      }

      // Function hover
      const functionName = document.getText(wordRange).toUpperCase();
      const metadata = functionLookup.get(functionName);
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
  };
}

module.exports = {
  createHoverProvider
};
