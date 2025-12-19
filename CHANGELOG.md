# Change Log

All notable changes to the "DIPS Arena Calc Expression Formatter" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
