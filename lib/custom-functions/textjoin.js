/**
 * TEXTJOIN custom function.
 * Combines multiple text values with a delimiter, matching Excel's TEXTJOIN function.
 * 
 * Parameters:
 * - delimiter: Text string to place between values
 * - ignore_empty: If TRUE (1), empty values are skipped; if FALSE (0), they are included
 * - text1 through text10: Values to join (optional after text1)
 * 
 * Examples:
 * - TEXTJOIN(", ", 1, "Oslo", "", "Bergen") -> "Oslo, Bergen"
 * - TEXTJOIN(" - ", 0, "A", "B", "C") -> "A - B - C"
 * - TEXTJOIN("/", 1, $field1, $field2, $field3) -> "value1/value2/value3"
 */

module.exports = {
  name: 'TEXTJOIN',
  signature: 'TEXTJOIN(delimiter, ignore_empty, text1, [text2], [text3], [text4], [text5], [text6], [text7], [text8], [text9], [text10])',
  detail: 'Combines text values with a delimiter, similar to Excel TEXTJOIN. Set ignore_empty to 1 to skip empty values, 0 to include them. Supports up to 10 text arguments.',
  minArgs: 3,
  maxArgs: 12,
  returns: 'text',
  params: [
    { name: 'delimiter', type: 'text' },
    { name: 'ignore_empty', type: 'boolean' },
    { name: 'text1', type: 'text' },
    { name: 'text2', type: 'text', optional: true },
    { name: 'text3', type: 'text', optional: true },
    { name: 'text4', type: 'text', optional: true },
    { name: 'text5', type: 'text', optional: true },
    { name: 'text6', type: 'text', optional: true },
    { name: 'text7', type: 'text', optional: true },
    { name: 'text8', type: 'text', optional: true },
    { name: 'text9', type: 'text', optional: true },
    { name: 'text10', type: 'text', optional: true }
  ],
  expansion: `CONCATENATE(
  IF({ignore_empty} = 1,
    CONCATENATE(
      IF(ISBLANK({text1}), "", {text1}),
      IF(AND(NOT(ISBLANK({text2})), OR(NOT(ISBLANK({text1})))), {delimiter}, ""),
      IF(ISBLANK({text2}), "", {text2}),
      IF(AND(NOT(ISBLANK({text3})), OR(NOT(ISBLANK({text1})), NOT(ISBLANK({text2})))), {delimiter}, ""),
      IF(ISBLANK({text3}), "", {text3}),
      IF(AND(NOT(ISBLANK({text4})), OR(NOT(ISBLANK({text1})), NOT(ISBLANK({text2})), NOT(ISBLANK({text3})))), {delimiter}, ""),
      IF(ISBLANK({text4}), "", {text4}),
      IF(AND(NOT(ISBLANK({text5})), OR(NOT(ISBLANK({text1})), NOT(ISBLANK({text2})), NOT(ISBLANK({text3})), NOT(ISBLANK({text4})))), {delimiter}, ""),
      IF(ISBLANK({text5}), "", {text5}),
      IF(AND(NOT(ISBLANK({text6})), OR(NOT(ISBLANK({text1})), NOT(ISBLANK({text2})), NOT(ISBLANK({text3})), NOT(ISBLANK({text4})), NOT(ISBLANK({text5})))), {delimiter}, ""),
      IF(ISBLANK({text6}), "", {text6}),
      IF(AND(NOT(ISBLANK({text7})), OR(NOT(ISBLANK({text1})), NOT(ISBLANK({text2})), NOT(ISBLANK({text3})), NOT(ISBLANK({text4})), NOT(ISBLANK({text5})), NOT(ISBLANK({text6})))), {delimiter}, ""),
      IF(ISBLANK({text7}), "", {text7}),
      IF(AND(NOT(ISBLANK({text8})), OR(NOT(ISBLANK({text1})), NOT(ISBLANK({text2})), NOT(ISBLANK({text3})), NOT(ISBLANK({text4})), NOT(ISBLANK({text5})), NOT(ISBLANK({text6})), NOT(ISBLANK({text7})))), {delimiter}, ""),
      IF(ISBLANK({text8}), "", {text8}),
      IF(AND(NOT(ISBLANK({text9})), OR(NOT(ISBLANK({text1})), NOT(ISBLANK({text2})), NOT(ISBLANK({text3})), NOT(ISBLANK({text4})), NOT(ISBLANK({text5})), NOT(ISBLANK({text6})), NOT(ISBLANK({text7})), NOT(ISBLANK({text8})))), {delimiter}, ""),
      IF(ISBLANK({text9}), "", {text9}),
      IF(AND(NOT(ISBLANK({text10})), OR(NOT(ISBLANK({text1})), NOT(ISBLANK({text2})), NOT(ISBLANK({text3})), NOT(ISBLANK({text4})), NOT(ISBLANK({text5})), NOT(ISBLANK({text6})), NOT(ISBLANK({text7})), NOT(ISBLANK({text8})), NOT(ISBLANK({text9})))), {delimiter}, ""),
      IF(ISBLANK({text10}), "", {text10})
    ),
    CONCATENATE(
      {text1},
      IF(ISBLANK({text2}), "", CONCATENATE({delimiter}, {text2})),
      IF(ISBLANK({text3}), "", CONCATENATE({delimiter}, {text3})),
      IF(ISBLANK({text4}), "", CONCATENATE({delimiter}, {text4})),
      IF(ISBLANK({text5}), "", CONCATENATE({delimiter}, {text5})),
      IF(ISBLANK({text6}), "", CONCATENATE({delimiter}, {text6})),
      IF(ISBLANK({text7}), "", CONCATENATE({delimiter}, {text7})),
      IF(ISBLANK({text8}), "", CONCATENATE({delimiter}, {text8})),
      IF(ISBLANK({text9}), "", CONCATENATE({delimiter}, {text9})),
      IF(ISBLANK({text10}), "", CONCATENATE({delimiter}, {text10}))
    )
  )
)`
};
