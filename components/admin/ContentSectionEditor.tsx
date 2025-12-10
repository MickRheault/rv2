'use client'

import { useState, useEffect } from 'react'
import { Modal, Button, Input, Textarea, Alert } from '@/components/ui'
import { ContentSection } from '@/types'

interface ContentSectionEditorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (section: Omit<ContentSection, 'id' | 'createdAt' | 'updatedAt'> | ContentSection) => Promise<void>
  section?: ContentSection | null
  mode: 'create' | 'edit'
}

export function ContentSectionEditor({
  isOpen,
  onClose,
  onSave,
  section,
  mode
}: ContentSectionEditorProps) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    order: 1
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Reset form when modal opens/closes or section changes
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && section) {
        setFormData({
          title: section.title,
          content: section.content,
          order: section.order
        })
      } else {
        setFormData({
          title: '',
          content: '',
          order: 1
        })
      }
      setError(null)
      setShowPreview(false)
    }
  }, [isOpen, section, mode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!formData.title.trim()) {
      setError('Title is required')
      return
    }
    if (formData.title.length > 200) {
      setError('Title cannot exceed 200 characters')
      return
    }
    if (!formData.content.trim()) {
      setError('Content is required')
      return
    }
    if (formData.content.length > 100000) {
      setError('Content cannot exceed 100,000 characters')
      return
    }
    if (formData.order < 0 || !Number.isInteger(formData.order)) {
      setError('Order must be a positive integer')
      return
    }

    try {
      setLoading(true)
      
      if (mode === 'edit' && section) {
        await onSave({
          ...section,
          ...formData
        })
      } else {
        await onSave(formData)
      }
      
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save section')
    } finally {
      setLoading(false)
    }
  }

  const characterCount = formData.content.length
  const maxChars = 100000

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Add Content Section' : 'Edit Content Section'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="error" description={error} />
        )}

        {/* Title Input */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Why ride a motorcycle in Thailand?"
            maxLength={200}
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-500">
            {formData.title.length} / 200 characters
          </p>
        </div>

        {/* Order Input */}
        <div>
          <label htmlFor="order" className="block text-sm font-medium text-gray-700 mb-1">
            Display Order
          </label>
          <Input
            id="order"
            type="number"
            min="1"
            value={formData.order}
            onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-500">
            Lower numbers appear first
          </p>
        </div>

        {/* Content Textarea */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="content" className="block text-sm font-medium text-gray-700">
              Content (Markdown) <span className="text-red-500">*</span>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? 'Edit' : 'Preview'}
            </Button>
          </div>

          {!showPreview ? (
            <>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Write your content in Markdown format..."
                rows={15}
                disabled={loading}
                className="font-mono text-sm"
              />
              <div className="mt-1 flex justify-between items-center">
                <p className="text-xs text-gray-500">
                  <span className={characterCount > maxChars * 0.9 ? 'text-orange-600 font-medium' : ''}>
                    {characterCount.toLocaleString()} / {maxChars.toLocaleString()} characters
                  </span>
                </p>
                <p className="text-xs text-gray-500">
                  Supports Markdown: **bold**, *italic*, links, images, lists, etc.
                </p>
              </div>
            </>
          ) : (
            <div className="border border-gray-300 rounded-lg p-4 min-h-[300px] bg-gray-50 prose prose-sm max-w-none overflow-auto">
              <div dangerouslySetInnerHTML={{ __html: formData.content }} />
              <p className="text-xs text-gray-500 mt-4">
                Note: This is a basic preview. Actual rendering will use proper Markdown parser.
              </p>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Markdown Quick Reference
          </h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li><code className="bg-blue-100 px-1 rounded">**bold**</code> for bold text</li>
            <li><code className="bg-blue-100 px-1 rounded">*italic*</code> for italic text</li>
            <li><code className="bg-blue-100 px-1 rounded">[link text](url)</code> for links</li>
            <li><code className="bg-blue-100 px-1 rounded">![alt text](image-url)</code> for images</li>
            <li><code className="bg-blue-100 px-1 rounded">- item</code> for bullet lists</li>
            <li><code className="bg-blue-100 px-1 rounded">## Heading</code> for headings</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
          >
            {mode === 'create' ? 'Create Section' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

