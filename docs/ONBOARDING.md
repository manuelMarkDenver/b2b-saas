# Onboarding — Zentral B2B SaaS

## Admin: Create a Tenant

Super Admins create tenants via the Admin UI. This is the only way tenants are provisioned (no self-registration, no invite flow).

### Where

1. Log in as a platform admin at `/admin`.
2. The **Tenants** tab is selected by default.
3. Click the **"New Tenant"** button in the top-right of the Tenants section.

### Fields

| Field | Required | Behavior |
|-------|----------|----------|
| **Business name** | Yes | Display name for the tenant and its default branch. |
| **Slug** | Yes | Auto-generated from the business name (lowercase, hyphens, no spaces). Editable. Once manually edited, the slug becomes **permanently locked** — further changes to the business name no longer regenerate it. |
| **Owner email** | Yes | Creates a new user or reuses an existing one. |
| **Temporary password** | Yes (min 8 chars) | Set by the admin and given to the tenant owner out-of-band (chat, email, in person). |

### MVP Constraints

- **No slug availability check endpoint** — slug collisions are detected on submit (409 response).
- **No password show/hide toggle** — the password field is always masked (`type="password"`).
- **No dirty-form discard confirmation** — closing the dialog without submitting discards input silently.

### What Happens on Submit

The backend creates the following records atomically in a single database transaction:

1. **Tenant** — `status: ACTIVE`, default feature flags (inventory/orders/payments ON; rest OFF), `maxBranches: 1`.
2. **User** — new user with the provided email and hashed password, or reuses an existing user if the email already exists.
3. **TenantMembership** — links the user to the tenant with `role: OWNER`, `isOwner: true`, `status: ACTIVE`.
4. **Branch** — one default branch named after the business, `isDefault: true`, `type: STANDARD`, `status: ACTIVE`.

If any step fails, the entire transaction rolls back — no partial data remains.

### Success Screen

After successful creation, the dialog switches to a confirmation view showing:

- **Tenant slug** — displayed in monospace font.
- **Owner email** — displayed in monospace font.
- **Temporary password** — displayed in a read-only input field with a **Copy** button (copies to clipboard).

The password is shown **only once** — it is not stored anywhere after the dialog closes.

#### Existing User Warning

If the owner email already exists as a user in the system, an amber warning banner is displayed at the top of the success screen:

> This user already exists. Their password was not changed.

This means the existing user's current password remains unchanged; the admin-provided password was ignored.

### After Creation

Click **"Done"** to close the dialog. The tenant list refreshes automatically to show the new tenant.

Share the credentials with the tenant owner via your preferred channel. They can log in immediately — no email verification or invite flow required.
