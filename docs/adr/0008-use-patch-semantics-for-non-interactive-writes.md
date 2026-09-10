# Use patch semantics for non-interactive writes

Non-interactive writes are Managed patches: supplied fields change, omitted
fields retain their current on-disk values, and removal must be explicit. This
avoids deleting settings when an older script does not know about a newly managed
field, while still reusing the existing seed, validation, emit, merge, backup, and
atomic-write behavior; a new Provider additionally requires the fields needed to
form a valid configuration. The command API seeds from disk only, so TUI template
defaults are never applied implicitly to an omitted field.
