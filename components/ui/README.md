# RideVault UI Component Library

A comprehensive, reusable UI component library built with React, TypeScript, and Tailwind CSS. Designed following modern best practices with accessibility, performance, and developer experience in mind.

## Features

- 🎨 **Modern Design System** - Consistent styling with Tailwind CSS
- ♿ **Accessibility First** - WCAG compliant with proper ARIA attributes
- 📱 **Mobile Responsive** - Mobile-first design approach
- 🔧 **TypeScript Support** - Full type safety and IntelliSense
- 🎭 **Flexible Variants** - Multiple sizes, colors, and states
- 🚀 **Performance Optimized** - Lightweight and tree-shakeable
- 🧪 **Well Tested** - Comprehensive test coverage

## Installation

```bash
# Components are already available in the project
import { Button, Input, Card } from '@/components/ui'
```

## Components

### Core Form Components

#### Button
Versatile button component with multiple variants and states.

```tsx
import { Button } from '@/components/ui'

// Basic usage
<Button>Click me</Button>

// With variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger">Danger</Button>

// With sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

// With states
<Button loading>Loading...</Button>
<Button disabled>Disabled</Button>
<Button fullWidth>Full Width</Button>
```

#### Input
Form input component with validation and styling.

```tsx
import { Input } from '@/components/ui'

<Input
  label="Email"
  type="email"
  placeholder="Enter your email"
  hint="We'll never share your email"
  error="Email is required"
/>
```

#### Textarea
Multi-line text input component.

```tsx
import { Textarea } from '@/components/ui'

<Textarea
  label="Message"
  placeholder="Enter your message"
  rows={4}
  resize={false}
/>
```

#### Select
Dropdown select component with custom styling.

```tsx
import { Select } from '@/components/ui'

const options = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' }
]

<Select
  label="Choose Option"
  options={options}
  placeholder="Select an option"
  value={value}
  onChange={handleChange}
/>
```

#### Checkbox
Checkbox component with labels and descriptions.

```tsx
import { Checkbox } from '@/components/ui'

<Checkbox
  label="Accept terms"
  description="By checking this, you agree to our terms"
  checked={checked}
  onChange={handleChange}
/>
```

#### Switch
Toggle switch component for boolean values.

```tsx
import { Switch } from '@/components/ui'

<Switch
  label="Enable notifications"
  description="Get updates about your bookings"
  checked={enabled}
  onChange={setEnabled}
/>
```

#### RadioGroup
Radio button group for single selection.

```tsx
import { RadioGroup, RadioOption } from '@/components/ui'

<RadioGroup
  label="Preferred Contact"
  value={contact}
  onChange={setContact}
  name="contact"
>
  <RadioOption value="email" label="Email" />
  <RadioOption value="phone" label="Phone" />
  <RadioOption value="sms" label="SMS" />
</RadioGroup>
```

### Layout Components

#### Card
Flexible card component with subcomponents.

```tsx
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui'

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description</CardDescription>
  </CardHeader>
  <CardContent>
    Card content goes here
  </CardContent>
  <CardFooter>
    Card footer content
  </CardFooter>
</Card>
```

### Feedback Components

#### Alert
Alert component for notifications and messages.

```tsx
import { Alert } from '@/components/ui'

<Alert
  variant="success"
  title="Success!"
  description="Operation completed successfully"
  dismissible
  onDismiss={handleDismiss}
/>
```

#### Badge
Small badge component for labels and status indicators.

```tsx
import { Badge } from '@/components/ui'

<Badge variant="primary">New</Badge>
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="danger">Error</Badge>
```

#### Spinner
Loading spinner component.

```tsx
import { Spinner } from '@/components/ui'

<Spinner size="md" color="primary" />
```

### Overlay Components

#### Modal
Accessible modal component with focus management.

```tsx
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui'

<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Modal Title"
  description="Modal description"
  size="md"
>
  <div>Modal content</div>
</Modal>

// Or with subcomponents
<Modal isOpen={isOpen} onClose={handleClose}>
  <ModalHeader>
    <h2>Custom Header</h2>
  </ModalHeader>
  <ModalBody>
    <p>Custom body content</p>
  </ModalBody>
  <ModalFooter>
    <Button onClick={handleClose}>Close</Button>
  </ModalFooter>
</Modal>
```

### Loading States

#### Skeleton Components
Loading skeleton components for better UX.

```tsx
import { SkeletonText, SkeletonCard, SkeletonList } from '@/components/ui'

<SkeletonCard />
<SkeletonList count={5} />
<SkeletonText className="h-4 w-32" />
```

#### Loading Overlay
Overlay loading state for existing content.

```tsx
import { LoadingOverlay } from '@/components/ui'

<LoadingOverlay isLoading={isLoading}>
  <div>Content that can be in loading state</div>
</LoadingOverlay>
```

#### Empty State
Component for empty states and no-data scenarios.

```tsx
import { EmptyState } from '@/components/ui'

<EmptyState
  icon={<InboxIcon />}
  title="No items found"
  description="Try adjusting your search criteria"
  action={<Button>Add New Item</Button>}
/>
```

## Design System

### Colors
- **Primary**: Blue (`blue-600`)
- **Secondary**: Purple (`purple-600`)
- **Success**: Green (`green-600`)
- **Warning**: Yellow (`yellow-600`)
- **Danger**: Red (`red-600`)
- **Gray**: Neutral grays

### Typography
- **Font Family**: System fonts stack
- **Sizes**: `text-xs` to `text-4xl`
- **Weights**: `font-normal`, `font-medium`, `font-semibold`, `font-bold`

### Spacing
- **Padding**: `p-2` to `p-8`
- **Margins**: `m-2` to `m-8`
- **Gaps**: `gap-2` to `gap-8`

### Border Radius
- **Small**: `rounded-lg` (8px)
- **Medium**: `rounded-xl` (12px)
- **Large**: `rounded-2xl` (16px)
- **Full**: `rounded-full`

## Accessibility

All components follow WCAG 2.1 AA guidelines:

- ✅ Keyboard navigation support
- ✅ Screen reader compatibility
- ✅ Focus management
- ✅ ARIA attributes
- ✅ Color contrast compliance
- ✅ Touch target sizing (44px minimum)

## Best Practices

### Component Usage
```tsx
// ✅ Good - Use semantic HTML and proper labeling
<Input
  label="Email Address"
  type="email"
  required
  aria-describedby="email-hint"
/>

// ❌ Avoid - Missing labels and semantic meaning
<input type="text" placeholder="Email" />
```

### State Management
```tsx
// ✅ Good - Controlled components
const [value, setValue] = useState('')
<Input value={value} onChange={(e) => setValue(e.target.value)} />

// ✅ Also good - Uncontrolled with ref
const inputRef = useRef<HTMLInputElement>(null)
<Input ref={inputRef} />
```

### Performance
```tsx
// ✅ Good - Import only what you need
import { Button, Input } from '@/components/ui'

// ❌ Avoid - Importing entire library
import * as UI from '@/components/ui'
```

## Testing

Components are tested using Jest and React Testing Library:

```bash
npm test components/ui/Button.test.tsx
```

## Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

## Contributing

1. Follow the existing component structure
2. Include TypeScript interfaces
3. Add proper accessibility attributes
4. Write comprehensive tests
5. Update documentation

## Component Usage

All UI components are imported from `@/components/ui` and used throughout the application:
- Forms use Input, Button, Select, Checkbox, etc.
- Data display uses Card, Badge, Table components
- Navigation uses Pagination component
- Feedback uses Alert, Spinner, Modal components 