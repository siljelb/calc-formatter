/**
 * FORMAT_DURATION custom function.
 * Formats an ISO8601 duration string using .NET TimeSpan format strings.
 * Output uses Norwegian Bokmål (nb-NO) conventions.
 * 
 * Standard format strings:
 * - "c" or "C" = Constant format: [-][d.]hh:mm:ss[.fffffff]
 * - "g" = General short: [-][d:]h:mm:ss[.FFFFFFF]
 * - "G" = General long: [-]d:hh:mm:ss.fffffff
 * - "no-short" = Norwegian short: "X dager Y timer" or "Y timer Z minutter"
 * - "no-long" = Norwegian long: "X dager, Y timer, Z minutter"
 * - "no-compact" = Norwegian compact: "Xd Yt Zm"
 * 
 * Custom format strings support:
 * - "d", "dd", "ddddd..." = Days (dager)
 * - "h", "hh" = Hours (timer, 0-23)
 * - "m", "mm" = Minutes (minutter, 0-59)
 * - "s", "ss" = Seconds (sekunder, 0-59)
 * 
 * Examples:
 * - FORMAT_DURATION("P1DT2H30M", "c") -> "1.02:30:00"
 * - FORMAT_DURATION("P1DT2H30M", "no-short") -> "1 dag 2 timer"
 * - FORMAT_DURATION("PT2H30M", "h' timer 'm' minutter'") -> "2 timer 30 minutter"
 * - FORMAT_DURATION("P45D", "d' dager'") -> "45 dager"
 */

module.exports = {
  name: 'FORMAT_DURATION',
  signature: 'FORMAT_DURATION(duration_string, format_string)',
  detail: 'Formats an ISO8601 duration using .NET TimeSpan format strings with Norwegian (nb-NO) conventions. Supports standard formats (c, g, G, no-short, no-long, no-compact) and custom formats (d, h, m, s).',
  minArgs: 2,
  maxArgs: 2,
  returns: 'text',
  params: [
    { name: 'duration_string', type: 'iso8601_duration' },
    { name: 'format_string', type: 'text' }
  ],
  expansion: `IF(
  {format_string} = "g",
  CONCATENATE(
    IF(DURATION_TO_DAYS({duration_string}) > 0, CONCATENATE(TEXT(DURATION_TO_DAYS({duration_string}), "0"), ":"), ""),
    TEXT(DURATION_TO_HOURS({duration_string}) - (DURATION_TO_DAYS({duration_string}) * 24), "0"),
    ":",
    TEXT(DURATION_TO_MINUTES({duration_string}) - (DURATION_TO_HOURS({duration_string}) * 60), "00"),
    ":",
    TEXT(DURATION_TO_SECONDS({duration_string}) - (DURATION_TO_MINUTES({duration_string}) * 60), "00")
  ),
  IF(
    {format_string} = "G",
    CONCATENATE(
      TEXT(DURATION_TO_DAYS({duration_string}), "0"),
      ":",
      TEXT(DURATION_TO_HOURS({duration_string}) - (DURATION_TO_DAYS({duration_string}) * 24), "00"),
      ":",
      TEXT(DURATION_TO_MINUTES({duration_string}) - (DURATION_TO_HOURS({duration_string}) * 60), "00"),
      ":",
      TEXT(DURATION_TO_SECONDS({duration_string}) - (DURATION_TO_MINUTES({duration_string}) * 60), "00")
    ),
    IF(
      {format_string} = "c",
      CONCATENATE(
        IF(DURATION_TO_DAYS({duration_string}) > 0, CONCATENATE(TEXT(DURATION_TO_DAYS({duration_string}), "0"), "."), ""),
        TEXT(DURATION_TO_HOURS({duration_string}) - (DURATION_TO_DAYS({duration_string}) * 24), "00"),
        ":",
        TEXT(DURATION_TO_MINUTES({duration_string}) - (DURATION_TO_HOURS({duration_string}) * 60), "00"),
        ":",
        TEXT(DURATION_TO_SECONDS({duration_string}) - (DURATION_TO_MINUTES({duration_string}) * 60), "00")
      ),
      IF(
        {format_string} = "no-short",
        CONCATENATE(
          IF(DURATION_TO_DAYS({duration_string}) > 0, CONCATENATE(TEXT(DURATION_TO_DAYS({duration_string}), "0"), IF(DURATION_TO_DAYS({duration_string}) = 1, " dag ", " dager "), ""), ""),
          IF((DURATION_TO_HOURS({duration_string}) - (DURATION_TO_DAYS({duration_string}) * 24)) > 0, CONCATENATE(TEXT(DURATION_TO_HOURS({duration_string}) - (DURATION_TO_DAYS({duration_string}) * 24), "0"), IF((DURATION_TO_HOURS({duration_string}) - (DURATION_TO_DAYS({duration_string}) * 24)) = 1, " time", " timer"), ""), ""),
          IF(((DURATION_TO_MINUTES({duration_string}) - (DURATION_TO_HOURS({duration_string}) * 60)) > 0) AND (DURATION_TO_DAYS({duration_string}) = 0), CONCATENATE(IF((DURATION_TO_HOURS({duration_string}) - (DURATION_TO_DAYS({duration_string}) * 24)) > 0, " ", ""), TEXT(DURATION_TO_MINUTES({duration_string}) - (DURATION_TO_HOURS({duration_string}) * 60), "0"), IF((DURATION_TO_MINUTES({duration_string}) - (DURATION_TO_HOURS({duration_string}) * 60)) = 1, " minutt", " minutter")), "")
        ),
        IF(
          {format_string} = "no-long",
          CONCATENATE(
            IF(DURATION_TO_DAYS({duration_string}) > 0, CONCATENATE(TEXT(DURATION_TO_DAYS({duration_string}), "0"), IF(DURATION_TO_DAYS({duration_string}) = 1, " dag", " dager"), ""), ""),
            IF((DURATION_TO_HOURS({duration_string}) - (DURATION_TO_DAYS({duration_string}) * 24)) > 0, CONCATENATE(IF(DURATION_TO_DAYS({duration_string}) > 0, ", ", ""), TEXT(DURATION_TO_HOURS({duration_string}) - (DURATION_TO_DAYS({duration_string}) * 24), "0"), IF((DURATION_TO_HOURS({duration_string}) - (DURATION_TO_DAYS({duration_string}) * 24)) = 1, " time", " timer")), ""),
            IF((DURATION_TO_MINUTES({duration_string}) - (DURATION_TO_HOURS({duration_string}) * 60)) > 0, CONCATENATE(IF((DURATION_TO_DAYS({duration_string}) > 0) OR ((DURATION_TO_HOURS({duration_string}) - (DURATION_TO_DAYS({duration_string}) * 24)) > 0), ", ", ""), TEXT(DURATION_TO_MINUTES({duration_string}) - (DURATION_TO_HOURS({duration_string}) * 60), "0"), IF((DURATION_TO_MINUTES({duration_string}) - (DURATION_TO_HOURS({duration_string}) * 60)) = 1, " minutt", " minutter")), "")
          ),
          IF(
            {format_string} = "no-compact",
            CONCATENATE(
              IF(DURATION_TO_DAYS({duration_string}) > 0, CONCATENATE(TEXT(DURATION_TO_DAYS({duration_string}), "0"), "d "), ""),
              IF((DURATION_TO_HOURS({duration_string}) - (DURATION_TO_DAYS({duration_string}) * 24)) > 0, CONCATENATE(TEXT(DURATION_TO_HOURS({duration_string}) - (DURATION_TO_DAYS({duration_string}) * 24), "0"), "t "), ""),
              IF((DURATION_TO_MINUTES({duration_string}) - (DURATION_TO_HOURS({duration_string}) * 60)) > 0, CONCATENATE(TEXT(DURATION_TO_MINUTES({duration_string}) - (DURATION_TO_HOURS({duration_string}) * 60), "0"), "m"), "")
            ),
            SUBSTITUTE(
              SUBSTITUTE(
                SUBSTITUTE(
                  SUBSTITUTE(
                    SUBSTITUTE(
                      SUBSTITUTE(
                        SUBSTITUTE(
                          SUBSTITUTE({format_string},
                            "dd", TEXT(DURATION_TO_DAYS({duration_string}), "00")),
                          "d", TEXT(DURATION_TO_DAYS({duration_string}), "0")),
                        "hh", TEXT(DURATION_TO_HOURS({duration_string}) - (DURATION_TO_DAYS({duration_string}) * 24), "00")),
                      "h", TEXT(DURATION_TO_HOURS({duration_string}) - (DURATION_TO_DAYS({duration_string}) * 24), "0")),
                    "mm", TEXT(DURATION_TO_MINUTES({duration_string}) - (DURATION_TO_HOURS({duration_string}) * 60), "00")),
                  "m", TEXT(DURATION_TO_MINUTES({duration_string}) - (DURATION_TO_HOURS({duration_string}) * 60), "0")),
                "ss", TEXT(DURATION_TO_SECONDS({duration_string}) - (DURATION_TO_MINUTES({duration_string}) * 60), "00")),
              "s", TEXT(DURATION_TO_SECONDS({duration_string}) - (DURATION_TO_MINUTES({duration_string}) * 60), "0"))
          )
        )
      )
    )
  )
)`
};


