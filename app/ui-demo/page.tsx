'use client'

import { useState } from 'react'
import {
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  Switch,
  RadioGroup,
  RadioOption,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Alert,
  Badge,
  Spinner,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  SkeletonCard,
  SkeletonList,
  LoadingOverlay,
  EmptyState
} from '@/components/ui'
import { 
  HeartIcon, 
  StarIcon, 
  UserIcon,
  InboxIcon 
} from '@heroicons/react/24/outline'

export default function UIDemo() {
  const [modalOpen, setModalOpen] = useState(false)
  const [switchChecked, setSwitchChecked] = useState(false)
  const [checkboxChecked, setCheckboxChecked] = useState(false)
  const [radioValue, setRadioValue] = useState('')
  const [selectValue, setSelectValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [alertVisible, setAlertVisible] = useState(true)

  const selectOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' }
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            RideVault UI Components
          </h1>
          <p className="text-lg text-gray-600">
            A comprehensive showcase of our reusable UI component library
          </p>
        </div>

        <div className="space-y-16">
          {/* Buttons */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Buttons</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Button Variants</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="primary">Primary Button</Button>
                  <Button variant="secondary">Secondary Button</Button>
                  <Button variant="outline">Outline Button</Button>
                  <Button variant="ghost">Ghost Button</Button>
                  <Button variant="danger">Danger Button</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Button Sizes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button size="sm">Small Button</Button>
                  <Button size="md">Medium Button</Button>
                  <Button size="lg">Large Button</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Button States</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button loading>Loading Button</Button>
                  <Button disabled>Disabled Button</Button>
                  <Button fullWidth>Full Width Button</Button>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Form Components */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Form Components</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Input Fields</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input 
                    label="Email" 
                    type="email" 
                    placeholder="Enter your email"
                    hint="We'll never share your email"
                  />
                  <Input 
                    label="Password" 
                    type="password" 
                    placeholder="Enter password"
                    error="Password is required"
                  />
                  <Textarea 
                    label="Message" 
                    placeholder="Enter your message"
                    rows={4}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Select & Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select
                    label="Choose Option"
                    options={selectOptions}
                    value={selectValue}
                    onChange={(e) => setSelectValue(e.target.value)}
                    placeholder="Select an option"
                  />
                  
                  <div className="space-y-3">
                    <Checkbox
                      label="Accept terms and conditions"
                      description="By checking this, you agree to our terms"
                      checked={checkboxChecked}
                      onChange={(e) => setCheckboxChecked(e.target.checked)}
                    />
                    
                    <Switch
                      label="Enable notifications"
                      description="Get updates about your bookings"
                      checked={switchChecked}
                      onChange={setSwitchChecked}
                    />
                  </div>

                  <RadioGroup
                    label="Preferred Contact Method"
                    value={radioValue}
                    onChange={setRadioValue}
                    name="contact"
                  >
                    <RadioOption value="email" label="Email" />
                    <RadioOption value="phone" label="Phone" />
                    <RadioOption value="sms" label="SMS" />
                  </RadioGroup>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Feedback Components */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Feedback Components</h2>
            <div className="space-y-6">
              {alertVisible && (
                <Alert
                  variant="info"
                  title="Information"
                  description="This is an informational alert message."
                  dismissible
                  onDismiss={() => setAlertVisible(false)}
                />
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Alert Variants</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert variant="success" title="Success!" description="Operation completed successfully." />
                    <Alert variant="warning" title="Warning" description="Please review your input." />
                    <Alert variant="error" title="Error" description="Something went wrong." />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Badges & Spinners</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="default">Default</Badge>
                      <Badge variant="primary">Primary</Badge>
                      <Badge variant="success">Success</Badge>
                      <Badge variant="warning">Warning</Badge>
                      <Badge variant="danger">Danger</Badge>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <Spinner size="sm" />
                      <Spinner size="md" />
                      <Spinner size="lg" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {/* Loading States */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Loading States</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Skeleton Loading</CardTitle>
                </CardHeader>
                <CardContent>
                  <SkeletonCard />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Loading Overlay</CardTitle>
                </CardHeader>
                <CardContent>
                  <LoadingOverlay isLoading={loading}>
                    <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                      <p className="text-gray-500">Content goes here</p>
                    </div>
                  </LoadingOverlay>
                  <Button 
                    onClick={() => {
                      setLoading(true)
                      setTimeout(() => setLoading(false), 2000)
                    }}
                    className="mt-4"
                  >
                    Toggle Loading
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Empty State */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Empty States</h2>
            <Card>
              <CardContent>
                <EmptyState
                  icon={<InboxIcon />}
                  title="No motorcycles found"
                  description="Try adjusting your search criteria or browse our featured bikes."
                  action={
                    <Button variant="primary">Browse Featured Bikes</Button>
                  }
                />
              </CardContent>
            </Card>
          </section>

          {/* Modal */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Modal</h2>
            <Card>
              <CardHeader>
                <CardTitle>Modal Component</CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setModalOpen(true)}>
                  Open Modal
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Example Modal"
        description="This is a demonstration of the modal component"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            This modal demonstrates proper focus management, keyboard navigation, 
            and accessibility features. It includes backdrop blur and smooth animations.
          </p>
          
          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
} 