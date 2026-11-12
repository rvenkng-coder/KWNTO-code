# KWNTO Security Requirements

What the app must do to keep people's work safe, and how we check it. The product design is in [the design](superpowers/specs/2026-11-11-kwnto-design.md); engineering rules are in [engineering.md](engineering.md). These requirements were set by the developer on 2026-11-11. Items marked **(planned)** are to be built in the plan and do not exist yet. Items marked **(confirm)** are my understanding of how PocketBase behaves and must be checked against the version in use.

KWNTO is an **internal tool** for now. Some risks are knowingly accepted for that reason and are listed at the end, to be revisited before any public release.

## 1. What matters most

1. **Users must not lose their project data, and it must not be corrupted.** (Top concern.)
2. **People without access to a project must not be able to read or change it.**
3. Emails and account information stay private, except to the admin.

## 2. Access control (deny by default)

- Every collection has explicit access rules. No rule means no access.
- A person reaches a project only through **team membership** or a **valid, unrevoked share link**.
- Share links: view, comment or edit; live or snapshot; revocable. View links work without an account. Comment and edit links require sign-in. An edit link grants one project only, never the team.
- Tokens are long and random, so they cannot be guessed. A revoked link stops working at once, including its media.
- Only the team owner can remove members, regenerate or disable the join code, delete projects or delete the team.
- **Test requirement:** every collection has backend rule tests as different users (member, outsider, signed-out, link holders). **A test fails if any collection has no tested rule. (planned)**

## 3. Accounts and sign-in

- Email and password. Anyone can sign up while `registration_open` is on (otherwise sign-up is refused with "Sign-up is closed."; the admin can still add accounts). A new account is **not verified**, even if the sign-up request says `verified: true`. **Email verification is required** before creating or joining teams, uploading media, or using sign-in share links: the access rules for those actions check `@request.auth.verified = true` (built with teams, uploads and share links).
- **Password rules:** at least 10 characters, at least one letter and one number (any alphabet), and not one of about 200 very common passwords (compared ignoring case; the list is [common-passwords.js](../backend/pb_hooks/lib/common-passwords.js)). Spaces are allowed. The rules are [checkPassword](../backend/pb_hooks/lib/password-rules.js), applied by [users-signup.pb.js](../backend/pb_hooks/users-signup.pb.js) on every request that sets a password: sign-up, password change and password reset, also when the admin sets one. The `users` password field's own minimum is 10 as well ([1794360300_users_password_policy.js](../backend/pb_migrations/1794360300_users_password_policy.js)), so PocketBase keeps the length rule even without the hook. Sign-up and change are pinned by rule tests; reset is checked by hand (its token arrives by mail).
- **Hashing:** a deliberately slow hash. PocketBase uses bcrypt, to my knowledge **(confirm algorithm and cost)**. Do not swap it unless the check finds a weak setting.
- **Failed sign-ins:** after 3 failures, "try again after 5 minutes". Count per account and IP together where possible. Both numbers are admin settings.
- Password resets and verification go out by a free SMTP account (for example Gmail with an app password), set in the PocketBase dashboard. The mail credentials are secrets (see section 6). The step-by-step SMTP guide arrives with the deployment plan; until mail is set up, verification and reset mails are not sent.
- Emails are private to everyone except the admin. Team owners can invite by email and learn only whether an account exists; the invitee must accept. **Accepted risk:** this lets a signed-in owner discover which emails are registered. Limited by a rate limit on invites and a log entry per attempt.

## 4. Uploads

- Allowed: WAV, MP3, MOV, MP4, JPEG, PNG. Limits are admin settings (default 2 GB per user, 200 MB per video, 50 MB per audio or image).
- **Strict check:** the server reads the file's first bytes to confirm the real type, not just the extension, and rejects mismatches.
- Files are served with headers that stop the browser guessing a type or running them as pages (for example `X-Content-Type-Options: nosniff`). File names are replaced with generated names.
- Over quota: the upload is refused with a clear message; nothing already uploaded is deleted.

## 5. Common web vulnerabilities (OWASP-style checklist)

| Risk | Defense | Check |
|---|---|---|
| **XSS** | React escapes text by default; the app shows plain text only | ESLint bans `dangerouslySetInnerHTML` **(planned)**; an end-to-end test saves `<script>` text as a node title and a comment and confirms it shows as text **(planned)** |
| **SQL injection** | PocketBase builds queries safely; the app never writes SQL | Rule tests send injection strings in filters; filters use bound parameters, never string concatenation **(planned)** |
| **Broken access control** | Section 2 | The rule tests above |
| **Malicious upload** | Section 4 | Rule tests with a fake file **(planned)** |
| **Bad imports** | A JSON project import is untrusted input; validate it with a schema (for example `zod`), with size limits | Unit tests with malformed and oversized files **(planned)** |
| **Leaked secrets** | Secrets stay out of git | gitleaks before each commit and in the workflow **(planned)** |
| **Vulnerable libraries** | Dependency audit | `npm audit` in the workflow **(planned)** |
| **Missing browser protections** | The proxy adds Content-Security-Policy and other headers | One test that the headers are present **(planned)** |
| **CSRF** | PocketBase uses tokens in headers, not cookies, so it mostly does not apply | **(confirm)** |

## 6. Secrets and the server

- Secrets (admin credentials, SMTP password, Tailscale key) live in a `.env` file on the VM or in the PocketBase database, **never in git**. Backups contain the database, so protect backups like secrets.
- Run containers as a non-root user, no privileged mode, with images updated regularly.
- **The admin dashboard is hidden from the public address.** A reverse proxy (Caddy) between Tailscale Funnel and PocketBase blocks the dashboard and admin API paths publicly; the admin reaches them only through the private Tailscale network. The deployment guide must show how to confirm the public address returns "not found" for them.
- Everything is served over HTTPS (Tailscale issues and renews the certificate).
- The admin account is created at installation by a documented command or bootstrap script. There is no default password.

## 7. Data protection

- **Trash:** deleted projects, chapters and nodes stay recoverable for 30 days (admin setting), then are removed for good.
- **Backups:** a script or command runs scheduled backups to a configurable destination. After the trash period, recovery is a backup restore by the admin. **Test the restore, not just the backup.** (planned)
- **Offline edits** queue locally and are never discarded; sync conflicts ask which version to keep (design section 6.7).

## 8. Logging

- **Security log (`security_events`, admin only):** sign-ins, failed attempts and lockouts, password resets, invite attempts, sign-up and verification, admin changes. PocketBase's request logs in the dashboard add raw web requests; logs can also go to a file. Retention is an admin setting (default 365 days).
- **Not in the MVP:** a log of who did what on projects, with old and new values, and the History panel and restore points built on it. Until then, edits are not recorded.

## 9. If you suspect a compromise

The admin has these controls (design section 7c). The builder documents each as a step-by-step runbook here **(planned)**:

1. **Sign one account out** of all sessions (likely rotating that user's token key **(confirm)**).
2. **Sign everyone out** (likely rotating the collection's signing secret **(confirm)**).
3. **Block an account** from signing in, with a message explaining why (`user_status`).
4. **Lockdown:** refuse all sign-ins with a message (`system_access.lockdown`); the admin dashboard keeps working.
5. **Close sign-up** (`registration_open`).
6. **Revoke all share links.**
7. **Reset a password by hand.**
8. **Restore from a backup.**

Then read the security log and PocketBase request logs to find out what happened.

## 10. Accepted risks and what to revisit before going public

Known and accepted while the tool is internal (also listed in design section 12):
- The "that user doesn't exist" invite message reveals registered emails.
- Open sign-up on a public address, and the disk use of 2 GB per account.
- PocketBase's single-server, SQLite limits.
- Tailscale Funnel's bandwidth limits.
- No automated vulnerability scanner or penetration test yet. **Before a public release:** run an OWASP ZAP scan, commission a real penetration test, and re-review every access rule.
