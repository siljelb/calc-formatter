const fs = require('fs');
const path = require('path');

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
              const valueInfo = {
                value: listItem.value,
                label: listItem.label || listItem.localizedLabels?.nb || listItem.localizedLabels?.en || listItem.value
              };
              
              // Extract range validation for DV_QUANTITY units
              if (listItem.validation?.range) {
                valueInfo.range = listItem.validation.range;
              }
              
              variableInfo.values.push(valueInfo);
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
        console.log(`[DIPS Calc] Using cached variables from ${formDescPath}, count: ${cached.variables.size}`);
        return cached.variables;
      }
    }

    // Parse and extract
    const content = fs.readFileSync(formDescPath, 'utf8');
    const json = JSON.parse(content);
    const variables = new Map();
    extractVariables(json, variables);
    
    console.log(`[DIPS Calc] Extracted ${variables.size} variables from ${formDescPath}`);
    if (variables.has('dager')) {
      const dagerInfo = variables.get('dager');
      console.log(`[DIPS Calc] Found 'dager' variable:`, dagerInfo);
    } else {
      console.log(`[DIPS Calc] 'dager' variable NOT found in extraction`);
    }

    // Update cache
    formDescriptionCache.set(folderPath, { variables, mtime });

    return variables;
  } catch (error) {
    console.error(`Error reading form_description.json: ${error.message}`);
    return new Map();
  }
}

/**
 * Clear the form description cache.
 */
function clearCache() {
  formDescriptionCache.clear();
}

/**
 * Invalidate cache for a specific folder.
 * @param {string} folderPath - The folder path to invalidate
 */
function invalidateCache(folderPath) {
  formDescriptionCache.delete(folderPath);
}

module.exports = {
  extractVariables,
  findFormDescriptionJson,
  getVariablesFromFormDescription,
  clearCache,
  invalidateCache
};
