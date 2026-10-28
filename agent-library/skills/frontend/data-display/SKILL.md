---
name: frontend-data-display
description: "Use when designing, building, or reviewing how records and metrics are shown (data tables, lists, activity or audit logs, timelines, KPI tiles, summary charts), especially when a table looks generic, numbers don't line up, status is plain text, history is buried in a table, or every section sits in the same card."
---

# Data display

Applies to: tables, lists, timelines, KPI tiles and summary charts inside a page. Project guidance and an existing design system win over these defaults. The frame around them is `app-shell`; drawers, menus and where actions go are in `overlays`.

## 1. Let the data shape the form

Choose each presentation from the data, not from the component you reached for first.

| Data | Present it as |
|---|---|
| Small closed set: department, status, severity, category | Chip with a coloured dot or icon plus text |
| Numbers: counts, amounts, durations | Right-aligned with tabular numerals, so digits line up by place value |
| Long text: emails, descriptions | Truncated, with the full value on hover |
| Inactive, archived, or deactivated records | Kept in place, row dimmed |
| People: actor, owner, reporter | Avatar plus name; faces are recognised faster than names are read |
| Events ordered in time: history, audit log, activity, approvals | A timeline, not a table, in a side panel or a second column beside the main table |
| Records whose volume over time users track: incidents, sign-ups, orders | A summary chart of counts over time above the table, with the total |

- Colour comes from the data: status, severity, category, urgency. Keep chrome such as headers, tabs, and borders neutral. Pair every colour with text or an icon.
- A dashboard list shows the records that need action, not the newest ones, because new records rarely need anything.
- KPI tiles are equal siblings with one value size, each linking to its list. Show a delta only from real comparison data; never invent one.

## 2. Tables

- A table wider than the screen scrolls sideways on its own, never the page, with the name column frozen. Don't hide columns to fit.
- A table taller than the screen keeps its header row sticky, so every column stays named.
- Sortable headers are buttons, with `aria-sort` on the sorted column. Other columns show no sort icon.
- Row actions appear on hover and focus, and all of them also sit in a trailing "…" menu so touch can reach them.
- The table's own search filters only that table. Hide the pager when there is only one page.

## 3. Design the UI you can't see

Before calling a dense component done, specify its hidden layer:

- A tooltip on every icon-only control and every ambiguous label or abbreviation.
- Hover and focus affordances: copy on cells, comment indicators and threads, row actions.
- Every popover, drawer, and modal, with its empty, loading, error, and no-permission states.

A new feature often belongs in one of these layers rather than on a new page.

## 4. Make structure carry information

Labels, numbers, borders, cards, and dividers should each tell the user something. Before adding one, say what it encodes on this screen.

- A label above a heading that names the heading's own topic adds nothing. Let the heading stand alone.
- Number items (01, 02, 03) only when they are a real sequence, such as steps or a timeline.
- Group with spacing and headings first. Use a card only when the group is a separate object the user acts on.
- Vary radius, border, and elevation with hierarchy, not one setting for everything.
- Animate only in response to a user action, to show what changed.

## Common mistakes

| Mistake | Fix |
|---|---|
| History or audit log built as a table tab | Timeline in a drawer or side column |
| Numbers left-aligned; status and category as plain text | Right-aligned numerals; chips |
| A permanent Remove button on every row of a member list | Reveal it on hover and focus, with a tooltip |
| A tracked-out all-caps label above every heading | Drop it, or turn it into the heading |
| Meta strings joined with middle dots (`A · B · C`) | Separate fields with layout or label them |
| Every section in an identical rounded card with the same soft shadow | Spacing and headings, with cards only for separate objects |
| `→` appended to link and button text | A verb that says what happens |

Table rules draw on NN/g's [data tables](https://www.nngroup.com/articles/data-tables/) and the WAI-ARIA APG [sortable table](https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/).

Source: Kole Jain, [The 3 dashboard UI flaws that give away you've NEVER built one](https://youtu.be/Ksx9C2-3yMo). Reference designs are in the [Figma file](https://www.kolejain.com/resources?scrollTo=dashboard-flaws). Section 4 and the last four mistakes are adapted from [frontend-design](https://github.com/anthropics/claude-plugins-official/tree/ea0a38e1d671aa18a30431c9160e31193dc9860b/plugins/frontend-design) (Apache-2.0).
