# Change Log

All notable changes to the "DIPS Arena Calc Expression Formatter" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [0.4.0] - 2026-01-06
### Added
- **Custom functions system** - Define reusable macro-style functions that expand to complex expressions
  - Auto-discovery: Add new functions by creating files in `lib/custom-functions/` directory
  - Built-in custom functions:
    - `BMI(weight_kg, height_cm)` - Calculate Body Mass Index
    - `FORMAT_DURATION(duration_string, format_string)` - Format ISO8601 durations with Norwegian localization (supports .NET TimeSpan formats)
    - `TEXTJOIN(delimiter, ignore_empty, text1, ..., text10)` - Excel-style text joining with optional empty value handling
  - Commands: `Expand Custom Functions` and `Export for Arena` to compile custom functions into standard DIPS Calc
- **Signature help** - Parameter hints appear automatically while typing function arguments
  - Shows function signature, parameter names, and types
  - Highlights current parameter position
  - Automatically triggered when selecting functions from autocomplete
  - Manual trigger: `Ctrl+Shift+Space` / `Cmd+Shift+Space`
- Centralized constants in `lib/constants.js` for configuration values

### Changed
- **Improved type inference** - String comparison expressions now correctly infer as boolean type
  - Top-level comparisons (e.g., `"c" = "g"`) return boolean
  - Comparisons inside function calls respect the function's return type (e.g., `IF(x > 0, "yes", "no")` returns text)
  - Proper handling of parenthesis depth and string literals in type checking

### Fixed
- Diagnostics provider missing import for `DIAGNOSTIC_CODES` and `DIAGNOSTIC_SOURCE`
- String literal detection now counts quotes to avoid false positives with comparison operators
- FORMAT_DURATION replaced MOD() function with arithmetic operations (MOD not supported in DIPS Calc)

## [0.3.1]
### Fixed
- Type inference for comparison expressions - expressions like `MAX(...) > 305` are now correctly identified as boolean instead of number

## [0.3.0]
### Added
- **form_description.json integration** - Variable autocomplete now reads `calcId` annotations from `form_description.json` files in the same folder or parent folders
- Variables from form_description.json are shown with source information and sorted first in completions
- File watcher automatically refreshes the cache when form_description.json changes
- **Function wrapping** - Type a function name before an existing expression (e.g., type `ISNULL` before `$myVar`) and the expression is automatically wrapped: `ISNULL($myVar)`
- **Function parameter validation** - Real-time diagnostics for incorrect argument counts with detailed error messages
- **Type checking** - Warnings when argument types don't match expected parameter types (e.g., passing a boolean where a number is expected)
- **Missing comma detection** - Warns when arguments appear to be missing a comma separator, with a quick fix to insert the comma
- **Unknown function warnings** - Highlights unknown function names to catch typos
- **ISNULL/GENERIC_FIELD validation** - Error when using `ISNULL()` with a GENERIC_FIELD variable (use `ISBLANK()` instead)
- **Path completion** - Type `/` after a variable to get path suggestions based on the variable's data type (e.g., `$quantity/magnitude`, `$coded/defining_code/code_string`)
- **Value completion** - Type `"` after `$variable =` to get autocomplete for allowed values from form_description.json (for DV_CODED_TEXT and DV_ORDINAL fields)
- **Variable type display** - Variable completions now show the data type (Boolean, Quantity, Coded Text, etc.) in the completion list

### Changed
- Variable completions now show source (from form_description.json vs from document)
- **Format on paste disabled** - Automatic formatting on paste is now disabled by default. Use `Shift+Alt+F` to format manually.

## [0.2.0]
### Added
- Variable name autocompletion - type `$` to see all variables used in the document
- Right-click context menu with Beautify, Minify, and Strip Comments commands
- GitHub Actions workflow for automated release packaging

### Changed
- Smart formatting: functions with 0-1 arguments stay on one line, functions with 2+ arguments expand to multiple lines
- Function autocompletion now adds parentheses with cursor positioned inside (for functions with arguments) or after (for functions without arguments)
- Simplified operators: removed `==`, `!=`, `&&`, `||`, `!` (use `=`, `<>`, and `AND()`, `OR()`, `NOT()` functions instead)
- Removed bracket variable notation `[variableName]` support

### Fixed
- Function completion no longer interferes when manually typing function name with opening parenthesis

## [0.1.0]
### Changed
- Forked from excel-formula-formatter and adapted for DIPS Arena calc expressions
- Changed file extension from `.xlf` to `.calc`
- Updated syntax highlighting for calc expression syntax
- Added support for single-line (`//`) and block (`/* */`) comments
- Added support for single-quoted strings
- Updated function completions for calc expression functions
- Added support for bracket notation variables `[variableName]`

## [0.0.1]
### Added
- Syntax highlighting for functions, variables, booleans, and numbers.
- IntelliSense completions for frequently used calc functions.
- Formatter that expands minimised expressions into indented, line-by-line layouts.
- Language configuration with indentation rules and editor defaults tailored for calc expressions.
