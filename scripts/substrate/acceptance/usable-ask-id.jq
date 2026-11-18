# The known-answer ask a substrate-status --json verdict's usable level last polled (its ask_id field), whether the
# levels are a list of {level, ...} or an object keyed by level; empty when it names none.
[.levels | if type == "array" then .[] else to_entries[] | .value + {level: .key} end
  | select(.level == "usable") | .ask_id | strings] | .[0] // ""
