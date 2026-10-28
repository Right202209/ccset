# Delete and ignore providers in the interface, not the command tree

Providers are what the core user manages, and ccset could add and edit them but
never remove them: a provider file or block survived until it was deleted by
hand, and every provider ccset discovered was offered, including ones the user
had finished with. Two verbs close that gap, and the trade-offs of each are
durable enough to record.

**Deleting is an interactive Action, not a Non-interactive command.** ADR 0007
keeps destructive maintenance out of the command tree until it has a safety
contract of its own; a delete a script could fire needs that contract first, so
the command surface is left alone here and the capability lands where the
confirm Screen already exists.

**A delete removes exactly the provider it names.** For Claude Code that is the
provider's own file, which is deleted whole -- and is deletable even when it no
longer parses, because a file ccset cannot read is exactly the one a user may
want gone. For the four Agents whose providers live in one shared document it is
one managed path, removed through the same codec as every other write, so the
sibling providers, comments and formatting around it survive. That removal takes
the provider's whole section -- its header, its keys and its sub-tables -- and
stops at the section's last own line: a comment or blank line after it stays,
even one sitting between this section and the next header, because a comment
there describes what follows it and the JSONC codec removes no comment either.
Either way a backup is taken first: a deletion is still a write, and the backup
is what makes it recoverable. A provider whose document does not parse cannot be
removed this way -- the codec needs the text -- and is fixed or removed by hand,
which is the same boundary the provider list already reports.

**Deleting a Codex provider also removes its saved credential**, in the reverse
of the save order: the sidecar first, then the table. A failure then leaves a
provider with no credential rather than a live key for a provider that no longer
exists. The delete is refused while `model_provider` names the provider, because
Codex fails to start on routing that points at no table.

**Ignoring is ccset's own state.** It is recorded in `<home>/.ccset/settings.json`
under `ignoredProviders`, keyed by Agent id, and never written into an Agent's
configuration: the Agent's behaviour is the Agent's, and ccset has no business
editing a config file to express a preference about its own interface. An
ignored provider leaves the offered list and stops being a Test-connection
target, is still read by its Agent exactly as before, and is reachable again
through a row on the same list that reveals it and un-ignores it.

The settings document stays at schema version 1 and additive: an unknown shape
reads as empty, and both writers re-read the document first and carry the other
keys over, so choosing a language cannot drop the ignored providers and ignoring
one cannot drop the language.
