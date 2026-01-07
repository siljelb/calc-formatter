# DIPS Arena Calc Expression Formatter

A Visual Studio Code extension for formatting, validating, and working with DIPS Arena calc expressions.

## Features

- **Clean formatting** – Convert dense expressions into indented, readable layouts.
- **One-click minify** – Collapse formatted expressions back to single-line format.
- **IntelliSense** – Autocomplete for calc functions with signature help.
- **Parameter hints** – Function signatures and parameter types displayed while typing.
- **Custom functions** – Define reusable macro-style functions (BMI, FORMAT_DURATION, TEXTJOIN) that expand to standard calc expressions.
- **Function wrapping** – Type a function name before an expression to automatically wrap it.
- **Variable autocomplete** – Variables from `form_description.json` with data types.
- **Path autocomplete** – Path suggestions for complex types (e.g., `$quantity/magnitude`).
- **Value autocomplete** – Allowed values for coded text fields.
- **Diagnostics** – Real-time validation for:
  - Argument counts and type mismatches with detailed error messages
  - Missing commas between arguments
  - Variables used without `$` prefix (with quick fix)
  - Undeclared variables not found in form_description.json
  - Enhanced type errors showing rmType and conversion suggestions
- **Syntax highlighting** – Color-coded functions, variables, strings, and numbers.
- **File icons** – Dedicated icon for `.calc` files in the explorer.

## Install

1. Download or clone this repository.
2. Copy the entire folder to your VS Code extensions directory:
   - **Windows:** `%USERPROFILE%\.vscode\extensions\siljelb.dips-calc-expression`
   - **macOS/Linux:** `~/.vscode/extensions/siljelb.dips-calc-expression`
3. Restart VS Code.
4. Open any `.calc` file to start using the extension.

## Usage

1. Open or create a file with the `.calc` extension (or select **DIPS Calc Expression** from the language mode picker).
2. Type or paste your expression. Use **Format Document** (`Shift+Alt+F`) to format.
3. Add comments using `//` for documentation (editor-only, not supported in DIPS Arena).
4. To get a compact version, run **DIPS Calc: Minify Document or Selection** from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
5. Before pasting to DIPS Arena, run **DIPS Calc: Export for Arena** to strip comments and expand custom functions.
6. Use `Ctrl+Space` to trigger function and variable completions.

## Commands

| Command | Purpose |
| ------- | ------- |
| `DIPS Calc: Minify Document or Selection` | Collapse the active selection or entire file into a single-line expression while preserving strings and operators. |
| `DIPS Calc: Beautify Document or Selection` | Manually beautify the selection or the entire file. |
| `DIPS Calc: Strip Comments` | Remove all `//` comments from the document or selection. Use this before copying expressions to DIPS Arena, which does not support comments natively. |
| `DIPS Calc: Expand Custom Functions` | Expand all custom function calls (like BMI, FORMAT_DURATION) into standard DIPS Calc expressions. |
| `DIPS Calc: Export for Arena` | One-click export: strip comments and expand custom functions for pasting into DIPS Arena. |

## Custom Functions

Custom functions are macro-style functions that expand to standard DIPS Calc expressions. Use cases:
- Reusing calculations across forms
- Simplifying complex expressions
- Creating domain-specific functions

### Built-in Custom Functions

- **`BMI(weight_kg, height_cm)`** – Calculate Body Mass Index
- **`FORMAT_DURATION(duration_string, format_string)`** – Format ISO8601 durations with Norwegian localization
  - Standard formats: `"c"`, `"g"`, `"G"`
  - Norwegian formats: `"no-short"`, `"no-long"`, `"no-compact"`
  - Custom formats using: `d` (days), `h` (hours), `m` (minutes), `s` (seconds)
- **`TEXTJOIN(delimiter, ignore_empty, text1, ..., text10)`** – Excel-style text joining

### Using Custom Functions

1. Type custom function names in your expressions (autocomplete available).
2. Run **DIPS Calc: Export for Arena** or **DIPS Calc: Expand Custom Functions** to convert to standard DIPS Calc.
3. Copy the expanded result to DIPS Arena.

### Creating Custom Functions

Add a new file to `lib/custom-functions/` with this structure:

```javascript
module.exports = {
  name: 'MY_FUNCTION',
  signature: 'MY_FUNCTION(param1, param2)',
  detail: 'Description of what the function does',
  minArgs: 2,
  maxArgs: 2,
  returns: 'number',
  params: [
    { name: 'param1', type: 'number' },
    { name: 'param2', type: 'text' }
  ],
  expansion: 'ROUND({param1} * 10 + LEN({param2}), 2)'
};
```

The function will be automatically loaded – no registration required.

## Parameter Hints (Signature Help)

Function signatures display parameter names, types, and the current parameter position while typing.

Triggers:
- Type `(` after a function name
- Type `,` to move to next parameter
- Select a function from autocomplete
- Manual: `Ctrl+Shift+Space` / `Cmd+Shift+Space`

## Configuration

The extension ships with sensible defaults for calc expression editing. Override them in your `settings.json` if you prefer a different setup:

```json
"[dips-calc]": {
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.formatOnPaste": false
}
```

## Variable Autocomplete from form_description.json

The extension searches for `form_description.json` in the same folder or immediate parent folder and extracts `calcId` annotations for variable completions.

Usage:
1. Place `.calc` file in the same folder as `form_description.json` or in a direct subfolder.
2. Type `$` to trigger autocomplete.
3. Variables from form description appear first with name and data type.
4. Variables used in the current document also appear.

### Path Completion

Type `/` after a variable name to get path suggestions based on data type:

- `$quantity/magnitude` – Numeric value of DV_QUANTITY
- `$quantity/units` – Unit string
- `$coded/defining_code/code_string` – Code value of DV_CODED_TEXT
- `$ordinal/value` – Integer value of DV_ORDINAL

### Value Completion

For DV_CODED_TEXT and DV_ORDINAL fields with defined values, type `"` after an equals sign to see allowed values:

```
$status = "  <-- triggers value completion
```

**Note:** Only `form_description.json` in the same folder or immediate parent is used to avoid conflicts with unrelated forms.

Cache refreshes automatically when `form_description.json` changes.

## Diagnostics

Real-time validation:

- **Argument count** – Errors for incorrect number of arguments
- **Type checking** – Warnings for type mismatches
- **Missing commas** – Warnings with quick fix to insert comma
- **Unknown functions** – Highlights unrecognized function names
- **ISNULL/GENERIC_FIELD** – Error suggesting `ISBLANK()` instead

Use `Ctrl+.` or click the lightbulb for quick fixes.

## Feedback

Report bugs or request features in the GitHub repository. Include sample expressions for faster reproduction.

## Development

Setup:

```bash
git clone https://github.com/<your-org>/calc-formatter.git
cd calc-formatter
npm install
```

- Press `F5` in VS Code to launch Extension Development Host
- Run tests: `node run-format-tests.js`
- Package: `npx vsce package`

Pull requests welcome. Include test cases and example expressions.
