# Task 8: check:task output

Run once at the end on `0ffe858`, base `be4204f` (tasks 6 to 8 together).

**About the FAIL:** `hygiene` lists three files whose comments lost the words `it (...)`, which the raw text count reads as test calls; `check:comments -- --same-code be4204f` shows no code changed in them. `quality` lists old findings in files where only comments changed.

```text
> kwnto@0.0.0 check:task
> node scripts/check-task.ts --task docs/superpowers/plans/2026-11-26-maintainability/task-8-comments-tests-scripts.md --base be4204f --built-by strong

PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: not required by this task's test plan; e2e: not required by this task's test plan; container: not required by this task's test plan
FAIL hygiene
FAIL quality
PASS coverage: 3 cases point at tests that exist
PASS breaks: run-breaks: no breaks listed
PASS probes: the Test plan names no probe folder (none)
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 0 of 0 local tasks

FAIL hygiene:
  frontend/src/features/editor/canvas/newNode.test.ts: lost-test: 5 test-like calls at base, 4 now (raw text count)
  frontend/src/features/editor/chapters/menuPosition.test.ts: lost-test: 5 test-like calls at base, 4 now (raw text count)
  tests/rules/media.rules.test.ts: lost-test: 13 test-like calls at base, 11 now (raw text count)

FAIL quality:
  ./backend/pb_hooks/lib/project-import.js
    35:1  error  Function 'createContent' has too many lines (54). Maximum allowed is 50  max-lines-per-function

  ./backend/pb_hooks/teams-join.pb.js
    17:7  error  Arrow function has too many lines (70). Maximum allowed is 50  max-lines-per-function

  ./backend/pb_hooks/users-defaults.pb.js
    15:5  error  Unexpected console statement  no-console

  ./backend/pb_hooks/users-signin.pb.js
     12:37  error  Arrow function has too many lines (66). Maximum allowed is 50  max-lines-per-function
     12:37  error  Arrow function has a complexity of 12. Maximum allowed is 10   complexity
    116:5   error  Unexpected console statement                                   no-console

  ./frontend/src/backend/projects.ts
    9:8  error  Function 'createProjects' has too many lines (59). Maximum allowed is 50  max-lines-per-function

  ./frontend/src/features/editor/export/useExportRun.ts
    40:8  error  Function 'useExportRun' has too many lines (65). Maximum allowed is 50  max-lines-per-function

  ./frontend/src/features/editor/store/editorEdits.ts
    159:8  error  Function 'createEdits' has too many lines (52). Maximum allowed is 50  max-lines-per-function

  ./frontend/src/features/editor/store/edits.ts
    123:1  error  Function 'createRecorder' has too many lines (58). Maximum allowed is 50  max-lines-per-function

  ./frontend/src/features/share/shareModel.ts
    32:8  error  Function 'contentFromFile' has too many lines (66). Maximum allowed is 50  max-lines-per-function

  ./scripts/lib/test-plan.ts
    103:1  error  Function 'parseCases' has a complexity of 14. Maximum allowed is 10   complexity
    143:1  error  Function 'parseBreaks' has a complexity of 16. Maximum allowed is 10  complexity

  ✖ 13 problems (13 errors, 0 warnings)

check:task: FAIL (2 steps)
```
