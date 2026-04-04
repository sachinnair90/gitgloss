## ADDED Requirements

### Requirement: Content submission form is accessible to verified and admin users
Any authenticated user with `role = 'verified'` or `role = 'admin'` SHALL be able to submit new catalog items via the content submission form. Guest users SHALL be redirected to login.

#### Scenario: Verified user accesses submission form
- **WHEN** a user with `role = 'verified'` navigates to the item submission route
- **THEN** the submission form SHALL load successfully

#### Scenario: Guest redirected from submission form
- **WHEN** an unauthenticated user navigates to the submission route
- **THEN** they SHALL be redirected to the login page

### Requirement: Admin management routes are accessible only to admin-role users
Admin-only routes (edit any item, delete any item, moderation dashboard) SHALL be protected. Any unauthenticated or non-admin request SHALL receive a 403 Forbidden response or be redirected to login.

#### Scenario: Unauthenticated user redirected from admin route
- **WHEN** an unauthenticated user navigates to an admin-only route
- **THEN** they SHALL be redirected to the login page

#### Scenario: Verified user denied admin route
- **WHEN** a user with `role = 'verified'` navigates to an admin-only route
- **THEN** they SHALL receive a 403 Forbidden response

### Requirement: WYSIWYG editor outputs clean Markdown
The content submission and edit forms SHALL embed a WYSIWYG editor (Milkdown or Editor.js) that produces clean Markdown as the item body. The editor SHALL support headings, bold, italic, lists, links, and inline code.

#### Scenario: Formatted content serialises to Markdown
- **WHEN** a user applies bold formatting to text in the editor
- **THEN** the saved item body SHALL contain the text wrapped in `**...**` Markdown syntax

### Requirement: Image pipeline resizes and converts to WebP in-browser
Before upload, the browser SHALL use the Canvas API to resize the selected image to a maximum width of 1200px (maintaining aspect ratio) and encode it as WebP at ≤200KB. The resulting Base64 string SHALL be sent to the API.

#### Scenario: Large JPEG is resized and converted
- **WHEN** a user selects a 5MB JPEG image
- **THEN** the browser SHALL produce a WebP-encoded Base64 string ≤200KB before sending to the API

#### Scenario: Already-small image is not upscaled
- **WHEN** a user selects an image with width <1200px
- **THEN** the browser SHALL NOT upscale it; original dimensions SHALL be preserved

#### Scenario: Non-image file is rejected
- **WHEN** a user attempts to upload a non-image file
- **THEN** the browser SHALL display a validation error and SHALL NOT send the file to the API

### Requirement: Image is committed to Git via the API
The API SHALL commit the Base64-encoded WebP image received from the browser to `/public/images/<uuid>.webp` in the Git repository using the same dual-write path as item content.

#### Scenario: Image committed alongside item
- **WHEN** a new item is saved with an image
- **THEN** the image file SHALL exist at `/public/images/<item-uuid>.webp` in the Git repository after the commit succeeds

### Requirement: Authors can edit and delete their own items
A user SHALL be able to edit or soft-delete any item where `shadow_cache.author_id` matches their own `users.id` (write phase only — once shadow_cache is cleaned up, edit/delete requires admin role).

#### Scenario: Author edits their own item
- **WHEN** a verified user edits an item they authored and saves
- **THEN** the item SHALL be updated via the dual-write path and the change SHALL be visible immediately in the frontend

#### Scenario: Author cannot edit another user's item
- **WHEN** a verified user attempts to edit an item they did not author
- **THEN** the API SHALL return 403 Forbidden

### Requirement: Admin can edit and delete any item
Admins SHALL be able to edit the full content (title, description, tags, body, image) of any catalog item and soft-delete any item regardless of authorship.

#### Scenario: Admin edits another user's item
- **WHEN** an admin edits an item authored by a different user and saves
- **THEN** the item SHALL be updated via the dual-write path and the change SHALL be visible immediately in the frontend

#### Scenario: Admin soft-deletes any item
- **WHEN** an admin clicks delete on any item
- **THEN** the item SHALL have `archived: true` set and SHALL be hidden from the catalog immediately

### Requirement: Submission and edit forms render extended schema fields dynamically
The item creation and edit forms SHALL inspect the active schema configuration (base fields + any deployment-defined extensions) and render an appropriate input for each field. New extended fields SHALL appear in the form without code changes to the form component itself.

#### Scenario: Custom field appears in submission form
- **WHEN** a deployment has added a custom field (e.g., `location`) to the schema extension config
- **THEN** the submission form SHALL render an input for `location` alongside the base fields

#### Scenario: Custom field value is included in submitted payload
- **WHEN** a user fills in a custom field and submits the form
- **THEN** the API payload SHALL include the custom field's key and value, and it SHALL be written into the `.md` frontmatter

### Requirement: All UI components use ShadCN and Tailwind
All interactive UI elements in the submission form, edit form, admin management views, and moderation dashboard SHALL be built using ShadCN components styled with Tailwind CSS. No custom CSS files or CSS-in-JS SHALL be used.

#### Scenario: Form uses ShadCN inputs and buttons
- **WHEN** a user interacts with the content submission form
- **THEN** all inputs, buttons, and dialog elements SHALL be ShadCN components rendered with Tailwind utility classes
