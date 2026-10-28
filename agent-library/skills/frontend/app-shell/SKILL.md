---
name: frontend-app-shell
description: "Use when building or reviewing the frame around signed-in screens (sidebar, header, page layout, the route after login), especially when the sidebar and body clash, the header scrolls away or crowds, a collapsed sidebar hides its options, pages repeat their title, or the shell lacks mobile, loading, or error states."
---

# App shell

Applies to: the frame every signed-in screen shares. Project guidance and an existing design system win over these defaults. What opens over a page is in `overlays`; tables and charts are in `data-display`.

## Landing route

- After login, go to the URL the user asked for, else `/dashboard`, as Laravel's starter kits and the Next.js tutorial do; `/` stays public. Signed-in visits to `/login` also go to `/dashboard`.
- Accept only a same-origin path as the return URL, to block open redirects.

## Surfaces

- The document scrolls, not an inner panel, so scroll restoration and anchors work.
- The sidebar has its own background, a step darker than the page in both themes, and one 1px border dimmer than card borders. Tone separates them; decorative borders need no contrast minimum.
- The header has the page background: opaque, no bottom rule.
- No inset card around the page, or page cards sit card on card.
- Cards are lighter than the page. In dark mode each step up (card, popover, dialog) is lighter again, since shadows barely show.

## Sidebar

- Workspace switcher on top, since it scopes everything; no logo row. User menu at the bottom, since account actions are rare.
- Two levels at most. Groups fold with a chevron, remembered per user; the current route's group starts open.
- Active item: neutral fill, medium weight, accent icon, `aria-current="page"`. Brand fills stay on primary buttons.
- Start expanded, because icons alone cost recognition. A toggle and Cmd/Ctrl+B collapse it to a 48px icon rail, saved in a cookie so the server renders it.
- Rail icons get tooltips. A group's icon opens its items in a flyout on click, Enter, Space or a 100ms hover; Escape closes it and refocuses the icon.
- Under 768px it becomes a modal drawer, opened from a header menu button and closed on navigation. From 768px show the rail; from 1024px, the full sidebar.

## Header

- Sticky and 48px, small enough to keep. Left: breadcrumbs ending with the unlinked page name. Right: search, notifications, and a "New" menu if creation is app-wide.
- Search covers the whole app through the command palette (⌘K). It never filters the page, because a header field reads as global.
- The bell lists unread items above a pinned "View all".
- Set `scroll-padding-top` to the header height so focus never hides under it.

## Page

- Name the page once, in the header; a title card only repeats it. Keep one `h1`, visually hidden if needed.
- Record pages get a title row: identity and status left, actions right.
- One labelled primary action per page, right of the title row or toolbar. Others are icon buttons with tooltips or sit in a "…" menu.
- The toolbar is one row: tabs and filters left, search and the primary action right. Tabs live in the URL (`?view=board`), so reload keeps them.
- Tables, boards and calendars take full width. Forms cap near 640px and prose near 70 characters, for readable lines.
- Compact by default, so work fits: 13–14px text, 32px controls and rows, a 4px grid, 24px gutters. Phones get 16px gutters and 40px targets.

## States

- Keep the shell mounted between routes. Loading shows a skeleton of the page, then progress after 10 seconds. Refreshes keep content visible.
- Empty: say what belongs here and offer the action that adds it, or "Clear filters".
- First run: point to the one key action, then a checklist ("4 of 6 complete").
- Errors say what failed and offer Retry; no-access says who can grant it; 404s render inside the shell.
- No refresh buttons; reloading does the same.

## Keyboard

- A "Skip to main content" link comes first, visible on focus. Use `nav`, `header` and `main` landmarks.
- `?` lists shortcuts. Single-key shortcuts never fire while typing.
- Focus shows as a 2px outline at a 2px offset.

Sources: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html), NN/g ([navigation](https://www.nngroup.com/articles/vertical-nav/), [breadcrumbs](https://www.nngroup.com/articles/breadcrumbs/), [sticky headers](https://www.nngroup.com/articles/sticky-headers/), [skeletons](https://www.nngroup.com/articles/skeleton-screens/)), Material ([breakpoints](https://m3.material.io/foundations/layout/applying-layout), [dark theme](https://m2.material.io/design/color/dark-theme.html)), [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/sidebars), [shadcn/ui](https://ui.shadcn.com/docs/components/sidebar), [Laravel](https://laravel.com/docs/starter-kits), [Next.js](https://nextjs.org/learn/dashboard-app/adding-authentication), and Kole Jain's [dashboard video](https://youtu.be/Ksx9C2-3yMo) for first-run steps.
