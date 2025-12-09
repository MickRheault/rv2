# Task List: Location Content Sections

Based on: `prd-location-content-sections.md`

**Implementation Approach:** KISS (Keep It Simple, Stupid) - prioritize simple, straightforward solutions using existing patterns.

## Relevant Files

### Database & Types
- `supabase/migrations/20241209000000_add_content_sections_to_countries.sql` - Migration to add content_sections JSONB column to countries table
- `lib/supabase/database.types.ts` - Updated with content_sections field for countries table (to be regenerated)
- `types/index.ts` - ContentSection interface definition (to be created)

### Services
- `services/countryContent.ts` - New service for content section CRUD operations

### API Routes
- `app/api/admin/countries/[countryCode]/content/route.ts` - GET all sections, POST new section
- `app/api/admin/countries/[countryCode]/content/[sectionId]/route.ts` - PUT (update), DELETE specific section
- `app/api/admin/countries/[countryCode]/content/reorder/route.ts` - PATCH to reorder sections

### Admin Interface
- `app/admin/countries/[countryCode]/content/page.tsx` - Main admin page for managing content sections
- `components/admin/ContentSectionEditor.tsx` - Form component for add/edit (can use Modal)
- `components/admin/ContentSectionList.tsx` - List of sections with actions

### Frontend Components
- `components/content/ContentSectionCard.tsx` - Individual expandable section card
- `components/content/ContentSectionsContainer.tsx` - Wrapper for all sections
- `app/[country]/page.tsx` - Modified to display content sections

### Dependencies
- `package.json` - Add react-markdown and sanitization library

### Notes
- Follow existing patterns from `/app/admin/shops`, `/app/admin/motorcycles` for consistency
- Reuse existing Modal, Button, and form components
- Keep components simple and focused on single responsibilities
- No need for complex state management - React state is sufficient

## Tasks

- [ ] 1.0 Database Setup and Type Definitions
  - [x] 1.1 Create database migration file to add `content_sections` JSONB column to countries table
  - [ ] 1.2 Run migration using Supabase CLI or dashboard
  - [ ] 1.3 Regenerate database types using `npx supabase gen types typescript`
  - [ ] 1.4 Create `ContentSection` TypeScript interface in `types/index.ts`
  - [ ] 1.5 Verify the countries table now includes content_sections field in database.types.ts

- [ ] 2.0 Service Layer and Business Logic
  - [ ] 2.1 Create `services/countryContent.ts` file
  - [ ] 2.2 Implement `getContentSections(countryCode: string)` - fetch sections from country record
  - [ ] 2.3 Implement `addContentSection(countryCode, section)` - append new section to array
  - [ ] 2.4 Implement `updateContentSection(countryCode, sectionId, updates)` - update specific section in array
  - [ ] 2.5 Implement `deleteContentSection(countryCode, sectionId)` - remove section from array
  - [ ] 2.6 Implement `reorderSections(countryCode, sectionIds)` - update order values based on array
  - [ ] 2.7 Add simple validation helpers (title length, content length, required fields)

- [ ] 3.0 API Routes for Content Management
  - [ ] 3.1 Create `app/api/admin/countries/[countryCode]/content/route.ts`
  - [ ] 3.2 Implement GET handler - fetch all sections for a country
  - [ ] 3.3 Implement POST handler - add new section (generate UUID, timestamps)
  - [ ] 3.4 Add admin authentication check to both handlers
  - [ ] 3.5 Create `app/api/admin/countries/[countryCode]/content/[sectionId]/route.ts`
  - [ ] 3.6 Implement PUT handler - update specific section
  - [ ] 3.7 Implement DELETE handler - delete specific section
  - [ ] 3.8 Add admin authentication checks to both handlers
  - [ ] 3.9 Create `app/api/admin/countries/[countryCode]/content/reorder/route.ts`
  - [ ] 3.10 Implement PATCH handler - reorder sections based on provided array
  - [ ] 3.11 Add error handling and validation to all API routes

- [ ] 4.0 Admin Interface for Managing Content Sections
  - [ ] 4.1 Create `app/admin/countries/[countryCode]/content/page.tsx` admin page
  - [ ] 4.2 Fetch and display list of existing sections (title, excerpt, order)
  - [ ] 4.3 Add "Manage Content" link to main `/app/admin/countries/page.tsx` list
  - [ ] 4.4 Create `components/admin/ContentSectionEditor.tsx` form component
  - [ ] 4.5 Add form fields: title input, content textarea, order input
  - [ ] 4.6 Add character count indicator for content field (live updates)
  - [ ] 4.7 Add simple Markdown preview using react-markdown
  - [ ] 4.8 Implement form validation (required fields, max lengths)
  - [ ] 4.9 Add "Save" button that calls POST or PUT API
  - [ ] 4.10 Create "Add Section" button that opens editor in Modal
  - [ ] 4.11 Add "Edit" button for each section that opens editor with populated data
  - [ ] 4.12 Add "Delete" button with confirmation dialog
  - [ ] 4.13 Add "Move Up" and "Move Down" buttons for reordering
  - [ ] 4.14 Implement reorder logic that calls PATCH API
  - [ ] 4.15 Add success/error toast notifications after operations
  - [ ] 4.16 Add help text about Markdown syntax and image support

- [ ] 5.0 Frontend Display Components for Country Pages
  - [ ] 5.1 Install react-markdown: `npm install react-markdown`
  - [ ] 5.2 Install sanitization library: `npm install rehype-sanitize`
  - [ ] 5.3 Create `components/content/ContentSectionCard.tsx` component
  - [ ] 5.4 Implement collapsed state (showing only title and "Read more" button)
  - [ ] 5.5 Implement expanded state (showing full Markdown content)
  - [ ] 5.6 Add chevron icon that rotates on expand/collapse
  - [ ] 5.7 Add smooth expand/collapse animation (CSS transition)
  - [ ] 5.8 Render Markdown content using react-markdown with rehype-sanitize
  - [ ] 5.9 Style Markdown elements (headings, lists, links, images)
  - [ ] 5.10 Make images responsive (max-width: 100%, height: auto)
  - [ ] 5.11 Create `components/content/ContentSectionsContainer.tsx` wrapper
  - [ ] 5.12 Sort sections by order field (ascending)
  - [ ] 5.13 Handle empty/null content_sections gracefully (render nothing)
  - [ ] 5.14 Add proper spacing and responsive layout
  - [ ] 5.15 Modify `app/[country]/page.tsx` to fetch content_sections from country data
  - [ ] 5.16 Integrate ContentSectionsContainer below LocationHeroBanner, above shops grid
  - [ ] 5.17 Test responsive behavior on mobile, tablet, desktop
  - [ ] 5.18 Ensure long titles wrap properly without breaking layout

- [ ] 6.0 Testing, Validation, and Security
  - [ ] 6.1 Test XSS protection - try injecting script tags in Markdown content
  - [ ] 6.2 Test validation - empty fields, exceeding max lengths
  - [ ] 6.3 Test with maximum content length (100,000 characters)
  - [ ] 6.4 Test with 10+ sections on a country page
  - [ ] 6.5 Test all CRUD operations (add, edit, delete, reorder)
  - [ ] 6.6 Test that only admins can access content management APIs
  - [ ] 6.7 Test Markdown rendering (headings, lists, links, images)
  - [ ] 6.8 Test expand/collapse functionality (multiple sections simultaneously)
  - [ ] 6.9 Test mobile responsiveness and touch interactions
  - [ ] 6.10 Test that countries without sections display no content component
  - [ ] 6.11 Run `npm run build` to ensure no build errors
  - [ ] 6.12 Test page performance with large content sections

---

**Implementation Notes:**
- Start with task 1.0, complete all sub-tasks before moving to 2.0
- Reuse existing patterns from admin pages (shops, motorcycles) for consistency
- Keep components simple - avoid over-engineering
- Test incrementally after each major task completion
- Use existing UI components (Modal, Button, Input) instead of creating new ones

