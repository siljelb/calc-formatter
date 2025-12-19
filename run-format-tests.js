const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync(require.resolve('./extension.js'), 'utf8');

class Disposable { dispose() {} }

const vscodeMock = {
  languages: {
    registerCompletionItemProvider() { return new Disposable(); },
    registerDocumentFormattingEditProvider() { return new Disposable(); },
    registerDocumentRangeFormattingEditProvider() { return new Disposable(); }
  },
  CompletionItem: class {},
  CompletionItemKind: { Function: 0 },
  SnippetString: class { constructor(value) { this.value = value; } },
  Range: class {},
  TextEdit: { replace: (range, text) => ({ range, newText: text }) }
};

const sandbox = {
  module: { exports: {} },
  exports: {},
  require: (name) => {
    if (name === 'vscode') {
      return vscodeMock;
    }
    return require(name);
  },
  console
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'extension.js' });

const { _formatFormula: formatFormula } = sandbox.module.exports;

const samples = [
  {
    name: 'Basic IF with variables',
    input: 'IF(AND($age > 18, $score < 100), SUM($value1, $value2), 0)'
  },
  {
    name: 'Nested functions',
    input: 'ROUND(AVERAGE($patient.value1, $patient.value2, $patient.value3), 2)'
  },
  {
    name: 'Age calculation',
    input: 'AGE($patient.birthDateTicks, NOWTICKS())'
  },
  {
    name: 'Complex conditional',
    input: 'IF(AND($status == "Active", $score > 80), "Approved", IF($score > 50, "Pending", "Rejected"))'
  },
  {
    name: 'String functions',
    input: 'CONCATENATE(UPPER(LEFT($firstName, 1)), LOWER(MID($firstName, 2, LEN($firstName) - 1)), " ", UPPER($lastName))'
  },
  {
    name: 'Date functions',
    input: 'FORMATDATETIME(NOWTICKS(), "D", "en-us")'
  },
  {
    name: 'Null handling',
    input: 'IFNULL($preferredName, IFNULL($firstName, "Unknown"))'
  }
];

samples.forEach(({ name, input }) => {
  const formatted = formatFormula(input);
  const idempotent = formatFormula(formatted) === formatted;
  console.log(`--- ${name} ---`);
  console.log(formatted);
  console.log(idempotent ? 'Idempotent: yes' : 'Idempotent: no');
});
