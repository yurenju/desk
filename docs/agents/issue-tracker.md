# Issue tracker: wspc todos (not GitHub)

Tickets, tasks, and PRDs for this repo are tracked as **wspc todos** in the Desk project via the **wspc MCP** tools — NOT GitHub Issues. Do not run `gh issue *`. The authoritative field semantics live in [CLAUDE.md](../../CLAUDE.md) and [docs/wspc-mcp-operations.md](../wspc-mcp-operations.md); this file only maps skill vocabulary onto those tools so it does not drift.

## Fixed identifiers

- **Account**: `yurenju@gmail.com` (the wspc MCP session).
- **project_id**: `prj_01KT1KDQF60MH0Q9QBS8Q33321` (Desk).
- **type_id**: `typ_01KT1KDRV40GPSMS3P1MYP0B9G` (DeskTask). **Required on `todo_create`** — omitting it seeds the default type, which lacks the scheduling custom fields (later `todo_update` then fails `UNDECLARED_FIELD`). `todo_update` / `todo_list` do not need it (update keeps the existing type; on list it is only an optional filter).

## Conventions

- **Create a ticket**: `todo_create` with `title`, a descriptive `description` (goal / definition of done, Markdown ok), `project_id`, and `type_id`. For a backlog item add at most `custom_fields: { "is_adhoc": "false" }`; to drop it into the current month add `custom_fields: { "scheduled_months": ["YYYY-MM"], "is_adhoc": "false" }` (see CLAUDE.md for backlog vs monthly vs daily semantics). Creating is a write — confirm the title with the user first.
- **Read a ticket**: `todo_get` with the todo `id`.
- **List tickets**: `todo_list` with `project_id`. Filter with `status` (`open` / `in_progress` / `done` / `cancelled`), `cf` (custom-field equality), `due_after` / `due_before`, `parent_id` (null = root, an id = its children).
- **Update / move state**: `todo_update` with the todo `id` and `status` (`done`, `in_progress`, …). `custom_fields` PATCH is sparse; pass `null` to clear a key.
- **Subtasks**: single level of nesting only — `todo_create` with `parent_id = <root todo id>`.
- **Heavy notes / logs**: don't dump into `description`; write to drive (`drive_file_write`) and link, or keep in the repo and link by path.

## When a skill says "publish to the issue tracker"

Create a wspc todo (`todo_create`) in the Desk project with the DeskTask `type_id`.

## When a skill says "fetch the relevant ticket"

`todo_get` (by id) or `todo_list` (to find it), scoped to `project_id`.

## Wayfinding operations

Used by `/wayfinder`. wspc has no native issue dependencies, so:

- **Map**: a single root todo whose `description` holds the Notes / Decisions-so-far / Fog body. Prefix its title (e.g. `[map] ...`) so it is easy to spot.
- **Child ticket**: `todo_create` with `parent_id = <map todo id>` (single level of nesting).
- **Blocking**: no native edges — put a `Blocked by: <todo id>, <todo id>` line at the top of the child `description`. A ticket is unblocked when every listed blocker is `done`.
- **Frontier query**: `todo_list` with `parent_id = <map id>`, `status: ["open"]`; drop any whose `Blocked by` line still names a non-`done` todo; first in list order wins.
- **Claim / Resolve**: `todo_update` the child to `in_progress` on claim, `done` on resolve; append the decision to the map todo's `description`.

## PRs as a request surface

**No.** This is a solo personal project; there is no external-PR triage queue.
