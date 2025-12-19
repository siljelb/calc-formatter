# DIPS Arena Calc Expression Formatter

Give complex Excel formulas the same polish you expect from code. This Visual Studio Code extension keeps formulas readable, helps you explore function names, and now lets you collapse everything back down when you need compact copies.

## Why You'll Like It

- **Clean formatting** – Convert dense expressions into a well-indented layout that is easy to scan.
- **One-click minify** – Run `DIPS Calc: Minify Document or Selection` from the Command Palette when you need a single-line version.
- **Real-time IntelliSense** – Start typing and get completions for common calc functions with signature help.
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
2. Paste or type your expression. The extension formats on paste automatically; you can also run **Format Document** at any time.
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
  "editor.formatOnPaste": true
}
```

## Share Feedback

Spotted a bug or want a new capability? Open an issue in the repository and include a sample formula so we can reproduce it quickly.

## For Developers

Want to tinker with the formatter logic or help the project grow? Here's how to get started:

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/<your-org>/excel-formula-formatter.git
   cd excel-formula-formatter
   npm install
   ```
2. Open the folder in VS Code and press `F5` to launch the extension in a new Extension Development Host window.
3. Run sanity checks with `node run-format-tests.js`. Add new samples under `test/` before submitting a PR.
4. Package a distributable build via `npx vsce package`.

We welcome issues, feature ideas, and pull requests—please describe the scenario and include example formulas so reviews go quickly.

Enjoy cleaner Excel formulas without leaving VS Code!
