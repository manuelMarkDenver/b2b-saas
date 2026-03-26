# API Conventions

## REST

- JSON request/response.
- Versioning: defer until needed; keep paths stable.

## Error Shape (target)

Return a consistent error shape from the API.

- `code`: stable machine-readable code
- `message`: user-safe message
- `requestId`: correlation id

## IDs

- Use UUIDs.

## Auth (later)

- Use `Authorization: Bearer <token>`.
