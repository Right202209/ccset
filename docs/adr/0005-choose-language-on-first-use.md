# Choose the UI language on first use

Accepted. Ask once in a bilingual TUI prompt and retain the choice in `<home>/.ccset/settings.json`; this remains explicit preference, not `LANG`/`LC_ALL` inference. TUI order: invocation `CCSET_LOCALE` → saved choice → prompt. Any set value other than `zh-Hans`, including empty, explicitly selects English and suppresses prompting/persistence. Commands use the override or English.

Help/version finish before settings or Ink; TUI non-TTY stdin exits 2. Cancel creates no preference; failed persistence warns but retains the session choice. The locale must be settled before App mounts because translation uses module-global state.

Settings are private, atomic and scratch-home aware. Unknown/invalid locale shapes trigger a new choice; known schema fields include other Agents' ignore lists and must survive writes. `verify:first-run-locale` and `verify:i18n-zh` pin these boundaries. There is no CLI in-session language switcher; the website has independent browser preferences (ADR 0015).
