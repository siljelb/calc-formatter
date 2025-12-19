// Function metadata powering IntelliSense suggestions for DIPS Arena calc expressions.
// Based on DIPS Form Designer v2 function documentation.
//
// Type definitions used:
// - number: numeric value
// - integer: whole number
// - text: string value
// - boolean: true/false
// - datetime: datetime object
// - ticks: numeric timestamp (100-nanosecond intervals since 0001-01-01)
// - iso8601_datetime: ISO 8601 formatted datetime string (e.g., "2024-12-19T14:30:00")
// - iso8601_date: ISO 8601 formatted date string (e.g., "2024-12-19")
// - iso8601_time: ISO 8601 formatted time string (e.g., "14:30:00")
// - iso8601_duration: ISO 8601 duration string (e.g., "P1Y2M3D", "PT1H30M")
// - any: any type
// - null: null value
//
// Parameter info structure:
// - minArgs: minimum number of required arguments
// - maxArgs: maximum number of arguments ('*' for variadic/unlimited functions)
// - returns: return type of the function
// - params: array of { name, type, optional? } for each parameter
const FUNCTION_ITEMS = [
  // === Age and Duration Functions ===
  { name: 'AGE', signature: 'AGE(birthdate_ticks, current_date_ticks)', detail: 'Calculates age based on birth date and a given date.', minArgs: 2, maxArgs: 2,
    returns: 'integer',
    params: [
      { name: 'birthdate_ticks', type: 'ticks' },
      { name: 'current_date_ticks', type: 'ticks' }
    ]
  },
  { name: 'DURATION_ADD', signature: 'DURATION_ADD(iso8601_date, iso8601_duration)', detail: 'Adds the given ISO8601 Duration text to the given ISO8601 DateTime or ISO8601 Date string.', minArgs: 2, maxArgs: 2,
    returns: 'iso8601_datetime',
    params: [
      { name: 'iso8601_date', type: 'iso8601_datetime' },
      { name: 'iso8601_duration', type: 'iso8601_duration' }
    ]
  },
  { name: 'DURATION_SUBTRACT', signature: 'DURATION_SUBTRACT(iso8601_date, iso8601_duration)', detail: 'Subtracts the given ISO8601 Duration text from the given ISO8601 DateTime or ISO8601 Date string.', minArgs: 2, maxArgs: 2,
    returns: 'iso8601_datetime',
    params: [
      { name: 'iso8601_date', type: 'iso8601_datetime' },
      { name: 'iso8601_duration', type: 'iso8601_duration' }
    ]
  },
  { name: 'DURATION_TO_DAYS', signature: 'DURATION_TO_DAYS(iso8601_duration_text)', detail: 'Returns the numeric value of the duration in days.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [
      { name: 'iso8601_duration_text', type: 'iso8601_duration' }
    ]
  },
  { name: 'DURATION_TO_HOURS', signature: 'DURATION_TO_HOURS(iso8601_duration_text)', detail: 'Returns the numeric value of the duration in hours.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [
      { name: 'iso8601_duration_text', type: 'iso8601_duration' }
    ]
  },
  { name: 'DURATION_TO_MINUTES', signature: 'DURATION_TO_MINUTES(iso8601_duration_text)', detail: 'Returns the numeric value of the duration in minutes.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [
      { name: 'iso8601_duration_text', type: 'iso8601_duration' }
    ]
  },
  { name: 'DURATION_TO_SECONDS', signature: 'DURATION_TO_SECONDS(iso8601_duration_text)', detail: 'Returns the numeric value of the duration in seconds.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [
      { name: 'iso8601_duration_text', type: 'iso8601_duration' }
    ]
  },
  { name: 'ISO8601DURATION', signature: 'ISO8601DURATION(date_text1, date_text2)', detail: 'Calculates the difference between two dates. The result is returned as an ISO 8601 duration string.', minArgs: 2, maxArgs: 2,
    returns: 'iso8601_duration',
    params: [
      { name: 'date_text1', type: 'iso8601_datetime' },
      { name: 'date_text2', type: 'iso8601_datetime' }
    ]
  },
  { name: 'DURATIONTICKS', signature: 'DURATIONTICKS(duration)', detail: 'Converts an ISO8601 duration (string) to ticks.', minArgs: 1, maxArgs: 1,
    returns: 'ticks',
    params: [
      { name: 'duration', type: 'iso8601_duration' }
    ]
  },

  // === Date and Time Functions ===
  { name: 'NOW', signature: 'NOW()', detail: 'Returns datetime representing the current date and time.', minArgs: 0, maxArgs: 0,
    returns: 'datetime', params: []
  },
  { name: 'TODAY', signature: 'TODAY()', detail: 'Returns datetime representing today\'s date.', minArgs: 0, maxArgs: 0,
    returns: 'datetime', params: []
  },
  { name: 'NOWTICKS', signature: 'NOWTICKS()', detail: 'Returns the number of ticks representing the current datetime.', minArgs: 0, maxArgs: 0,
    returns: 'ticks', params: []
  },
  { name: 'TODAYTICKS', signature: 'TODAYTICKS()', detail: 'Returns the number of ticks representing today\'s date.', minArgs: 0, maxArgs: 0,
    returns: 'ticks', params: []
  },
  { name: 'DATEVALUE', signature: 'DATEVALUE(date_text)', detail: 'Converts an ISO 8601 date or datetime from string to ticks.', minArgs: 1, maxArgs: 1,
    returns: 'ticks',
    params: [{ name: 'date_text', type: 'iso8601_datetime' }]
  },
  { name: 'DAYTICKS', signature: 'DAYTICKS(days)', detail: 'Converts days to ticks.', minArgs: 1, maxArgs: 1,
    returns: 'ticks',
    params: [{ name: 'days', type: 'number' }]
  },
  { name: 'HOURTICKS', signature: 'HOURTICKS(hours)', detail: 'Converts hours to ticks.', minArgs: 1, maxArgs: 1,
    returns: 'ticks',
    params: [{ name: 'hours', type: 'number' }]
  },
  { name: 'MINUTETICKS', signature: 'MINUTETICKS(minutes)', detail: 'Converts minutes to ticks.', minArgs: 1, maxArgs: 1,
    returns: 'ticks',
    params: [{ name: 'minutes', type: 'number' }]
  },
  { name: 'DATETIME', signature: 'DATETIME(ticks)', detail: 'Converts ticks to datetime.', minArgs: 1, maxArgs: 1,
    returns: 'datetime',
    params: [{ name: 'ticks', type: 'ticks' }]
  },
  { name: 'ISO8601DATETIME', signature: 'ISO8601DATETIME(ticks)', detail: 'Converts ticks to an ISO8601 datetime string.', minArgs: 1, maxArgs: 1,
    returns: 'iso8601_datetime',
    params: [{ name: 'ticks', type: 'ticks' }]
  },
  { name: 'ISO8601DATE', signature: 'ISO8601DATE(ticks)', detail: 'Converts ticks to an ISO8601 date string.', minArgs: 1, maxArgs: 1,
    returns: 'iso8601_date',
    params: [{ name: 'ticks', type: 'ticks' }]
  },
  { name: 'ISO8601TIME', signature: 'ISO8601TIME(ticks)', detail: 'Converts ticks to an ISO8601 time string.', minArgs: 1, maxArgs: 1,
    returns: 'iso8601_time',
    params: [{ name: 'ticks', type: 'ticks' }]
  },
  { name: 'FORMATDATETIME', signature: 'FORMATDATETIME(ticks, format, [language])', detail: 'Returns a formatted date. Ex: FORMATDATETIME(NOWTICKS(), "D", "en-us") returns "Thursday, October 6, 2016".', minArgs: 2, maxArgs: 3,
    returns: 'text',
    params: [
      { name: 'ticks', type: 'ticks' },
      { name: 'format', type: 'text' },
      { name: 'language', type: 'text', optional: true }
    ]
  },
  { name: 'WEEKNUM', signature: 'WEEKNUM(ticks)', detail: 'Returns the week number of the year that includes the date in the specified datetime value represented by ticks.', minArgs: 1, maxArgs: 1,
    returns: 'integer',
    params: [{ name: 'ticks', type: 'ticks' }]
  },
  { name: 'DAYS', signature: 'DAYS(end_date, start_date)', detail: 'Returns the number of days between two dates.', minArgs: 2, maxArgs: 2,
    returns: 'integer',
    params: [
      { name: 'end_date', type: 'ticks' },
      { name: 'start_date', type: 'ticks' }
    ]
  },
  { name: 'HOURS', signature: 'HOURS(end_date, start_date)', detail: 'Returns the number of hours between two dates.', minArgs: 2, maxArgs: 2,
    returns: 'integer',
    params: [
      { name: 'end_date', type: 'ticks' },
      { name: 'start_date', type: 'ticks' }
    ]
  },
  { name: 'WEEKS', signature: 'WEEKS(end_date, start_date)', detail: 'Returns the number of weeks between two dates.', minArgs: 2, maxArgs: 2,
    returns: 'integer',
    params: [
      { name: 'end_date', type: 'ticks' },
      { name: 'start_date', type: 'ticks' }
    ]
  },
  { name: 'MONTH', signature: 'MONTH(ticks)', detail: 'Returns the month of a date represented as ticks. The month is returned as an integer from 1 (January) to 12 (December).', minArgs: 1, maxArgs: 1,
    returns: 'integer',
    params: [{ name: 'ticks', type: 'ticks' }]
  },
  { name: 'YEAR', signature: 'YEAR(ticks)', detail: 'Returns the year of a date represented by ticks. The year is returned as an integer in the range 0001-9999.', minArgs: 1, maxArgs: 1,
    returns: 'integer',
    params: [{ name: 'ticks', type: 'ticks' }]
  },

  // === Validation and Check Functions ===
  { name: 'ISBLANK', signature: 'ISBLANK(value)', detail: 'Checks whether a text string is empty or not. Returns true if empty, false if not.', minArgs: 1, maxArgs: 1,
    returns: 'boolean',
    params: [{ name: 'value', type: 'any' }]
  },
  { name: 'ISNUMBER', signature: 'ISNUMBER(value)', detail: 'Checks whether a value is a number or not. Returns true if number, false if not.', minArgs: 1, maxArgs: 1,
    returns: 'boolean',
    params: [{ name: 'value', type: 'any' }]
  },
  { name: 'ISNULL', signature: 'ISNULL(value)', detail: 'Checks whether the value is NULL. Returns true if NULL, false if not.', minArgs: 1, maxArgs: 1,
    returns: 'boolean',
    params: [{ name: 'value', type: 'any' }]
  },
  { name: 'IFNULL', signature: 'IFNULL(expression, value_if_null)', detail: 'Checks if an expression is NULL, returns the result if not, or returns the expression you specify if NULL.', minArgs: 2, maxArgs: 2,
    returns: 'any',
    params: [
      { name: 'expression', type: 'any' },
      { name: 'value_if_null', type: 'any' }
    ]
  },
  { name: 'NULL', signature: 'NULL()', detail: 'Returns NULL.', minArgs: 0, maxArgs: 0,
    returns: 'null', params: []
  },
  { name: 'MATCHES', signature: 'MATCHES(regex, calcId)', detail: 'Allows you to specify exactly which characters you want to allow the user to enter in a field.', minArgs: 2, maxArgs: 2,
    returns: 'boolean',
    params: [
      { name: 'regex', type: 'text' },
      { name: 'calcId', type: 'text' }
    ]
  },

  // === Template Functions ===
  { name: 'TEMPLATEVARIABLE', signature: 'TEMPLATEVARIABLE("template_variable")', detail: 'Takes a template variable and displays it in the form. Ex: "Patient.FirstName".', minArgs: 1, maxArgs: 1,
    returns: 'any',
    params: [{ name: 'template_variable', type: 'text' }]
  },

  // === Statistical Functions ===
  { name: 'AVERAGE', signature: 'AVERAGE(number1, [number2], ...)', detail: 'Returns the average of the arguments.', minArgs: 1, maxArgs: '*',
    returns: 'number',
    params: [{ name: 'number1', type: 'number' }, { name: 'number2', type: 'number', optional: true }]
  },
  { name: 'AVERAGEA', signature: 'AVERAGEA(value1, [value2], ...)', detail: 'Returns the average of the arguments, including numbers, text, and logical values.', minArgs: 1, maxArgs: '*',
    returns: 'number',
    params: [{ name: 'value1', type: 'any' }, { name: 'value2', type: 'any', optional: true }]
  },
  { name: 'COUNT', signature: 'COUNT(value1, [value2], ...)', detail: 'Counts how many numbers are in the argument list.', minArgs: 1, maxArgs: '*',
    returns: 'integer',
    params: [{ name: 'value1', type: 'any' }, { name: 'value2', type: 'any', optional: true }]
  },
  { name: 'COUNTA', signature: 'COUNTA(value1, [value2], ...)', detail: 'Counts the number of non-empty values in a range.', minArgs: 1, maxArgs: '*',
    returns: 'integer',
    params: [{ name: 'value1', type: 'any' }, { name: 'value2', type: 'any', optional: true }]
  },
  { name: 'COUNTBLANK', signature: 'COUNTBLANK(value1, [value2], ...)', detail: 'Counts empty values in a specified range of values.', minArgs: 1, maxArgs: '*',
    returns: 'integer',
    params: [{ name: 'value1', type: 'any' }, { name: 'value2', type: 'any', optional: true }]
  },
  { name: 'COUNTIF', signature: 'COUNTIF(value1, [value2], ..., criteria)', detail: 'Counts the number of values within a range that satisfy a single criterion you specify.', minArgs: 2, maxArgs: '*',
    returns: 'integer',
    params: [{ name: 'value1', type: 'any' }, { name: 'value2', type: 'any', optional: true }, { name: 'criteria', type: 'text' }]
  },
  { name: 'MAX', signature: 'MAX(number1, [number2], ...)', detail: 'Returns the maximum value in an argument list.', minArgs: 1, maxArgs: '*',
    returns: 'number',
    params: [{ name: 'number1', type: 'number' }, { name: 'number2', type: 'number', optional: true }]
  },
  { name: 'MAXA', signature: 'MAXA(value1, [value2], ...)', detail: 'Returns the maximum value in an argument list, including numbers, text, and logical values.', minArgs: 1, maxArgs: '*',
    returns: 'number',
    params: [{ name: 'value1', type: 'any' }, { name: 'value2', type: 'any', optional: true }]
  },
  { name: 'MIN', signature: 'MIN(number1, [number2], ...)', detail: 'Returns the minimum value in an argument list.', minArgs: 1, maxArgs: '*',
    returns: 'number',
    params: [{ name: 'number1', type: 'number' }, { name: 'number2', type: 'number', optional: true }]
  },
  { name: 'MINA', signature: 'MINA(value1, [value2], ...)', detail: 'Returns the minimum value in an argument list, including numbers, text, and logical values.', minArgs: 1, maxArgs: '*',
    returns: 'number',
    params: [{ name: 'value1', type: 'any' }, { name: 'value2', type: 'any', optional: true }]
  },
  { name: 'STDEV', signature: 'STDEV(number1, [number2], ...)', detail: 'Estimates standard deviation based on a sample.', minArgs: 1, maxArgs: '*',
    returns: 'number',
    params: [{ name: 'number1', type: 'number' }, { name: 'number2', type: 'number', optional: true }]
  },
  { name: 'STDEVA', signature: 'STDEVA(value1, [value2], ...)', detail: 'Estimates standard deviation based on a sample, including text and logical values.', minArgs: 1, maxArgs: '*',
    returns: 'number',
    params: [{ name: 'value1', type: 'any' }, { name: 'value2', type: 'any', optional: true }]
  },
  { name: 'STDEVP', signature: 'STDEVP(number1, [number2], ...)', detail: 'Calculates standard deviation based on the entire population given as arguments.', minArgs: 1, maxArgs: '*',
    returns: 'number',
    params: [{ name: 'number1', type: 'number' }, { name: 'number2', type: 'number', optional: true }]
  },
  { name: 'STDEVPA', signature: 'STDEVPA(value1, [value2], ...)', detail: 'Calculates standard deviation based on the entire population, including text and logical values.', minArgs: 1, maxArgs: '*',
    returns: 'number',
    params: [{ name: 'value1', type: 'any' }, { name: 'value2', type: 'any', optional: true }]
  },
  { name: 'VAR', signature: 'VAR(number1, [number2], ...)', detail: 'Estimates variance based on a sample.', minArgs: 1, maxArgs: '*',
    returns: 'number',
    params: [{ name: 'number1', type: 'number' }, { name: 'number2', type: 'number', optional: true }]
  },
  { name: 'VARA', signature: 'VARA(value1, [value2], ...)', detail: 'Estimates variance based on a sample, including text and logical values.', minArgs: 1, maxArgs: '*',
    returns: 'number',
    params: [{ name: 'value1', type: 'any' }, { name: 'value2', type: 'any', optional: true }]
  },
  { name: 'VARP', signature: 'VARP(number1, [number2], ...)', detail: 'Calculates variance based on the entire population.', minArgs: 1, maxArgs: '*',
    returns: 'number',
    params: [{ name: 'number1', type: 'number' }, { name: 'number2', type: 'number', optional: true }]
  },
  { name: 'VARPA', signature: 'VARPA(value1, [value2], ...)', detail: 'Calculates variance based on the entire population, including text and logical values.', minArgs: 1, maxArgs: '*',
    returns: 'number',
    params: [{ name: 'value1', type: 'any' }, { name: 'value2', type: 'any', optional: true }]
  },

  // === Text Functions ===
  { name: 'CHAR', signature: 'CHAR(number)', detail: 'Returns the character corresponding to the code number.', minArgs: 1, maxArgs: 1,
    returns: 'text',
    params: [{ name: 'number', type: 'integer' }]
  },
  { name: 'CODE', signature: 'CODE(text)', detail: 'Returns a numeric code for the first character in a text string.', minArgs: 1, maxArgs: 1,
    returns: 'integer',
    params: [{ name: 'text', type: 'text' }]
  },
  { name: 'CONCATENATE', signature: 'CONCATENATE(text1, [text2], ...)', detail: 'Joins up to 255 text strings into one text string.', minArgs: 1, maxArgs: 255,
    returns: 'text',
    params: [{ name: 'text1', type: 'text' }, { name: 'text2', type: 'text', optional: true }]
  },
  { name: 'FIND', signature: 'FIND(find_text, within_text, [start_position])', detail: 'Finds one text string inside another text string and returns the starting position.', minArgs: 2, maxArgs: 3,
    returns: 'integer',
    params: [
      { name: 'find_text', type: 'text' },
      { name: 'within_text', type: 'text' },
      { name: 'start_position', type: 'integer', optional: true }
    ]
  },
  { name: 'LEFT', signature: 'LEFT(text, num_chars)', detail: 'Returns the first character or characters in a text string.', minArgs: 2, maxArgs: 2,
    returns: 'text',
    params: [
      { name: 'text', type: 'text' },
      { name: 'num_chars', type: 'integer' }
    ]
  },
  { name: 'LEN', signature: 'LEN(text)', detail: 'Returns the number of characters in a text string.', minArgs: 1, maxArgs: 1,
    returns: 'integer',
    params: [{ name: 'text', type: 'text' }]
  },
  { name: 'LOWER', signature: 'LOWER(text)', detail: 'Converts uppercase letters to lowercase.', minArgs: 1, maxArgs: 1,
    returns: 'text',
    params: [{ name: 'text', type: 'text' }]
  },
  { name: 'MID', signature: 'MID(text, start_position, num_chars)', detail: 'Returns a specified number of characters from a text string, starting from the position you specify.', minArgs: 3, maxArgs: 3,
    returns: 'text',
    params: [
      { name: 'text', type: 'text' },
      { name: 'start_position', type: 'integer' },
      { name: 'num_chars', type: 'integer' }
    ]
  },
  { name: 'PROPER', signature: 'PROPER(text)', detail: 'Capitalizes the first letter in a text string and converts the rest to lowercase.', minArgs: 1, maxArgs: 1,
    returns: 'text',
    params: [{ name: 'text', type: 'text' }]
  },
  { name: 'REPLACE', signature: 'REPLACE(old_text, start_position, num_chars, new_text)', detail: 'Replaces part of a text string, based on the number of characters you specify, with a new text.', minArgs: 4, maxArgs: 4,
    returns: 'text',
    params: [
      { name: 'old_text', type: 'text' },
      { name: 'start_position', type: 'integer' },
      { name: 'num_chars', type: 'integer' },
      { name: 'new_text', type: 'text' }
    ]
  },
  { name: 'REPT', signature: 'REPT(text, number_times)', detail: 'Repeats text a given number of times.', minArgs: 2, maxArgs: 2,
    returns: 'text',
    params: [
      { name: 'text', type: 'text' },
      { name: 'number_times', type: 'integer' }
    ]
  },
  { name: 'RIGHT', signature: 'RIGHT(text, num_chars)', detail: 'Returns the last characters in a text string, based on the number of characters you specify.', minArgs: 2, maxArgs: 2,
    returns: 'text',
    params: [
      { name: 'text', type: 'text' },
      { name: 'num_chars', type: 'integer' }
    ]
  },
  { name: 'SEARCH', signature: 'SEARCH(find_text, within_text, [start_position])', detail: 'Finds one text value within another (case-insensitive).', minArgs: 2, maxArgs: 3,
    returns: 'integer',
    params: [
      { name: 'find_text', type: 'text' },
      { name: 'within_text', type: 'text' },
      { name: 'start_position', type: 'integer', optional: true }
    ]
  },
  { name: 'SUBSTITUTE', signature: 'SUBSTITUTE(text, old_text, new_text, [instance_num])', detail: 'Substitutes old_text with new_text in a text string.', minArgs: 3, maxArgs: 4,
    returns: 'text',
    params: [
      { name: 'text', type: 'text' },
      { name: 'old_text', type: 'text' },
      { name: 'new_text', type: 'text' },
      { name: 'instance_num', type: 'integer', optional: true }
    ]
  },
  { name: 'T', signature: 'T(value)', detail: 'Returns the text referred to by value.', minArgs: 1, maxArgs: 1,
    returns: 'text',
    params: [{ name: 'value', type: 'any' }]
  },
  { name: 'TEXT', signature: 'TEXT(value, [format_text])', detail: 'Converts a numeric value to text and lets you specify the display formatting.', minArgs: 1, maxArgs: 2,
    returns: 'text',
    params: [
      { name: 'value', type: 'number' },
      { name: 'format_text', type: 'text', optional: true }
    ]
  },
  { name: 'TRIM', signature: 'TRIM(text)', detail: 'Removes all spaces from text except for single spaces between words.', minArgs: 1, maxArgs: 1,
    returns: 'text',
    params: [{ name: 'text', type: 'text' }]
  },
  { name: 'UPPER', signature: 'UPPER(text)', detail: 'Converts text to uppercase.', minArgs: 1, maxArgs: 1,
    returns: 'text',
    params: [{ name: 'text', type: 'text' }]
  },
  { name: 'VALUE', signature: 'VALUE(text)', detail: 'Converts a text string representing a number to a number.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [{ name: 'text', type: 'text' }]
  },

  // === Lookup and Reference Functions ===
  { name: 'CHOOSE', signature: 'CHOOSE(index, value1, [value2], ...)', detail: 'Uses index to return a value from the list of arguments. Ex: CHOOSE(2, "a", "b", "c") returns "b".', minArgs: 2, maxArgs: '*',
    returns: 'any',
    params: [
      { name: 'index', type: 'integer' },
      { name: 'value1', type: 'any' },
      { name: 'value2', type: 'any', optional: true }
    ]
  },
  { name: 'ANY', signature: 'ANY(type, find_text, within_text1, [within_text2], ...)', detail: 'Returns a value indicating whether a specified substring occurs within this string or one or more strings in a list. type = [startswith, endswith, equals, contains]', minArgs: 3, maxArgs: '*',
    returns: 'boolean',
    params: [
      { name: 'type', type: 'text' },
      { name: 'find_text', type: 'text' },
      { name: 'within_text1', type: 'text' },
      { name: 'within_text2', type: 'text', optional: true }
    ]
  },
  { name: 'ALL', signature: 'ALL(type, find_text, within_text1, [within_text2], ...)', detail: 'Returns a value indicating whether a specified substring occurs within this string or within every string in a list. type = [startswith, endswith, equals, contains]', minArgs: 3, maxArgs: '*',
    returns: 'boolean',
    params: [
      { name: 'type', type: 'text' },
      { name: 'find_text', type: 'text' },
      { name: 'within_text1', type: 'text' },
      { name: 'within_text2', type: 'text', optional: true }
    ]
  },

  // === Mathematical Functions ===
  { name: 'ABS', signature: 'ABS(number)', detail: 'Returns the absolute value of a number.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [{ name: 'number', type: 'number' }]
  },
  { name: 'ACOS', signature: 'ACOS(number)', detail: 'Returns the arccosine of a number.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [{ name: 'number', type: 'number' }]
  },
  { name: 'ASIN', signature: 'ASIN(number)', detail: 'Returns the arcsine of a number.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [{ name: 'number', type: 'number' }]
  },
  { name: 'ATAN', signature: 'ATAN(number)', detail: 'Returns the arctangent of a number.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [{ name: 'number', type: 'number' }]
  },
  { name: 'ATAN2', signature: 'ATAN2(x_num, y_num)', detail: 'Returns the arctangent from x and y coordinates.', minArgs: 2, maxArgs: 2,
    returns: 'number',
    params: [
      { name: 'x_num', type: 'number' },
      { name: 'y_num', type: 'number' }
    ]
  },
  { name: 'CEILING', signature: 'CEILING(number, significance)', detail: 'Rounds a number up, away from zero.', minArgs: 2, maxArgs: 2,
    returns: 'number',
    params: [
      { name: 'number', type: 'number' },
      { name: 'significance', type: 'number' }
    ]
  },
  { name: 'COS', signature: 'COS(number)', detail: 'Returns the cosine of a given angle.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [{ name: 'number', type: 'number' }]
  },
  { name: 'COSH', signature: 'COSH(number)', detail: 'Returns the hyperbolic cosine of a number.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [{ name: 'number', type: 'number' }]
  },
  { name: 'EXP', signature: 'EXP(number)', detail: 'Returns e raised to the power of a given number.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [{ name: 'number', type: 'number' }]
  },
  { name: 'FLOOR', signature: 'FLOOR(number, significance)', detail: 'Rounds a number down, toward zero.', minArgs: 2, maxArgs: 2,
    returns: 'number',
    params: [
      { name: 'number', type: 'number' },
      { name: 'significance', type: 'number' }
    ]
  },
  { name: 'INT', signature: 'INT(number)', detail: 'Rounds a number down to the nearest integer.', minArgs: 1, maxArgs: 1,
    returns: 'integer',
    params: [{ name: 'number', type: 'number' }]
  },
  { name: 'LN', signature: 'LN(number)', detail: 'Returns the natural logarithm of a number.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [{ name: 'number', type: 'number' }]
  },
  { name: 'LOG', signature: 'LOG(number, [base])', detail: 'Returns the logarithm of a number to a specified base.', minArgs: 1, maxArgs: 2,
    returns: 'number',
    params: [
      { name: 'number', type: 'number' },
      { name: 'base', type: 'number', optional: true }
    ]
  },
  { name: 'LOG10', signature: 'LOG10(number)', detail: 'Returns the base-10 logarithm of a number.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [{ name: 'number', type: 'number' }]
  },
  { name: 'PI', signature: 'PI()', detail: 'Returns the number 3.14159265358979, the mathematical constant pi.', minArgs: 0, maxArgs: 0,
    returns: 'number', params: []
  },
  { name: 'POWER', signature: 'POWER(number, power)', detail: 'Returns the result of a number raised to a power.', minArgs: 2, maxArgs: 2,
    returns: 'number',
    params: [
      { name: 'number', type: 'number' },
      { name: 'power', type: 'number' }
    ]
  },
  { name: 'RAND', signature: 'RAND()', detail: 'Returns a random number between 0 and 1.', minArgs: 0, maxArgs: 0,
    returns: 'number', params: []
  },
  { name: 'RANDBETWEEN', signature: 'RANDBETWEEN(bottom, top)', detail: 'Returns a random integer between the numbers you specify.', minArgs: 2, maxArgs: 2,
    returns: 'integer',
    params: [
      { name: 'bottom', type: 'integer' },
      { name: 'top', type: 'integer' }
    ]
  },
  { name: 'ROUND', signature: 'ROUND(number, [num_digits])', detail: 'Rounds a number to a specified number of digits.', minArgs: 1, maxArgs: 2,
    returns: 'number',
    params: [
      { name: 'number', type: 'number' },
      { name: 'num_digits', type: 'integer', optional: true }
    ]
  },
  { name: 'SIGN', signature: 'SIGN(number)', detail: 'Determines the sign of a number. Returns 1 if positive, 0 if zero, and -1 if negative.', minArgs: 1, maxArgs: 1,
    returns: 'integer',
    params: [{ name: 'number', type: 'number' }]
  },
  { name: 'SIN', signature: 'SIN(number)', detail: 'Returns the sine of a given angle.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [{ name: 'number', type: 'number' }]
  },
  { name: 'SINH', signature: 'SINH(number)', detail: 'Returns the hyperbolic sine of a number.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [{ name: 'number', type: 'number' }]
  },
  { name: 'SQRT', signature: 'SQRT(number)', detail: 'Returns a positive square root.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [{ name: 'number', type: 'number' }]
  },
  { name: 'SUM', signature: 'SUM(number1, [number2], ...)', detail: 'Adds all the numbers you specify as arguments.', minArgs: 1, maxArgs: '*',
    returns: 'number',
    params: [{ name: 'number1', type: 'number' }, { name: 'number2', type: 'number', optional: true }]
  },
  { name: 'TAN', signature: 'TAN(number)', detail: 'Returns the tangent of a given angle.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [{ name: 'number', type: 'number' }]
  },
  { name: 'TANH', signature: 'TANH(number)', detail: 'Returns the hyperbolic tangent of a number.', minArgs: 1, maxArgs: 1,
    returns: 'number',
    params: [{ name: 'number', type: 'number' }]
  },
  { name: 'TRUNC', signature: 'TRUNC(number, num_digits)', detail: 'Truncates a number to an integer by removing the fractional part of the number.', minArgs: 2, maxArgs: 2,
    returns: 'number',
    params: [
      { name: 'number', type: 'number' },
      { name: 'num_digits', type: 'integer' }
    ]
  },

  // === Logical Functions ===
  { name: 'AND', signature: 'AND(logical1, [logical2], ...)', detail: 'Returns TRUE if all arguments are true.', minArgs: 1, maxArgs: '*',
    returns: 'boolean',
    params: [{ name: 'logical1', type: 'boolean' }, { name: 'logical2', type: 'boolean', optional: true }]
  },
  { name: 'OR', signature: 'OR(logical1, [logical2], ...)', detail: 'Returns TRUE if any argument is true.', minArgs: 1, maxArgs: '*',
    returns: 'boolean',
    params: [{ name: 'logical1', type: 'boolean' }, { name: 'logical2', type: 'boolean', optional: true }]
  },
  { name: 'NOT', signature: 'NOT(logical)', detail: 'Reverses the logic of its argument.', minArgs: 1, maxArgs: 1,
    returns: 'boolean',
    params: [{ name: 'logical', type: 'boolean' }]
  },
  { name: 'IF', signature: 'IF(logical_test, value_if_true, [value_if_false])', detail: 'Specifies a logical test to perform.', minArgs: 2, maxArgs: 3,
    returns: 'any',
    params: [
      { name: 'logical_test', type: 'boolean' },
      { name: 'value_if_true', type: 'any' },
      { name: 'value_if_false', type: 'any', optional: true }
    ]
  },
  { name: 'TRUE', signature: 'TRUE()', detail: 'Returns the logical value TRUE.', minArgs: 0, maxArgs: 0,
    returns: 'boolean', params: []
  },
  { name: 'FALSE', signature: 'FALSE()', detail: 'Returns the logical value FALSE.', minArgs: 0, maxArgs: 0,
    returns: 'boolean', params: []
  }
];

module.exports = FUNCTION_ITEMS;
