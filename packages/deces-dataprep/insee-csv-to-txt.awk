# Converts an INSEE monthly deaths CSV (Deces_YYYY_Mmm.csv, ';'-separated,
# double-quoted) into the fixed-width deces-YYYY-mmm.txt layout data.gouv
# publishes: 80|1|8|5|30|30|8|5|9 then 22 spaces, 198 characters per line.
#
# Run with LC_ALL=C: widths are counted in UTF-8 characters, as data.gouv does,
# by subtracting continuation bytes, which keeps the script portable to mawk.
# Validated byte for byte against data.gouv deces-2026-m08.txt.

function chars(s,  t) { t = s; return length(s) - gsub(/[\200-\277]/, "", t) }

function pad(s, width,  c) {
  c = chars(s)
  if (c > width) { fail("field longer than " width " characters: " s) }
  return s sprintf("%" (width - c) "s", "")
}

function fail(msg) { print FILENAME ":" NR ": " msg > "/dev/stderr"; failed = 1 }

BEGIN {
  split("80 1 8 5 30 30 8 5 9", width, " ")
  header = "\"nomprenom\";\"sexe\";\"datenaiss\";\"lieunaiss\";\"commnaiss\";\"paysnaiss\";\"datedeces\";\"lieudeces\";\"actedeces\""
}

{ sub(/\r$/, "") }

NR == 1 {
  if ($0 != header) { fail("unexpected header: " $0); exit }
  next
}

{
  n = 0; field = ""; quoted = 0
  for (i = 1; i <= length($0); i++) {
    c = substr($0, i, 1)
    if (quoted) {
      if (c != "\"") field = field c
      else if (substr($0, i + 1, 1) == "\"") { field = field "\""; i++ }
      else quoted = 0
    }
    else if (c == "\"") quoted = 1
    else if (c == ";") { f[++n] = field; field = "" }
    else field = field c
  }
  f[++n] = field
  if (n != 9) { fail(n " fields instead of 9"); next }
  line = ""
  for (k = 1; k <= 9; k++) line = line pad(f[k], width[k])
  printf "%s%22s\n", line, ""
}

END { if (failed) exit 1 }
