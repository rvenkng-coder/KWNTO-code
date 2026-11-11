# Findings: Foundation and Real-Time Spike

## Findings

(No findings yet)

## Task 3
- Finding A (3B): concurrent PATCHes of different fields of one record lose one edit (chromium 4/20 kept, firefox 16/20). Either field can be lost. Likely cause: PocketBase update is a whole-record write. Threatens the ERD per-attribute assumption; pending NO-GO unless explained.
- Finding E: missed events not replayed (0 of 5); flow resumes ~270 ms. Plan 4 must refetch after reconnect.
- Finding G: updated never repeated in 50 sequential pairs; still not a safe sole version given A.
- Verdict: NO-GO on A. Funnel run pending developer.
