# Collections

Browse, create, and share collections — curated groups of public datasets with academic metadata and an ordered member list.

**Author:** Chen Kejiang

**Feedback:** Found a bug or have a suggestion? Open a [GitHub Issue](https://github.com/NeoNexusX/MassVision/issues) or email **jydong@xmu.edu.cn**.

## Open the Collections Page

Click **Datahub > Collections** in the navigation bar. The filter bars on the Public Datasets, My Datasets, and Collections list pages also provide quick links to jump between the three.

<!-- Image placeholder: Collections list page -->

## Browse & Find Collections

The list page shows collections from the whole platform by default; tick **My collections only** to see just the ones you created.

- **Search:** the search box matches collection names by keyword, across all pages.
- **Filter:** click **Add filter** to filter by collection name, title, journal, or creator username; **member type** and **collection type** are vocabulary multi-selects; vocabulary fields such as organism match collections that *contain* the value (multiple values within one field are OR-ed).
- **Sort:** the list is always ordered by last-updated time, newest first.

The list is paginated server-side; switch pages and page size at the bottom.

<!-- Image placeholder: Search and filter panel -->

## Collection Cards

Each card shows the cover image with organism chips, basic info (creator, created time, last updated), academic metadata such as DOI, title, journal, and access URL (collapsed into a "more" entry when long), and a badge marking collections you created.

Click **View Collection** to open the detail page in a new tab. **Share** copies the collection's public link (see Share below). Owners and admins can delete the collection (see Delete below).

<!-- Image placeholder: Collection card -->

## Create a Collection

Click **Create Collection** on the list page to start the four-step flow:

**Step 1 — Select datasets.** Pick members from completed public imzML datasets; search is supported, and selections persist across pages.

<!-- Image placeholder: Step 1 select datasets -->

**Step 2 — Reorder.** Drag member cards or use the move up/down buttons to set the display order; remove a dataset to deselect it.

<!-- Image placeholder: Step 2 reorder -->

**Step 3 — Collection info.** Enter the collection **name** (required, max 80 characters) and **description** (optional, max 300 characters).

<!-- Image placeholder: Step 3 collection info -->

**Step 4 — Metadata.** Sample and acquisition fields are auto-filled from the selected datasets; once you edit a field by hand it stops auto-updating, and **Reset to detected** restores the detected value. Citation fields (DOI, title, journal, access URL, publication time, citation, abstract) are all optional; a DOI must look like `10.1000/xyz123`, `doi:10.1000/xyz123`, or `https://doi.org/10.1000/xyz123`.

<!-- Image placeholder: Step 4 metadata -->

::: warning
Collections are public as soon as they are created — the platform has no private collections. Leaving the creation flow mid-way prompts for confirmation; unsaved selections and entries will be lost.
:::

Click **Create Collection** to submit; you'll be redirected to the new collection's detail page.

## View & Edit a Collection

The detail page shows the cover, name, description, full academic metadata, and the member list.

Owners and admins can click **Edit** to modify the name, description, and metadata in place, then click **Save Changes** to submit (only changed fields are sent). The name is required and capped at 80 characters; the description at 300.

<!-- Image placeholder: Collection detail page -->

## Manage Members

Owners and admins can manage members on the detail page:

- **Add Members:** pick public datasets and append them to the end of the list; datasets already in the collection are marked and cannot be selected again.
- **Remove Selected:** tick members and remove them; the toast reports how many were actually removed, and members already removed elsewhere are skipped with a separate note.
- **Reorder:** in edit mode, drag members or use the move up/down buttons; if the order was changed elsewhere, the page shows a notice and refreshes to the latest order.
- **Limit:** a collection holds at most 300 datasets.
- **Download:** each member can be downloaded individually.

<!-- Image placeholder: Member management -->

## Share a Collection

Click **Share** on the detail page to copy the collection's public link — an address starting with `/collections/` followed by the collection's public id. Anyone with the link can view a read-only page (member list and metadata) **without signing in**; if the collection does not exist or is no longer public, the page shows a unified notice.

Because collections are public upon creation, there is no separate visibility switch.

<!-- Image placeholder: Share link and public read-only page -->

## Delete a Collection

Owners and admins can click **Delete collection** on the detail page and confirm the dialog. Deleting removes only the collection itself — the datasets inside are not affected.

<!-- Image placeholder: Delete confirmation dialog -->
