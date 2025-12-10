# Product Requirements Document: Location Content Sections

## Introduction/Overview

This feature adds flexible, expandable content sections to country pages, allowing administrators to add rich informational content such as "Why ride a motorcycle in [Country]?", "Rental requirements & licenses", "Top motorcycle routes", and "Best time to visit". This content will help improve user engagement, provide valuable travel information, and enhance SEO performance by adding unique, location-specific content to each country page.

**Problem Statement:** Currently, country pages only display rental shop listings without providing travelers with essential contextual information about riding in that location. Users need practical information about requirements, routes, and local riding conditions to make informed decisions.

**Solution:** Add a flexible content management system that allows admins to create unlimited custom content sections for each country through the admin interface. Content will be stored as JSON in the countries table and displayed as expandable sections with "Read more" functionality.

---

## Goals

1. Enable administrators to add, edit, and remove custom content sections for any country
2. Provide travelers with valuable, location-specific information directly on country pages
3. Improve SEO through rich, unique content for each location
4. Create a flexible system that can be easily extended to cities in the future
5. Maintain a clean UI with collapsible sections to avoid overwhelming users

---

## User Stories

### Administrator Stories

**US1:** As an administrator, I want to add multiple content sections to a country page so that I can provide comprehensive information to travelers.

**US2:** As an administrator, I want to edit existing content sections so that I can keep information up-to-date.

**US3:** As an administrator, I want to delete content sections that are no longer relevant so that the page stays clean and accurate.

**US4:** As an administrator, I want to write content in Markdown format so that I can easily format text with headings, lists, and links.

**US5:** As an administrator, I want to include images in content sections so that I can make the content more engaging and visual.

**US6:** As an administrator, I want to reorder sections so that I can control the information hierarchy on the page.

### End User Stories

**US7:** As a traveler, I want to read about why I should ride a motorcycle in a specific country so that I can decide if it's the right destination for me.

**US8:** As a traveler, I want to learn about license requirements so that I know what documents I need before traveling.

**US9:** As a traveler, I want to see recommended routes so that I can plan my motorcycle trip.

**US10:** As a traveler, I want to expand only the sections I'm interested in so that I can quickly find relevant information without reading everything.

---

## Functional Requirements

### Database Schema Changes

**FR1:** Add a `content_sections` field to the `countries` table with type `JSONB` (nullable).

**FR2:** The `content_sections` field should store an array of section objects with the following structure:
```json
[
  {
    "id": "unique-id",
    "title": "Why ride a motorcycle in Thailand?",
    "content": "Markdown content here...",
    "order": 1,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]
```

**FR3:** Each section object must include:
- `id` (string, UUID): Unique identifier for the section
- `title` (string): The section heading
- `content` (string): Markdown-formatted content
- `order` (number): Display order (lower numbers appear first)
- `createdAt` (timestamp): When section was created
- `updatedAt` (timestamp): When section was last modified

### Admin Interface

**FR4:** Create a new admin page at `/admin/countries/[countryCode]/content` for managing content sections.

**FR5:** The admin interface must display a list of existing content sections for the selected country, showing:
- Section title
- Excerpt of content (first 100 characters)
- Order number
- Actions: Edit, Delete, Move Up/Down

**FR6:** Provide an "Add Section" button that opens a form with:
- Title input (required, max 200 characters)
- Content textarea (required, supports Markdown)
- Order input (number, defaults to last position)
- Markdown preview panel (live preview of rendered content)
- Save and Cancel buttons

**FR7:** Provide an "Edit Section" function that loads the section data into the same form for modification.

**FR8:** Provide a "Delete Section" function with confirmation dialog: "Are you sure you want to delete '[Section Title]'? This action cannot be undone."

**FR9:** Provide "Move Up" and "Move Down" buttons for each section to reorder sections without manually editing order numbers.

**FR10:** Display validation errors inline:
- Title is required and cannot exceed 200 characters
- Content is required and cannot exceed 100,000 characters
- Order must be a positive integer

**FR10a:** Display a character count indicator in the content textarea showing: "X / 100,000 characters" that updates in real-time as the user types.

**FR11:** Show success/error notifications after save/delete operations.

**FR12:** Add a link to "Manage Content" from the main countries admin list page.

### Frontend Display

**FR13:** Display content sections on country pages below the LocationHeroBanner and above the shops grid.

**FR14:** Each section must be displayed as a collapsible card with:
- Section title as heading (H2)
- "Read more" button when collapsed
- Full Markdown-rendered content when expanded
- Smooth expand/collapse animation

**FR15:** All sections must be collapsed by default on page load.

**FR16:** Users must be able to expand multiple sections simultaneously.

**FR17:** Markdown content must be rendered with proper formatting including:
- Headings (H1-H6)
- Bold, italic, underline
- Ordered and unordered lists
- Links (opening in new tabs if external)
- Images (responsive sizing)
- Code blocks

**FR18:** Sections must be displayed in ascending order based on the `order` field.

**FR19:** If a country has no content sections (empty array or null), do not display any sections component.

**FR20:** The sections container must be responsive:
- Mobile: Full width with proper padding
- Tablet/Desktop: Contained within max-width layout

**FR20a:** Section titles must handle overflow gracefully on mobile devices:
- Wrap to multiple lines if needed
- Use word-break to prevent horizontal overflow
- Maintain readability with proper line height

### Content Validation

**FR21:** Backend validation must enforce:
- Title: Required, string, 1-200 characters
- Content: Required, string, 1-100,000 characters
- Order: Required, positive integer
- ID: Required, valid UUID format

**FR22:** Frontend validation must provide immediate feedback before submission.

**FR23:** Sanitize Markdown content to prevent XSS attacks while allowing safe HTML elements.

### Image Support

**FR24:** Content sections must support images via Markdown syntax: `![alt text](image-url)`

**FR25:** Images should be responsive and not overflow their container.

**FR26:** Provide guidance in the admin UI on recommended image sizes and hosting (link to image upload/management if available).

---

## Non-Goals (Out of Scope)

**NG1:** City-level content sections are **not** included in this phase. This will be added in a future update.

**NG2:** Province-level content sections are **not** included.

**NG3:** Draft/publish workflow is **not** required. All changes are live immediately.

**NG4:** Version history or content revision tracking is **not** required.

**NG5:** Content section templates or predefined section types are **not** included. All sections are free-form.

**NG6:** Default sections are **not** automatically created for new countries.

**NG7:** Multi-language support for content sections is **not** included in this phase.

**NG8:** SEO integration (meta descriptions, structured data) is **not** required initially.

**NG9:** Content approval workflows or multi-user editing locks are **not** required.

**NG10:** Rich text WYSIWYG editor is **not** required. Simple textarea with Markdown preview is sufficient.

**NG11:** Image upload functionality within the editor is **not** required. Admins will use external image URLs.

**NG12:** Fallback or inheritance of content from country to city is **not** applicable (no city support yet).

**NG13:** Duplicate section feature is **not** required.

**NG14:** Section expand/collapse state persistence in localStorage is **not** required.

**NG15:** Separate preview mode in admin is **not** required (Markdown preview is sufficient).

**NG16:** Analytics tracking for section expansion/engagement is **not** required.

---

## Design Considerations

### UI/UX Guidelines

**DC1:** Follow the existing admin interface patterns and styling from `/admin/shops`, `/admin/motorcycles`, etc.

**DC2:** Use the existing `Modal` component for add/edit forms.

**DC3:** Use the existing card components and button styles for consistency.

**DC4:** Frontend content sections should use a clean, readable card design similar to the screenshot provided:
- White background
- Subtle border or shadow
- Clear typography hierarchy
- Adequate padding and spacing

**DC5:** "Read more" button should visually indicate expand/collapse state (e.g., chevron icon that rotates).

**DC6:** Markdown preview should closely match the frontend rendering.

### Accessibility

**DC7:** All interactive elements (buttons, expandable sections) must be keyboard accessible.

**DC8:** Use semantic HTML (proper heading hierarchy, button elements).

**DC9:** Ensure sufficient color contrast for text readability.

**DC10:** Provide ARIA labels for screen readers on expand/collapse buttons.

---

## Technical Considerations

### Technology Stack

**TC1:** Use **React Markdown** or similar library for rendering Markdown on the frontend.

**TC2:** Use **marked** or **remark** for Markdown preview in the admin interface.

**TC3:** Use **DOMPurify** or Next.js built-in sanitization for XSS protection.

**TC4:** Store JSON data using Supabase's JSONB column type for efficient querying.

### Database Migration

**TC5:** Create a migration to add `content_sections` JSONB column to `countries` table:
```sql
ALTER TABLE countries 
ADD COLUMN content_sections JSONB DEFAULT NULL;
```

**TC6:** Add a database index if querying by content becomes necessary (optional for initial implementation).

### Service Layer

**TC7:** Create `countryContentService` with methods:
- `getContentSections(countryCode: string)`: Fetch sections for a country
- `updateContentSections(countryCode: string, sections: ContentSection[])`: Update all sections
- `addContentSection(countryCode: string, section: ContentSection)`: Add new section
- `updateContentSection(countryCode: string, sectionId: string, updates: Partial<ContentSection>)`: Update specific section
- `deleteContentSection(countryCode: string, sectionId: string)`: Remove section
- `reorderSections(countryCode: string, sectionIds: string[])`: Update order

**TC8:** Type definitions should be added to project types file:
```typescript
interface ContentSection {
  id: string;
  title: string;
  content: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}
```

### API Routes

**TC9:** Create API routes for admin operations:
- `GET /api/admin/countries/[countryCode]/content` - Fetch sections
- `POST /api/admin/countries/[countryCode]/content` - Add section
- `PUT /api/admin/countries/[countryCode]/content/[sectionId]` - Update section
- `DELETE /api/admin/countries/[countryCode]/content/[sectionId]` - Delete section
- `PATCH /api/admin/countries/[countryCode]/content/reorder` - Reorder sections

**TC10:** All API routes must check for admin authentication.

### Frontend Components

**TC11:** Create reusable components:
- `ContentSectionCard`: Displays individual expandable section
- `ContentSectionsContainer`: Wraps all sections with proper spacing
- `ContentSectionEditor`: Admin form for add/edit
- `MarkdownPreview`: Live preview component for admin

### Performance

**TC12:** Content sections are fetched as part of the country page data (no additional requests).

**TC13:** Markdown rendering should be memoized to avoid re-renders.

**TC14:** Large content (100K chars) should render smoothly; test performance with maximum content length.

### Future Extensibility

**TC15:** The JSON structure should be designed to easily extend to cities by using the same pattern in the `cities` table.

**TC16:** Consider using a consistent field name (`content_sections`) across all location tables for future code reusability.

---

## Success Metrics

**SM1:** At least 50% of countries have at least one content section added within 2 months of launch.

**SM2:** Average time spent on country pages increases by 20% compared to pre-implementation baseline.

**SM3:** Bounce rate on country pages decreases by 10%.

**SM4:** Admins can successfully add/edit/delete content sections without needing technical support.

**SM5:** Zero reported bugs related to XSS or security vulnerabilities in content rendering.

**SM6:** Page load time remains under 2 seconds even with 10+ content sections.

**SM7:** Mobile users successfully interact with expandable sections (measured via analytics).

---

## Open Questions

**Status:** All open questions have been resolved and incorporated into requirements above.

### Resolved Decisions:
- ✅ Character count indicator will be implemented (FR10a)
- ✅ No duplicate section feature needed
- ✅ No localStorage persistence for expand/collapse state
- ✅ No separate preview mode in admin
- ✅ Long title handling specified in FR20a
- ✅ No analytics tracking for section expansion
- ✅ No copy/template feature from country to city

---

## Implementation Phases

### Phase 1: Core Functionality (Countries Only)
- Database migration
- Service layer and API routes
- Admin interface for managing sections
- Frontend display on country pages
- Basic validation and security

### Phase 2: Future Enhancement (Cities)
- Extend to cities table
- Update admin UI to support city content
- Consider templating or inheritance features

### Phase 3: Advanced Features (Future Consideration)
- SEO integration
- Multi-language support
- Image upload integration
- Rich text editor
- Content analytics

---

## Acceptance Criteria

**AC1:** An admin can navigate to a country's content management page from the admin countries list.

**AC2:** An admin can add a new content section with a title and Markdown content, and see it saved successfully.

**AC3:** An admin can edit an existing section and see the changes reflected on the live country page.

**AC4:** An admin can delete a section with a confirmation prompt, and it is removed from the country page.

**AC5:** An admin can reorder sections using up/down buttons, and the order is reflected on the live page.

**AC6:** Validation errors are displayed when required fields are missing or exceed max length.

**AC7:** Markdown content renders correctly on the country page including headings, lists, links, and images.

**AC8:** All sections are collapsed by default when a user visits a country page.

**AC9:** A user can expand a section by clicking "Read more" and see the full content with smooth animation.

**AC10:** A user can expand multiple sections simultaneously.

**AC11:** Countries with no content sections display no sections component (shops grid appears directly below hero).

**AC12:** Content sections are responsive and display correctly on mobile, tablet, and desktop devices.

**AC13:** No XSS vulnerabilities are present when rendering user-generated Markdown content.

**AC14:** Page performance remains acceptable with up to 10 content sections containing maximum-length content (100,000 characters each).

**AC15:** Character count indicator displays correctly in real-time as the admin types content.

**AC16:** Long section titles wrap properly on mobile devices without causing horizontal scroll or layout breaks.

---

## Timeline Estimate

- Database migration and types: **0.5 day**
- Service layer and API routes: **1 day**
- Admin UI (list, add, edit, delete, reorder): **2 days**
- Frontend components and display: **1.5 days**
- Markdown rendering and sanitization: **0.5 day**
- Testing and bug fixes: **1 day**
- Documentation: **0.5 day**

**Total Estimated Time:** 7 days

---

## Dependencies

- Existing admin authentication and authorization system
- Supabase database access
- Markdown rendering library (to be installed)
- Existing UI component library

---

## Risks and Mitigation

**Risk 1:** XSS vulnerabilities from rendering user-generated Markdown.
- **Mitigation:** Use a trusted sanitization library and test thoroughly with malicious input.

**Risk 2:** Performance degradation with very large content or many sections.
- **Mitigation:** Implement content length limits and test with maximum data.

**Risk 3:** Mobile layout issues with expandable sections.
- **Mitigation:** Test thoroughly on various mobile devices and screen sizes.

**Risk 4:** Admins accidentally deleting important content.
- **Mitigation:** Implement confirmation dialogs and consider adding soft delete or content history in the future.

---

*Document Version: 1.1*  
*Created: December 9, 2024*  
*Updated: December 9, 2024*  
*Status: Ready for Implementation*

