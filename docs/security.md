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
- Tokens are 40 characters from `A-Za-z0-9`, about 238 bits, made only by the server (`$security.randomStringWithAlphabet`), and always looked up as a bound parameter. A revoked link stops working at once, including its media. **Built (plan 7 Task 3):** view and comment links are never read through collection rules but through routes under `/api/kwnto/share/{token}` that check the token on every request; an unknown token, a revoked link and a link of a trashed project all get the same 404 with the same body (no oracle). An edit link makes a `link_grants` row (verified sign-in), and the content rules accept that one row (`link.revoked = false`, `permission = 'edit'`, same project, all in one row) next to team membership; the owner-only rules (trash a project, delete media for good) are untouched. Snapshot links are view-only. No rule is public.
- Only the team owner can remove members, regenerate or disable the join code, delete projects or delete the team.
- **Test requirement:** every collection has backend rule tests as different users (member, outsider, signed-out, link holders). **A test fails if any collection has no tested rule.**

## 3. Accounts and sign-in

- Email and password. Anyone can sign up while `registration_open` is on (otherwise sign-up is refused with "Sign-up is closed."; the admin can still add accounts). A new account is **not verified**, even if the sign-up request says `verified: true`. **Email verification is required** before creating or joining teams, uploading media, or using sign-in share links: the access rules for those actions check `@request.auth.verified = true` (built with teams, uploads and share links).
- **Password rules:** at least 10 characters, at least one letter and one number (any alphabet), and not one of about 200 very common passwords (compared ignoring case; the list is [common-passwords.js](../backend/pb_hooks/lib/common-passwords.js)). Spaces are allowed. The rules are [checkPassword](../backend/pb_hooks/lib/password-rules.js), applied by [users-signup.pb.js](../backend/pb_hooks/users-signup.pb.js) on every request that sets a password: sign-up, password change and password reset, also when the admin sets one. The `users` password field's own minimum is 10 as well ([1794360300_users_password_policy.js](../backend/pb_migrations/1794360300_users_password_policy.js)), so PocketBase keeps the length rule even without the hook. Sign-up and change are pinned by rule tests; reset is checked by hand (its token arrives by mail).
- **Hashing:** a deliberately slow hash. PocketBase uses bcrypt (confirmed, see [backend.md](developer/backend.md#password-hashing)). Do not swap it unless the check finds a weak setting.
- **Failed sign-ins (lockout):** after `max_failed_logins` (default 3) wrong sign-ins of one account **from one IP** within `lockout_minutes` (default 5), further sign-ins of that account from that IP are refused with status 429 and "Too many failed sign-in attempts. Try again after N minutes.", even with the right password. Built in [users-signin.pb.js](../backend/pb_hooks/users-signin.pb.js) with the decision in [lockout.js](../backend/pb_hooks/lib/lockout.js); both numbers are read at each sign-in from `system_behavior`, and `0` for either turns the lockout off.
  - **Per account and IP pair** (decision D2): someone guessing from elsewhere locks the account only for their own IP, so they cannot lock a student out of their own computer. A successful sign-in resets that pair's count.
  - **No account enumeration:** failures are counted by the email as typed (lower-cased, trimmed), whether or not an account has it, and an unknown email gets the same 400 "Failed to authenticate." and the same 429 as a real one.
  - **It ends by itself:** attempts refused during a lockout are logged as `lockout`, not `failure`, so they do not extend it. The lockout ends when the oldest of the counted failures is `lockout_minutes` old.
  - **Known gap:** an attacker with many IPs gets `max_failed_logins` guesses per IP per window and can keep guessing. The password rules above keep that slow to pay off; the security log shows it (many `failure` entries for one email from many IPs).
  - **Known gap: parallel guesses.** The hook reads the pair's failures before PocketBase checks the password, and records a new failure only after the slow password hash returns. Attempts sent at the same moment are all checked before any of them is recorded, so more than `max_failed_logins` guesses can land in one window. Measured on the test backend (2026-11-12): 20 wrong attempts for one account sent at once gave 18 evaluated guesses (18 × 400, 18 `failure` entries) and only 2 × 429. **Mitigation:** turn on PocketBase's built-in rate limiter (dashboard Settings, Application, Rate limiting; the `rateLimits.enabled` setting, off by default in 0.40.6). Its default rule `*:auth` allows 2 auth requests per IP per 3 seconds; with it on, the same 20 parallel attempts gave 2 evaluated guesses and 18 × 429. The deployment plan enables it. Until then the password rules above (10+ characters, letter and number, no common password) and bcrypt's cost keep each guess expensive and unlikely to succeed.
  - **Known gap until the proxy is configured:** the IP is PocketBase's `realIP()`, which trusts no forwarding header by default. Behind the reverse proxy (deployment plan) every request would come from the proxy's IP, which turns the pair into "per account" (anyone could then lock an account for everyone) unless PocketBase is told to trust the proxy's `X-Forwarded-For` header (the `trustedProxy` setting: dashboard Settings, Application, user IP proxy headers). The deployment guide must do this.
- **Blocking an account:** when the admin sets `user_status.blocked`, a sign-in **with the right password** is refused with 403 "Your account is blocked: <reason>". A wrong password gets the ordinary failure, so the reason is shown only to someone who knows the password. Token refreshes are refused too, and the block ends the sessions the account already has at once ([admin-controls.pb.js](../backend/pb_hooks/admin-controls.pb.js), which renews the account's token key).
- **Lockdown:** when the admin sets `system_access.lockdown`, every app sign-in is refused with 403 and `lockdown_message` (or "Sign-in is temporarily unavailable." when it is empty). The admin (superuser) still signs in to the dashboard. A lockdown does not end sessions that already exist (they can still be renewed); signing everyone out (section 9, control 2) does.
- Sign-ins, failures and lockouts are written to the security log (section 8) with the email as typed and the IP.
- Password resets and verification go out by a free SMTP account (for example Gmail with an app password), set in the PocketBase dashboard. The mail credentials are secrets (see section 6). The step-by-step SMTP guide arrives with the deployment plan; until mail is set up, verification and reset mails are not sent.
- Emails are private to everyone except the admin. An app user cannot make their own email public: the sign-up hook keeps each account's `emailVisibility` false at sign-up and on every edit (only the admin can change it). Team owners can invite by email and learn only whether an account exists; the invitee must accept (invites, below).
- **Join codes** ([teams-join.pb.js](../backend/pb_hooks/teams-join.pb.js)): a verified user who types a team's code becomes a plain member (`POST /api/kwnto/teams/join`; signed-out callers get 401, unverified ones 403). A code is 8 characters from 32 symbols, **about 40 bits, so it is guessable in principle**. What keeps guessing impractical:
  - **Rate limit:** each user may make `team_attempts_per_hour` (default 20, see [settings](admin/settings.md)) join-code and invite attempts per hour, counted together; the next one is refused with 429 "Too many attempts. Try again later.", even with the right code. The decision is [isOverLimit](../backend/pb_hooks/lib/rate-limit.js). Refused attempts are logged but not counted, so the limit ends by itself an hour after the attempts that caused it. At 20 per hour, one account needs about 3 million years on average to hit one particular enabled code (32^8 codes); many accounts or many enabled codes shorten that, which is one reason to keep codes off when not in use and why sign-up can be closed (section 9, control 5).
  - **No oracle:** a wrong code, a disabled code and a code that never existed all get the same 404 "That join code is not valid.", so a guesser cannot tell a real code from nonsense. The code is looked up as a bound parameter, never pasted into a filter (a rule test sends `' OR 1=1 --` and `%`).
  - **Off by default, owner control:** a new team's code is off until the owner turns it on (`team_settings.join_code_enabled`, decision D1). The owner can turn it off again or regenerate it (`POST /api/kwnto/teams/{id}/regenerate-code`, owner only: a plain member gets 403, and anyone outside the team, the owner of another team included, gets the same 404 as for a team id that does not exist). The old code stops working at once; people who already joined stay.
  - **Little to learn:** a successful join answers only the team's id and name. Every attempt is a `join` entry in the security log (section 8) with its outcome, never the code.
  - **Known gap, as with the lockout:** the attempts are counted before the new one is logged, so a burst sent at the same moment can pass the limit by a few. PocketBase's built-in rate limiter (above, "parallel guesses"), which the deployment plan enables, can cap such bursts per IP: its default rule for `/api/` is loose (300 requests per 10 seconds), so a tighter rule for the path `/api/kwnto/teams/join` belongs with it.
- **Invites by email** ([teams-invites.pb.js](../backend/pb_hooks/teams-invites.pb.js), table `team_invites`): the owner types an email (`POST /api/kwnto/teams/{id}/invites`); if an account has it, a pending invite appears in that person's account, and they accept (`POST /api/kwnto/invites/{id}/accept`, they become a plain member) or decline (`POST /api/kwnto/invites/{id}/decline`). No email is sent. All three routes need a signed-in (401), verified (403) caller.
  - **Accepted risk (design section 5, exactly as the design words it):** "The "doesn't exist" message lets a signed-in owner discover which emails are registered; this is a known, accepted risk, limited by a rate limit on invite attempts and a log of each attempt, and it is on the pre-public list (section 12)." As built: an unknown email gets 404 "That user doesn't exist.", a known one 204.
  - **How it is limited:** invite attempts share the per-user limit with join codes (`team_attempts_per_hour`, default 20, decision D3), so one owner can test at most 20 emails an hour, joins and invites together; the next attempt gets 429 "Too many attempts. Try again later.", whatever the email. Refused attempts are logged with `limited` and not counted, as for join codes. Every attempt by a verified caller, from the limit on, is an `invite` entry in the security log (section 8) with its outcome (`ok`), the team and **only the email's domain** (`emailDomain`): the full address is never stored, so the log does not become a list of registered emails. Many `invite` entries with `ok: false` from one owner are the sign of a sweep. The burst gap of join codes (above) applies here too.
  - **Only the owner invites:** a plain member gets 403 "Only the team owner can invite people."; anyone outside the team, the owner of another team included, gets 404 "No team with this id.", as for a team that does not exist. Inviting a member or someone with a pending invite from this team gives 409 "That person is already a member or has a pending invite." (one pending invite per person and team is also a unique index).
  - **The owner learns nothing else:** the invite answer has no body; it never holds the invitee's email or id. Only the invitee can see an invite (decision D7), so the owner has no list of pending invitees and finds no trace of them in any table they can read; after acceptance the owner sees the new member's name (`team_members.user_name`), never their email. The invite shows the invitee the team's and the inviter's names, copied when it is made (D6). Owners cannot cancel an invite (D7).
  - **Only the invitee answers:** anyone else gets 404 "No invite with this id.", as for an invite that does not exist. An invite is answered once (a second answer is 409 "This invite has already been answered."; accepts sent at once give one member row). An unverified invitee cannot accept; the invite waits until they verify. A declined person can be invited again. The lookup ignores letter case and spaces, and the email is a bound parameter (rule tests send `' OR 1=1 --` and `%@example.test`). Accounts cannot differ only in case (see below), so a lookup matches at most one.
  - **Email case (developer decision, 2026-11-13):** emails are not case-sensitive. They are stored lower-case and trimmed (the [users-signup](../backend/pb_hooks/users-signup.pb.js) hook), sign-in looks the account up lower-cased ([users-signin](../backend/pb_hooks/users-signin.pb.js)), and PocketBase's own unique email index is `COLLATE NOCASE` ([1794360700_users_email_collate_nocase.js](../backend/pb_migrations/1794360700_users_email_collate_nocase.js)), so the database refuses a case variant on every path and PocketBase's own lookups (sign-in, password reset, verification) ignore case: a look-alike account cannot exist. [1794360600_users_email_nocase.js](../backend/pb_migrations/1794360600_users_email_nocase.js) lower-cased existing addresses and stops, naming both, if two accounts already clash. (It first added an index on `LOWER(email)`, which 1794360700 replaces: that kind of index does not make PocketBase's lookups ignore case.)

## 4. Uploads

- Allowed: WAV, MP3, MOV, MP4, JPEG, PNG. Limits are admin settings (default 2 GB per user, 200 MB per video, 50 MB per audio or image in `system_storage`, overridden per user in `user_limits`).
- **Strict check:** the server reads the file's first bytes to confirm the real type, not just the extension, and rejects mismatches (`backend/pb_hooks/lib/media-check.js`, `media.pb.js`). Tested by `tests/hooks/media-check.unit.test.ts`, `tests/rules/media.rules.test.ts`, `tests/rules/media.limits.rules.test.ts`, and `e2e/editor-media.spec.ts`.
- Files are served with headers that stop the browser guessing a type or running them as pages (`X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; img-src 'self'; media-src 'self'; sandbox`). File names are replaced with random 15-character generated names. Verified by `tests/rules/media.rules.test.ts`.
- Over quota: the upload is refused with a clear message; nothing already uploaded is deleted. Parallel uploads that together exceed quota are resolved safely with post-insert race checks. Tested by `tests/rules/media.limits.rules.test.ts` and `e2e/editor-media.spec.ts`.

## 5. Common web vulnerabilities (OWASP-style checklist)

| Risk | Defense | Check |
|---|---|---|
| **XSS** | React escapes text by default; the app shows plain text only | ESLint bans `dangerouslySetInnerHTML` **(planned)**; an end-to-end test (`e2e/comments.spec.ts`) saves HTML as a node title and a comment, reloads, and confirms both show as text, nothing runs and no element is made |
| **SQL injection** | PocketBase builds queries safely; the app never writes SQL | Rule tests send injection strings in filters; filters use bound parameters, never string concatenation **(planned)** |
| **Broken access control** | Section 2 | The rule tests above |
| **Malicious upload** | Section 4 | Byte detection, extension checks, quota race tests, and safe headers (`tests/rules/media.rules.test.ts`, `tests/rules/media.limits.rules.test.ts`, `tests/hooks/media-check.unit.test.ts`, `e2e/editor-media.spec.ts`) |
| **Bad imports** | A JSON project import is untrusted input: the server checks the size before parsing (5 MB), validates the whole file with a hand-written schema (`validateProjectFile`: fixed keys only, limits per list and text, every reference must point into the file, `__proto__` refused), gives every record a new id, and creates the project in one transaction, so a refused file leaves nothing behind ([project-file.md](developer/project-file.md)) | `tests/hooks/project-file.unit.test.ts` (malformed, oversized, `__proto__`), `tests/hooks/project-file.import.unit.test.ts`, `tests/rules/project-file.rules.test.ts` (too large, not JSON, unknown reference, too many nodes, a record the database refuses: nothing created), `tests/rules/project-file.edge.rules.test.ts` (JSON nested 5 million levels deep, a streamed body over 5 MB, a file at every limit imports in about 12 s without blocking other requests: accepted), `frontend/src/backend/projectFiles.test.ts` (the door refuses over 5 MB before sending), `e2e/project-file.spec.ts` (a bad file shows the reason) |
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
- **Offline edits** queue locally in the browser's IndexedDB (an outbox) and are never discarded: an entry leaves it only when the server accepted it, the server refused it (it then shows in the failed list until the person dismisses it), or the person chose `Keep theirs`. Sync conflicts ask which version to keep (design section 6.7). Entries carry the user id, so another account on the same browser never sees or sends them; signing out with waiting edits asks first and keeps them for the next sign-in. The outbox is readable by anyone with the browser profile (section 10).

## 8. Logging

- **Security log (`security_events`, admin only):** sign-ins, failed attempts and lockouts, password resets, invite and join-code attempts, sign-up and verification, admin changes. PocketBase's request logs in the dashboard add raw web requests; logs can also go to a file. Retention is an admin setting (default 365 days).
- **Not in the MVP:** a log of who did what on projects, with old and new values, and the History panel and restore points built on it. Until then, edits are not recorded.

## 9. If you suspect a compromise: the incident runbook

The admin's controls (design section 7c), one step-by-step entry each. Dashboard steps happen in the PocketBase dashboard (`/_/` on the backend's private address, signed in as the admin). Every change you make through these controls is written to the security log as an `admin` entry (section 8), so the log also shows what you did and when.

**Which control when:**

| Situation | Do |
|---|---|
| One account is in the wrong hands | 3 (block) at once; then 7 (new password) and unblock once the owner is reached. 1 alone is not enough: whoever has the password signs in again. |
| You want one person to sign in again (lost laptop, shared computer) | 1 |
| Many accounts or the server itself may be affected | 4 (lockdown), then 2 (everyone out); investigate; undo 4 |
| Spam or unwanted sign-ups | 5 |
| Password guessing (many `failure` entries for one email, often from many IPs) | Turn on PocketBase's rate limiter (section 3, "parallel guesses"), check the trusted proxy setting (section 3), and if one account is targeted, 3 until it is safe |
| A share link leaked | 6 |
| Data lost or damaged | 8 |

### Before you start: the admin token (for controls 1 and 2)

Controls 1 and 2 are server routes under `/api/kwnto/admin/`, which only the admin may call (anyone else gets 401 or 403). Call them from a bash terminal that reaches the backend's private address. First get an admin token:

```sh
PB=http://127.0.0.1:8090   # the backend's private address (local dev: this one)
read -r -p 'Admin email: ' ADMIN_EMAIL
read -r -s -p 'Admin password: ' ADMIN_PASSWORD; echo
TOKEN=$(printf '{"identity":"%s","password":"%s"}' "$ADMIN_EMAIL" "$ADMIN_PASSWORD" \
  | curl -s -X POST "$PB/api/collections/_superusers/auth-with-password" \
      -H 'Content-Type: application/json' --data-binary @- \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')
unset ADMIN_PASSWORD
echo "${TOKEN:0:3}"        # prints eyJ when the sign-in worked
```

If it prints anything other than `eyJ`, the email or password was wrong. **A password containing `"` or `\`:** the lines above put it into JSON as typed, so at the prompt type a `\` before each `"` and each `\` (for `pa"ss\1` type `pa\"ss\\1`). The token is valid for a while; repeat these lines when a call answers 401.

**What these commands protect:** the password and the token reach `curl` on its standard input (through `printf`, a shell builtin), never as command arguments, so other users of the same machine cannot read them in the process list (`ps`). They do not protect against someone with access to your shell session: the token stays in the `TOKEN` variable (close the terminal or `unset TOKEN` when done), and anything printed stays in the terminal's scrollback.

### 1. Sign one account out

- **When:** a person's session may be open somewhere it should not be (lost device, shared computer). It ends every session of that account at once; it does not stop a new sign-in with the password.
- **Steps:** in the dashboard open Collections, `users`, type the email in the search box (Enter), and copy the account's `id` (the first column). Then, with `$TOKEN` from above:

  ```sh
  printf 'header = "Authorization: %s"\n' "$TOKEN" \
    | curl -s -i -X POST "$PB/api/kwnto/admin/users/USER_ID/sign-out" --config -
  ```

- **Confirm:** the answer is `HTTP/1.1 204 No Content`. A 404 "No account with this id." means a wrong id; any other error means nothing was ended. In Collections, `security_events`, the newest entry is `admin` with `detail.action` `sign-out-user` and that `user`. The person's app asks them to sign in again.
- **Undo:** nothing to undo; the person signs in again with their password.

### 2. Sign everyone out

- **When:** you cannot tell which accounts are affected, or after a lockdown (control 4) to end the sessions it leaves open. It ends every app session at once. Your dashboard session is not affected.
- **Steps:** with `$TOKEN` from above:

  ```sh
  printf 'header = "Authorization: %s"\n' "$TOKEN" \
    | curl -s -i -X POST "$PB/api/kwnto/admin/sign-out-all" --config -
  ```

- **Confirm:** `HTTP/1.1 204 No Content`, and a newest `security_events` entry `admin` with `detail.action` `sign-out-all`. Your dashboard still works.
- **Undo:** nothing to undo; people sign in again with their passwords (unless a lockdown is on).

### 3. Block an account

- **When:** an account is misused or in the wrong hands. A block ends the account's sessions at once and refuses every sign-in and session renewal, telling the person why after they type the right password. Their work stays visible to their teammates (design 7c).
- **Steps:** in the dashboard open Collections, `user_status`, and type `user.email = "someone@example.com"` in the search box (addresses are stored lower-case, so type it in lower case) (Enter). Open the one row, turn on `blocked`, write `blocked_reason` (the person reads it after "Your account is blocked: "), optionally set `blocked_at` to now for your records, and press **Save changes**.
- **Confirm:** the dashboard says "Successfully updated user_status ...". Collections, `security_events` shows an `admin` entry with `detail.action` `block` (and one with `settings` listing the changed fields). A sign-in to that account with the right password is refused with "Your account is blocked: <reason>." If saving instead shows "The account is blocked, but its sessions could not be ended", the block is in place but old sessions may still work: do control 1 for that account.
- **Undo:** open the same row, turn `blocked` off, **Save changes**. The person can sign in again; their old sessions stay ended.

### 4. Lockdown

- **When:** something is wrong system-wide and nobody should use the app until you know more. Every app sign-in is refused with your message. The dashboard keeps working.
- **Steps:** in the dashboard open Collections, `system_access`, open its only record, turn on `lockdown`, write `lockdown_message` (for example "KWNTO is closed for maintenance until 14:00"; empty shows "Sign-in is temporarily unavailable."), and press **Save changes**.
- **A lockdown does not end existing sessions:** people already signed in keep working and can renew their session. To end them, do control 2 right after the lockdown is on (in this order, so nobody can sign back in between).
- **Confirm:** an app sign-in is refused with your message (status 403); `security_events` has an `admin` entry with `detail.action` `settings`, `detail.collection` `system_access` and `lockdown` changed from `false` to `true`.
- **Undo:** turn `lockdown` off and **Save changes**. People sign in again.

### 5. Close sign-up

- **When:** unwanted accounts are being created (spam, an open address found by strangers). Existing accounts are not affected, and you can still add accounts yourself in the dashboard.
- **Steps:** in the dashboard open Collections, `system_access`, open its only record, turn off `registration_open`, and press **Save changes**.
- **Confirm:** a sign-up is refused with "Sign-up is closed." (status 403); `security_events` has a `settings` entry with `registration_open` changed from `true` to `false`. Unwanted accounts already made: block them (control 3) or delete them in Collections, `users`.
- **Undo:** turn `registration_open` back on and **Save changes**.

### 6. Revoke all share links

- **When:** a share link may have leaked or been misused and you cannot tell which one. It stops every link of every project at once: view, comment and edit, live and snapshot. Edit-link holders lose access to the project's content at once (their saves are refused and their live events stop); team members are not affected.
- **Steps:** with `$TOKEN` from above:

  ```sh
  printf 'header = "Authorization: %s"\n' "$TOKEN" \
    | curl -s -i -X POST "$PB/api/kwnto/admin/share-links/revoke-all" --config -
  ```

- **Confirm:** the answer is `HTTP/1.1 200 OK` with `{"count":N}`, the number of links that were still live. In Collections, `security_events`, the newest entry is `admin` with `detail.action` `revoke-all-links` and `detail.count`. Opening an old link now shows "This link is not valid or was revoked."
- **Undo:** none: make new links. A revoked link cannot be revived.

### 7. Reset a password by hand

- **When:** a person cannot use the reset email (mail is not set up, or their mailbox is the problem), or their password may be known to someone else. Until mail is set up (section 3), a reset request still answers as usual but no mail goes out; the server's Logs show "Failed to send password reset email".
- **Steps:** in the dashboard open Collections, `users`, type the email in the search box (Enter) and open the account. Turn on **change password**, type the new password in both fields, and press **Save changes**. The password rules (section 3) apply to you too: at least 10 characters, a letter and a number, not a common password; a weak one is refused with the rule and nothing changes. Give the person the new password by a channel other than that account's email, and ask them to change it.
- **Confirm:** the dashboard says "Successfully updated users ...", and the person signs in with the new password. Changing the password also ends the account's existing sessions. This change is not in the security log; the dashboard's Logs show the request.
- **Undo:** set another password the same way.
- **Not for app accounts:** the `pocketbase superuser upsert` command in [backend.md](developer/backend.md#how-the-admin-is-created) resets an **admin** (dashboard) password only; it does not touch app accounts.

### 8. Restore from a backup (arrives with the deployment plan)

Scheduled backups and the restore procedure are built and tested by the deployment plan (section 7). This entry is written then.

### Afterwards

Read the security log (Collections, `security_events`, newest first; filter for example `detail.identity = "someone@example.com"` or `type = "failure"`) and PocketBase's request logs (Logs) to find out what happened. Write down what you did and why.

## 10. Accepted risks and what to revisit before going public

Known and accepted while the tool is internal (also listed in design section 12):
- Account enumeration through the invite-by-email message: the "doesn't exist" message lets a signed-in owner discover which emails are registered (design section 5). Limited by the shared attempt limit and an `invite` log entry per attempt (section 3, invites). Before a public release, decide whether an invite to an unknown email should get the same answer as a known one.
- Waiting offline edits (the outbox) live in the browser's IndexedDB, readable by anyone with the browser profile, and stay there after sign-out so they are sent at the next sign-in (offline sync plan D10). Entries carry the user id: another account on the same browser never sees or sends them. Accepted while internal; before a public release decide whether sign-out should offer to discard them.
- Open sign-up on a public address, and the disk use of 2 GB per account.
- PocketBase's single-server, SQLite limits.
- Tailscale Funnel's bandwidth limits.
- No automated vulnerability scanner or penetration test yet. **Before a public release:** run an OWASP ZAP scan, commission a real penetration test, and re-review every access rule.
