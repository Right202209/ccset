# Security Policy

Security reports are accepted as public GitHub issues. The project does not offer a
private disclosure channel, confidentiality, a coordinated disclosure window, or
a response-time guarantee.

Use the [public security report form](https://github.com/Right202209/ccset/issues/new?template=security.yml).

## Before reporting

Never include:

- a real token or credential;
- a complete settings file;
- an unredacted home-directory path; or
- logs that have not been checked for credentials and personal data.

Use obvious placeholders and the minimum reproduction needed. Avoid putting
directly exploitable detail in the issue title.

If a public report contains a real credential, the maintainer will hide or edit the
content when possible and advise the reporter to rotate it. GitHub history, forks,
notifications, archives, and third-party caches may retain the original content, so
the project cannot promise complete removal.

When a report presents a realistic exploitation risk, the preferred response is to
publish the smallest safe fix before publishing a detailed analysis. Data loss,
credential exposure, and unsafe file writes are release blockers, but the project
does not promise a response or fix deadline.
