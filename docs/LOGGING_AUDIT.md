# Logging vs Audit

## Application Logging

- Structured logs (JSON in prod).
- Include request id.
- No secrets.
- Useful for debugging and ops.

## Audit Logging (later)

- Stored in DB.
- Records who did what, when, and in which tenant context.
- Must not be used as a general application log sink.
