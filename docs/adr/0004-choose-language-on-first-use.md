# Choose the UI language on first use

PRD §5.5 made the interface language an explicit `CCSET_LOCALE` opt-in resolved
at the cli.tsx boundary and shipped v1 with no locale detection; the README
states the companion promise that ccset never inspects the environment to pick
a language. That promise stays. But an env var is a poor first experience: the
user most likely to need zh-Hans meets an English interface on their first run,
before they know the variable exists. Asking them — once, interactively, and
remembering the answer — is still an explicit choice by the standard the PRD
set ("a user who wants Chinese says so"); it only moves where they say it. This
ADR proposes that change: a first-run language prompt, persisted, with
`CCSET_LOCALE` remaining the override for scripts and CI.

The resolution order is: `CCSET_LOCALE` when set; otherwise a locale saved by a
previous run; otherwise the first-run prompt; otherwise `'en'`. When
`CCSET_LOCALE` is set, ccset neither prompts nor persists — the variable is a
per-invocation statement, and reading a durable preference out of it would turn
one scripted run into a silent permanent switch. A non-TTY first run can never
be asked (the TTY guard refuses before any prompt), so it runs in English and
the question waits for the next interactive run. The prompt runs regardless of
`--agent`, which skips agent selection but has no bearing on language.

The choice lives in `<home>/.ccset/settings.json` — ccset's first owned
settings file; until now everything it wrote belonged to an agent or was a
backup. The file is `{"version": 1, "locale": "..."}`, written through the same
atomic-write machinery as agent configs (temp file, rename, 0600) into a 0700
directory, and it follows `CCSET_HOME` like every other path so fixtures stay
isolated. A file that is missing, malformed, or names a locale ccset does not
carry is treated as *unchosen*, not as an error: the file holds nothing the
user authored, so the right recovery is to ask again, not to refuse to start.
A failure to persist after a successful choice warns on stderr and keeps the
choice for this session — a read-only home should not turn a language
preference into a hard failure.

The prompt is a small standalone Ink render in cli.tsx, after the TTY guard and
before the main App mounts. The placement is forced by the shape of i18n: `t()`
resolves through a module-global active locale with no reactive seam, so the
locale must be settled before App mounts rather than switched mid-session. The
screen is bilingual by construction — a "Language / 语言" title, options
carrying each language's native name, key hints in both languages — because no
locale is active while it is shown; it is therefore the one screen whose copy
does not go through the catalogs. Esc and Ctrl+C quit without persisting, per
the standing rule that every screen offers a way back.

Non-goals: no `LANG`/`LC_ALL` detection, which this ADR narrows not at all; no
third locale; no `--lang` flag and no in-app language switcher. Changing one's
mind later means editing or deleting the settings file, or setting
`CCSET_LOCALE` for a session; a menu entry can be revisited if that proves
hostile in practice.

The implementation is expected to touch: a new `src/core/settings.ts` reading
and saving the locale preference, with its path helper and constants alongside
`backupsDirFor`; an `isLocale()` export on the i18n module to validate the
saved value; a `LanguageSelect` screen mirroring `AgentSelect`; the cli.tsx
flow described above; and one new `warn.localePersistFailed` key pair in both
catalogs. Verification ships as a new gate, `verify:first-run-locale`, driving
`dist/cli.js` through a pty: a fresh home sees the bilingual prompt, chooses
zh-Hans, and lands in a localized menu with the settings file written; a second
run on the same home is never asked; a run with `CCSET_LOCALE` set is neither
asked nor persisted and beats a conflicting saved value; a corrupt or
unknown-locale file re-asks. Each assertion is mutation-checked per the
register's standing procedure. PRD §5.5, both READMEs, and an
implementation-register entry are amended by the implementation PR, not this
one.
