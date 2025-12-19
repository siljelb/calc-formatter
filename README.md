# DIPS Arena Calc Expression Formatter

Give complex DIPS Arena calc expressions the same polish you expect from code. This Visual Studio Code extension keeps calc expressions readable, helps you explore function names, and lets you collapse everything back down when you need compact copies.

## Why You'll Like It

- **Clean formatting** – Convert dense expressions into a well-indented layout that is easy to scan.
- **One-click minify** – Run `DIPS Calc: Minify Document or Selection` from the Command Palette when you need a single-line version.
- **Real-time IntelliSense** – Start typing and get completions for common calc functions with signature help.
- **Smart function wrapping** – Type a function name before an expression (like `ISNULL` before `$myVar`) and it wraps automatically.
- **Variable autocomplete** – Type `$` to see available variables from `form_description.json` with their data types.
- **Path autocomplete** – Type `/` after a variable to get path suggestions (e.g., `$quantity/magnitude`).
- **Value autocomplete** – Type `"` after `$variable =` to see allowed values for coded text fields.
- **Live diagnostics** – Get warnings for incorrect argument counts, type mismatches, and missing commas.
- **Syntax-aware highlighting** – Colours functions, variables, strings, booleans, and numbers so the important bits stand out.
- **File explorer integration** – `.calc` files show a dedicated icon for quick visual recognition.

## Install

1. Download or clone this repository.
2. Copy the entire folder to your VS Code extensions directory:
   - **Windows:** `%USERPROFILE%\.vscode\extensions\siljelb.dips-calc-expression`
   - **macOS/Linux:** `~/.vscode/extensions/siljelb.dips-calc-expression`
3. Restart VS Code.
4. Open any `.calc` file to start using the extension.

## Everyday Use

1. Save or open a file with the `.calc` extension (or pick **DIPS Calc Expression** in the language mode picker).
2. Paste or type your expression. Run **Format Document** (`Shift+Alt+F`) to beautify it.
3. Add comments using `//` to document your expressions - these are for your reference in the editor only.
4. Need the compact version? Press `Ctrl+Shift+P` / `Cmd+Shift+P`, run **DIPS Calc: Minify Document or Selection**, and copy the result.
5. Before copying to DIPS Arena, run **DIPS Calc: Strip Comments** to remove all comments (DIPS Arena does not support comments natively).
6. Trigger completions with `Ctrl+Space` to browse function snippets.

## Commands

| Command | Purpose |
| ------- | ------- |
| `DIPS Calc: Minify Document or Selection` | Collapse the active selection or entire file into a single-line expression while preserving strings and operators. |
| `DIPS Calc: Beautify Document or Selection` | Manually beautify the selection or the entire file. |
| `DIPS Calc: Strip Comments` | Remove all `//` comments from the document or selection. Use this before copying expressions to DIPS Arena, which does not support comments natively. |

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

When editing `.calc` files, the extension automatically looks for a `form_description.json` file in the same folder or the immediate parent folder. It extracts all `calcId` annotations and provides them as variable completions when you type `$`.

This means you get IntelliSense for all the field variables defined in your DIPS Arena form:

1. Place your `.calc` file in the same folder as your `form_description.json`, or in a direct subfolder.
2. Type `$` to trigger autocomplete.
3. Variables from the form description appear first, showing their name and data type.
4. Variables already used in the current document also appear in the list.

### Path Completion

After typing a variable name, type `/` to get path suggestions based on the variable's data type:

- `$quantity/magnitude` – Get the numeric value of a DV_QUANTITY
- `$quantity/units` – Get the unit string
- `$coded/defining_code/code_string` – Get the code value of a DV_CODED_TEXT
- `$ordinal/value` – Get the integer value of a DV_ORDINAL

### Value Completion

For DV_CODED_TEXT and DV_ORDINAL fields that have defined values, type `"` after an equals sign to see allowed values:

```
$status = "  <-- triggers value completion
```

**Note:** Only the `form_description.json` in the same folder or immediate parent is used. This prevents accidentally picking up variables from unrelated forms elsewhere in your workspace.

The cache is automatically refreshed when `form_description.json` changes.

## Diagnostics

The extension provides real-time feedback as you type:

- **Argument count validation** – Errors when a function receives too few or too many arguments
- **Type checking** – Warnings when argument types don't match (e.g., passing text where a number is expected)
- **Missing comma detection** – Warnings when arguments appear to be missing a comma, with a quick fix (lightbulb) to insert it
- **Unknown function warnings** – Highlights function names that aren't recognized
- **ISNULL/GENERIC_FIELD validation** – Error when using `ISNULL()` with a GENERIC_FIELD variable, suggesting `ISBLANK()` instead

Click the lightbulb or press `Ctrl+.` to see available quick fixes.

## Share Feedback

Spotted a bug or want a new capability? Open an issue in the repository and include a sample calc expression so we can reproduce it quickly.

## For Developers

Want to tinker with the formatter logic or help the project grow? Here's how to get started:

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/<your-org>/calc-formatter.git
   cd calc-formatter
   npm install
   ```
2. Open the folder in VS Code and press `F5` to launch the extension in a new Extension Development Host window.
3. Run sanity checks with `node run-format-tests.js`. Add new samples under `test/` before submitting a PR.
4. Package a distributable build via `npx vsce package`.

We welcome issues, feature ideas, and pull requests—please describe the scenario and include example formulas so reviews go quickly.

Enjoy cleaner calc expressions without leaving VS Code!
