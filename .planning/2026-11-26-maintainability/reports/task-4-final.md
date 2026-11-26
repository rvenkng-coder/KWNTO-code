# Task 4: check:task output

Built on `ce43810`, base `3d2bc3b`. The quality findings are old code made longer by formatting, accepted by the plan.

```text
> kwnto@0.0.0 check:task
> node scripts/check-task.ts --task docs/superpowers/plans/2026-11-26-maintainability/task-4-prettier.md --base 3d2bc3b --built-by strong

PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: not required by this task's test plan; e2e: not required by this task's test plan; container: not required by this task's test plan
PASS hygiene
FAIL quality
PASS coverage: 4 cases point at tests that exist
PASS breaks: run-breaks: no breaks listed
PASS probes: the Test plan names no probe folder (none)
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 0 of 0 local tasks

FAIL quality:
    10:8  error  Function 'ExportDialog' has too many lines (88). Maximum allowed is 80  max-lines-per-function

  ./frontend/src/features/editor/export/useExportRun.ts
    37:8  error  Function 'useExportRun' has too many lines (65). Maximum allowed is 50  max-lines-per-function

  ./frontend/src/features/editor/panel/ScriptLineRow.tsx
    25:8  error  Function 'ScriptLineRow' has too many lines (83). Maximum allowed is 80  max-lines-per-function

  ./frontend/src/features/editor/store/editorEdits.ts
    159:8  error  Function 'createEdits' has too many lines (52). Maximum allowed is 50  max-lines-per-function

  ./frontend/src/features/editor/store/edits.ts
    122:1  error  Function 'createRecorder' has too many lines (58). Maximum allowed is 50  max-lines-per-function

  ./frontend/src/features/projects/ProjectList.tsx
    20:8  error  Function 'ProjectList' has too many lines (136). Maximum allowed is 80  max-lines-per-function

  ./frontend/src/features/share/shareModel.ts
    32:8  error  Function 'contentFromFile' has too many lines (66). Maximum allowed is 50  max-lines-per-function

  ./frontend/src/features/teams/TeamCard.tsx
    12:8  error  Function 'TeamCard' has a complexity of 13. Maximum allowed is 10  complexity

  ./frontend/src/features/teams/TeamDetail.tsx
    62:8  error  Function 'TeamDetail' has too many lines (117). Maximum allowed is 80  max-lines-per-function
    62:8  error  Function 'TeamDetail' has a complexity of 14. Maximum allowed is 10    complexity

  ./scripts/check-test-hygiene.ts
     26:8  error  Function 'checkSource' has a complexity of 11. Maximum allowed is 10      complexity
     59:8  error  Function 'compareWithBase' has a complexity of 17. Maximum allowed is 10  complexity
    107:8  error  Function 'checkHygiene' has a complexity of 16. Maximum allowed is 10     complexity

  ./scripts/lib/changed-files.ts
    14:8  error  Function 'parseNameStatus' has a complexity of 11. Maximum allowed is 10  complexity

  ./scripts/lib/test-plan.ts
    103:1  error  Function 'parseCases' has a complexity of 14. Maximum allowed is 10   complexity
    142:1  error  Function 'parseBreaks' has a complexity of 16. Maximum allowed is 10  complexity

  ✖ 27 problems (27 errors, 0 warnings)

check:task: FAIL (1 steps)
```
