# Factory skill selection

The [shared catalog](../../../skills/catalog.md) defines reusable skills and their canonical paths. An installed factory reads the delivered catalog beside its native skill folders; it must not assume that this source checkout exists.

Spec-writer discovers the project, selects task-relevant skills from that catalog, and records `Skill | Package or scope | Roles | Resolved path | Why` under `## Skills` in `spec.md`, with `Status: READY` or `Status: BLOCKED`.

Every role reads its assigned files. A missing selected file blocks the affected stage. Unused frameworks and optional capabilities absent from the delivered catalog do not block a job. Discovery, verification, security checks, UX/UI review, and documentation have baseline instructions in the factory roles; no archived skill is required.

## Stack assignments

Select by the code actually changed, including server functions and rendered pages. Read each selected skill before planning or implementing its contract.

| Capability | Assign to | Condition |
|---|---|---|
| `laravel/*` | spec-writer, builder, reviewer-code | Applicable Laravel paths. Use `laravel/frontend` for React/Inertia inside a Laravel app. |
| `nest/*` | spec-writer, builder, reviewer-code | Applicable Nest paths. |
| `next/actions` | spec-writer, builder, reviewer-code | A Next Server Action or its callers change. |
| `tanstack-start/actions` | spec-writer, builder, reviewer-code | A TanStack server function or its callers change. |
| `javascript/domain-driver` | spec-writer, builder, reviewer-code | Scaffolding in a JavaScript package that uses domain-driver. Laravel uses Artisan or an explicit manual strategy. |

Choose the skills whose documented scope matches the task, not every skill in a framework. Reviewer-security also reads selected skills for authentication, authorization, input, persistence, or output across changed trust boundaries. UX/UI reviewers read selected frontend guidance for the surfaces they review. Documenter and approver need only skills relevant to their own work.

The Laravel delivery contains Laravel skills; the domain-driver delivery contains non-Laravel skills. If the task requires a framework's skills and that framework is absent, report its missing canonical path. Do not substitute another stack. For a framework without a catalog entry, use project guidance and any explicitly supplied project skill, and record that choice.

## Additional capabilities

Select these when present in the delivered catalog and relevant to the task. A Laravel-only installation uses its Laravel conventions and the factory role instructions for these concerns.

| Skill id | Assign to | Condition |
|---|---|---|
| `quality/simplicity` | builder, reviewer-code | Application code changes. |
| `quality/review` | reviewer-code, reviewer-security | A code change is reviewed. |
| `quality/security-review` | reviewer-security | A code change is reviewed. |
| `frontend/app-shell` | builder, reviewer-ux, reviewer-ui | Layout, navigation, sidebar, header, redirect, or page-level states change. |
| `frontend/overlays` | builder, reviewer-ux, reviewer-ui | An overlay or confirmation is added or changed. |
| `frontend/data-display` | builder, reviewer-ux, reviewer-ui | A table, list, timeline, KPI tile, or chart changes. |

Resolve paths using the delivered catalog's precedence rules and record absolute readable paths. Library roots are read-only during a feature job. Skill selection does not change write ownership or approval policy.
