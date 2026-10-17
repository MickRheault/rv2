# Spec: Display Beta Indicator in Site Brand Header (#145)

## Problem Statement
As Global Moto Rentals (RideVault) serves both active riders and a technical portfolio showcase, visitors have no immediate visual cue in the site header indicating that the platform is currently in **Beta**. Adding a clean, always-visible **Beta** pill badge alongside the brand logo and title sets clear expectations across both desktop and mobile viewports.

## Requirements & Design Decisions
1. **Placement in Top Header Navigation Bar**:
   - Render a `"Beta"` badge inside the primary brand `<Link href="/">` in [`components/common/Header.tsx`](file:///Users/mick/workspace/personal/rv2/components/common/Header.tsx), positioned immediately after the `"Global Moto Rentals"` brand title.
2. **Responsive Visibility (Desktop & Mobile)**:
   - On desktop (`sm` and above), the `"Beta"` badge sits next to the `"Global Moto Rentals"` text.
   - On mobile (`< sm`), where the `"Global Moto Rentals"` text is hidden (`hidden sm:block`), the `"Beta"` badge remains visible next to the logo mark so mobile visitors also see the beta status.
3. **Visual Styling**:
   - Style the badge as a subtle blue pill (`bg-blue-50 text-blue-700 border border-blue-200`) with compact typography (`text-xs font-medium px-2 py-0.5 rounded-full`).

## Testing Strategy & Seams
- **Component Test Seam** ([`components/common/Header.test.tsx`](file:///Users/mick/workspace/personal/rv2/components/common/Header.test.tsx)):
  - Verify that `Header` renders the `"Beta"` badge inside the home brand link alongside `"Global Moto Rentals"`.
  - Verify that the `"Beta"` badge has the expected blue pill styling (`bg-blue-50`, `text-blue-700`, `border-blue-200`) and does not have `hidden` classes that would hide it on mobile viewports.

## Out of Scope
- Modifying SEO `<title>` metadata or OpenGraph titles.
- Adding a separate dismissible banner or modal.
