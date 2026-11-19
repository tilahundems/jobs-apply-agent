# Main and detail page UI

Follow these layouts strictly when building or changing product pages. Inspect the closest route, feature, and shared component before editing; adapt an older example when its layout conflicts with this guide.

## Main list pages

- `SiteHeader` shows the title of the currently selected sidebar item. On a detail route, show a breadcrumb from that sidebar title back to its list page, followed by the current record title. Keep the page's own heading in the content below the shell header.
- Start the content with `PageHeader`: a page heading and a short subtitle beneath it.
- Below it, place `table/table-header.tsx`: search on the left and a right-aligned action group in this order: filters, export, column visibility, and Add. It wraps on narrow screens. Its filter builder takes field, operator, and value rules with Add Filter, Clear All, and Apply Filter. Show Add only when the actor can create the record.
- Follow the header with the shared `DataTable`, including columns, `table/row-actions.tsx`, and pagination. Use the Projects list as the server pagination reference: define the list's fields with `table/create-table-search.ts`, which keeps page, page size, search, filters, and sort in route search params; use its `toQuery` in the loader and query key; apply them before pagination on the server and pass the filtered total as `rowCount`. Tags and Tasks follow the same pattern; their full-list reads (`GET /tags`, `GET /tasks`) serve selectors and related-record views only. Lists that load every record (Users, Roles, Permissions) leave out `sortFields` and filter rows with `filterRecords` from `table/list-filters.ts`.
- Use `empty-state.tsx` when a list has no records yet, and `confirm-delete-dialog.tsx` for delete confirmations.

## When to add a detail page

- Add a detail page when a record has enough description, metadata, or related work to benefit from a dedicated view. Do not create one solely because the record has an ID or a relationship.
- Keep simple records on their list page when the table already shows their useful information and provides their actions. Tags are the current example: show label and color in the Tags table, with edit and delete in its row actions. Do not add a Tag detail route or View link for the current Tag model.
- If a simple record later gains substantial information or related workflows, reconsider the need for a detail page based on that new behavior.

## Detail pages without tabs

- Show the record heading first, then the description when present, then relevant badges.
- Show remaining record information as a plain vertical list of label and value pairs. Keep each label with its value, and stack the pairs from top to bottom.
- Do not split the overview into cards, a property sidebar, or other complex containers. Keep edit and other record actions available without changing this reading order.
- Keep single related values, such as a Task's Project or assignee, in the overview. When there is one useful related collection, show its heading and table below the overview if a tab would add an unnecessary click.

## Detail pages with tabs

- Use tabs when related collections or workflows benefit from distinct spaces, not merely because a foreign key exists. Show the record heading, description when present, and badges above the tabs, in that order. Keep them visible when switching tabs. Use the line-style tabs in `features/roles/roles-settings-tabs.tsx` as the visual reference. The first tab is always **Overview** and contains the selected record's vertically stacked label/value pairs. The Project detail page uses a Tasks tab; its Tags stay as badges above the tabs because their labels and colors need no separate table.
- Give each substantial related collection its own subsequent tab when tabs help navigation. Related tables, whether inline or tabbed, use the same table header and `DataTable` layout as a main list page, including search, filters, export, columns, Add when authorized, row actions, and pagination.
- Gate each related query where it executes and preserve access checks for related data. Keep loading, empty, error, and not-found states within the appropriate tab.

## Form dialogs

- Size each dialog for its fields and interaction density. Keep simple forms compact, give textareas and multi-selects more room, and use a wider dialog for grids or condition builders. Do not assign every form the same width.
- For long forms, constrain the dialog to the viewport, keep its header and footer outside the scrolling form body, and keep the footer actions visible while the fields scroll. Use the Tasks form as the layout reference.
- Keep the form body at `min-h-0 min-w-0` so it can scroll vertically inside the dialog without pushing the footer off screen. As in the Tasks form, prevent horizontal overflow and preserve room for focus rings and controls near the edges.

Use `record-details.tsx` for the overview and tabs, `table/related-records-table.tsx` for related collections, and `detail-page.tsx` for shared actions and loading/error states. Project and Task details show the current layout.
