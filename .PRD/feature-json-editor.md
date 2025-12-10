# JSON Editor Feature

## Overview
A raw JSON editor for advanced users to directly edit content sections data. This feature allows bulk operations, copying content between countries, and manual data manipulation.

---

## How to Access

1. Navigate to: `/admin/countries/[COUNTRY_CODE]/content`
2. Click the **"Edit JSON"** button (next to "Add Section")
3. The JSON editor modal will open

---

## Features

### ✅ What You Can Do:

1. **View Raw JSON**: See all content sections as formatted JSON
2. **Edit Bulk Data**: Add, modify, or remove multiple sections at once
3. **Copy/Paste**: Copy sections between countries
4. **Format JSON**: Auto-format button for readability
5. **Validation**: Comprehensive validation before saving
6. **Character Count**: Real-time character counter

### 🛡️ Safety Features:

1. **Syntax Validation**: Checks for valid JSON format
2. **Structure Validation**: Ensures all required fields exist
3. **Field Validation**: Validates field types and constraints
4. **Length Checks**: Enforces title (200 chars) and content (100,000 chars) limits
5. **Direct Database Save**: Bypasses API for atomic updates

---

## JSON Structure

Each content section must have these fields:

```json
{
  "id": "uuid-string",           // Unique identifier (required)
  "title": "Section Title",      // Max 200 characters (required)
  "content": "Markdown content", // Max 100,000 characters (required)
  "order": 1,                    // Positive integer (required)
  "createdAt": "ISO-8601",       // ISO date string (required)
  "updatedAt": "ISO-8601"        // ISO date string (required)
}
```

### Example JSON:

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Why Ride a Motorcycle in Greece?",
    "content": "Greece offers stunning coastal roads...",
    "order": 1,
    "createdAt": "2024-12-10T10:00:00Z",
    "updatedAt": "2024-12-10T10:00:00Z"
  },
  {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "title": "Best Routes in Greece",
    "content": "## Top Motorcycle Routes\n\n1. Athens to Delphi...",
    "order": 2,
    "createdAt": "2024-12-10T10:05:00Z",
    "updatedAt": "2024-12-10T10:05:00Z"
  }
]
```

---

## Common Use Cases

### 1. Copy Content from One Country to Another

**Steps:**
1. Go to source country's content page
2. Click "Edit JSON"
3. Copy all JSON content (Cmd/Ctrl + A, Cmd/Ctrl + C)
4. Go to target country's content page
5. Click "Edit JSON"
6. Paste JSON (Cmd/Ctrl + V)
7. **Important**: Change all `id` fields to new UUIDs
8. Update country-specific text in titles/content
9. Click "Save Changes"

### 2. Bulk Add Multiple Sections

**Steps:**
1. Click "Edit JSON"
2. Add new section objects to the array
3. Ensure each has unique `id` (use UUID generator)
4. Set sequential `order` values
5. Add proper timestamps
6. Click "Save Changes"

### 3. Remove All Sections

**Steps:**
1. Click "Edit JSON"
2. Replace content with empty array: `[]`
3. Click "Save Changes"

### 4. Reorder All Sections

**Steps:**
1. Click "Edit JSON"
2. Rearrange section objects in array
3. Update `order` field to match new positions
4. Click "Save Changes"

---

## Validation Rules

The JSON editor validates:

### Array Validation
- ✅ Must be a valid JSON array
- ✅ Can be empty `[]` to remove all sections

### Field Validation (per section)
- ✅ `id`: Required, must be string
- ✅ `title`: Required, string, max 200 chars
- ✅ `content`: Required, string, max 100,000 chars
- ✅ `order`: Required, positive integer
- ✅ `createdAt`: Required, ISO date string
- ✅ `updatedAt`: Required, ISO date string

### Error Messages
- Clear, specific error messages
- Indicates which section has the error
- Shows what field is invalid

---

## UI Features

### Buttons:

1. **Format JSON**: Prettifies JSON with proper indentation
2. **Cancel**: Closes modal without saving
3. **Save Changes**: Validates and saves to database

### Helper Elements:

1. **Instructions Box**: Blue info box with usage guidelines
2. **Character Counter**: Shows total character count
3. **Error Alerts**: Red alert box for validation errors
4. **Success Message**: Green alert after successful save

---

## Technical Details

### Implementation:
- **Component**: `/app/admin/countries/[countryCode]/content/page.tsx`
- **Save Method**: Direct Supabase update (bypasses API)
- **Validation**: Client-side before save
- **Modal Size**: Extra large for comfortable editing

### Why Direct Database Save?
- Atomic operation (all-or-nothing)
- Faster for bulk operations
- Avoids multiple API calls
- Maintains data consistency

### Security:
- ✅ Admin-only access (same as rest of content management)
- ✅ Supabase RLS policies apply
- ✅ Client-side validation prevents bad data
- ✅ Server-side validation via RLS

---

## Tips & Best Practices

### ✅ DO:
- Always use "Format JSON" before saving for readability
- Generate new UUIDs when copying content
- Update timestamps when making changes
- Test with small changes first
- Keep backups before major edits

### ❌ DON'T:
- Don't use duplicate IDs
- Don't skip required fields
- Don't use negative order numbers
- Don't exceed character limits
- Don't use invalid date formats

---

## Troubleshooting

### "Invalid JSON syntax"
- **Cause**: Malformed JSON (missing brackets, quotes, commas)
- **Fix**: Click "Format JSON" or use a JSON validator

### "Section X: Missing or invalid 'field' field"
- **Cause**: Required field is missing or wrong type
- **Fix**: Add the missing field with correct type

### "Title/Content cannot exceed X characters"
- **Cause**: Field too long
- **Fix**: Reduce content length or split into multiple sections

### "Order must be a positive integer"
- **Cause**: Order is negative, decimal, or not a number
- **Fix**: Use positive whole numbers (1, 2, 3, etc.)

---

## Example: Complete Workflow

### Scenario: Copy Greece content to Italy, customize it

```bash
# 1. Get Greece content
Go to: /admin/countries/GR/content
Click: "Edit JSON"
Copy: All JSON

# 2. Paste to Italy
Go to: /admin/countries/IT/content  
Click: "Edit JSON"
Paste: JSON from Greece

# 3. Customize
- Change all UUIDs (use online UUID generator)
- Replace "Greece" with "Italy" in titles/content
- Update any Greece-specific route names
- Adjust order numbers if needed
- Update timestamps to current time

# 4. Save
Click: "Format JSON" (to check syntax)
Click: "Save Changes"
Result: Italy now has customized Greek content structure
```

---

## Future Enhancements (Not Implemented)

Potential improvements:
- Import/Export JSON files
- JSON schema validation
- Duplicate ID detection
- Undo/Redo functionality
- Side-by-side diff view
- Template library
- Version history

---

## Summary

The JSON editor provides:
- ✅ Advanced control for power users
- ✅ Bulk operations capability
- ✅ Copy/paste between countries
- ✅ Comprehensive validation
- ✅ Safe, atomic updates
- ✅ Simple, intuitive UI

**Status**: ✅ **Production Ready**

