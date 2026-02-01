'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, Button, Alert, Spinner, Modal } from '@/components/ui'
import { ContentSection } from '@/types'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  CodeBracketIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ContentSectionEditor } from '@/components/admin/ContentSectionEditor'
import { supabase } from '@/lib/supabase/client'

function ContentManagementContent() {
  const params = useParams()
  const router = useRouter()
  const countryCode = params.countryCode as string

  const [sections, setSections] = useState<ContentSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Modal states
  const [showEditor, setShowEditor] = useState(false)
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [editingSection, setEditingSection] = useState<ContentSection | null>(null)

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingSection, setDeletingSection] = useState<ContentSection | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // JSON Editor
  const [showJsonEditor, setShowJsonEditor] = useState(false)
  const [jsonContent, setJsonContent] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [jsonSaving, setJsonSaving] = useState(false)

  // Get auth headers with proper token
  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    }
  }

  // Load sections
  const loadSections = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const headers = await getAuthHeaders()
      if (!headers.Authorization || headers.Authorization === 'Bearer undefined' || headers.Authorization === 'Bearer null') {
        setError('Not authenticated')
        return
      }

      const response = await fetch(
        `/api/admin/countries/${countryCode}/content`,
        { headers }
      )

      if (!response.ok) {
        throw new Error('Failed to load content sections')
      }

      const data = await response.json()
      setSections(data.sort((a: ContentSection, b: ContentSection) => a.order - b.order))
    } catch (err) {
      console.error('Error loading sections:', err)
      setError(err instanceof Error ? err.message : 'Failed to load sections')
    } finally {
      setLoading(false)
    }
  }, [countryCode])

  useEffect(() => {
    loadSections()
  }, [loadSections])

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [success])

  // Handle create/edit
  const handleSave = async (sectionData: Omit<ContentSection, 'id' | 'createdAt' | 'updatedAt'> | ContentSection) => {
    try {
      const headers = await getAuthHeaders()
      if (!headers.Authorization || headers.Authorization === 'Bearer undefined' || headers.Authorization === 'Bearer null') {
        throw new Error('Not authenticated')
      }

      if (editorMode === 'create') {
        // Create new section
        const response = await fetch(
          `/api/admin/countries/${countryCode}/content`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(sectionData)
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create section')
        }

        setSuccess('Section created successfully!')
      } else if (editingSection) {
        // Update existing section
        const response = await fetch(
          `/api/admin/countries/${countryCode}/content/${editingSection.id}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify(sectionData)
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to update section')
        }

        setSuccess('Section updated successfully!')
      }

      await loadSections()
      setShowEditor(false)
      setEditingSection(null)
    } catch (err) {
      throw err // Re-throw to let the editor handle the error
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!deletingSection) return

    try {
      setDeleteLoading(true)
      const headers = await getAuthHeaders()
      if (!headers.Authorization || headers.Authorization === 'Bearer undefined' || headers.Authorization === 'Bearer null') {
        throw new Error('Not authenticated')
      }

      const response = await fetch(
        `/api/admin/countries/${countryCode}/content/${deletingSection.id}`,
        {
          method: 'DELETE',
          headers
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete section')
      }

      setSuccess('Section deleted successfully!')
      await loadSections()
      setShowDeleteModal(false)
      setDeletingSection(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete section')
    } finally {
      setDeleteLoading(false)
    }
  }

  // Handle move up/down
  const handleMove = async (section: ContentSection, direction: 'up' | 'down') => {
    const currentIndex = sections.findIndex(s => s.id === section.id)
    if (currentIndex === -1) return
    if (direction === 'up' && currentIndex === 0) return
    if (direction === 'down' && currentIndex === sections.length - 1) return

    const newSections = [...sections]
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

      // Swap elements
      ;[newSections[currentIndex], newSections[targetIndex]] = [newSections[targetIndex], newSections[currentIndex]]

    // Update order values
    const reorderedIds = newSections.map(s => s.id)

    try {
      const headers = await getAuthHeaders()
      if (!headers.Authorization || headers.Authorization === 'Bearer undefined' || headers.Authorization === 'Bearer null') {
        throw new Error('Not authenticated')
      }

      const response = await fetch(
        `/api/admin/countries/${countryCode}/content/reorder`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ sectionIds: reorderedIds })
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to reorder sections')
      }

      await loadSections()
      setSuccess(`Section moved ${direction}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder sections')
    }
  }

  // Open create modal
  const openCreateModal = () => {
    setEditorMode('create')
    setEditingSection(null)
    setShowEditor(true)
  }

  // Open edit modal
  const openEditModal = (section: ContentSection) => {
    setEditorMode('edit')
    setEditingSection(section)
    setShowEditor(true)
  }

  // Open delete modal
  const openDeleteModal = (section: ContentSection) => {
    setDeletingSection(section)
    setShowDeleteModal(true)
  }

  // Open JSON editor
  const openJsonEditor = () => {
    // Format current sections as pretty JSON
    const formatted = JSON.stringify(sections, null, 2)
    setJsonContent(formatted)
    setJsonError(null)
    setShowJsonEditor(true)
  }

  // Validate and save JSON
  const handleJsonSave = async () => {
    try {
      setJsonSaving(true)
      setJsonError(null)

      // Parse JSON
      let parsed: any
      try {
        parsed = JSON.parse(jsonContent)
      } catch (e) {
        throw new Error('Invalid JSON syntax. Please check your formatting.')
      }

      // Validate it's an array
      if (!Array.isArray(parsed)) {
        throw new Error('JSON must be an array of content sections')
      }

      // Validate each section
      for (let i = 0; i < parsed.length; i++) {
        const section = parsed[i]

        if (!section.id || typeof section.id !== 'string') {
          throw new Error(`Section ${i + 1}: Missing or invalid 'id' field`)
        }
        if (!section.title || typeof section.title !== 'string') {
          throw new Error(`Section ${i + 1}: Missing or invalid 'title' field`)
        }
        if (!section.content || typeof section.content !== 'string') {
          throw new Error(`Section ${i + 1}: Missing or invalid 'content' field`)
        }
        if (typeof section.order !== 'number' || section.order < 0 || !Number.isInteger(section.order)) {
          throw new Error(`Section ${i + 1}: 'order' must be a positive integer`)
        }
        if (!section.createdAt || typeof section.createdAt !== 'string') {
          throw new Error(`Section ${i + 1}: Missing or invalid 'createdAt' field`)
        }
        if (!section.updatedAt || typeof section.updatedAt !== 'string') {
          throw new Error(`Section ${i + 1}: Missing or invalid 'updatedAt' field`)
        }

        // Validate field lengths
        if (section.title.length > 200) {
          throw new Error(`Section ${i + 1}: Title cannot exceed 200 characters`)
        }
        if (section.content.length > 100000) {
          throw new Error(`Section ${i + 1}: Content cannot exceed 100,000 characters`)
        }
      }

      // Save directly to database using Supabase client
      const { error: updateError } = await (supabase.from('countries') as any)
        .update({ content_sections: parsed.length > 0 ? parsed : null } as any)
        .eq('code', countryCode)

      if (updateError) {
        throw new Error('Failed to save content sections')
      }

      setSuccess('Content sections updated successfully from JSON!')
      setShowJsonEditor(false)
      await loadSections()
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Failed to save JSON')
    } finally {
      setJsonSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Content Sections - {countryCode.toUpperCase()}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage informational content sections for this country page
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={openJsonEditor} variant="secondary">
            <CodeBracketIcon className="h-5 w-5 mr-2" />
            Edit JSON
          </Button>
          <Button onClick={openCreateModal}>
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Section
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && <Alert variant="error" description={error} dismissible onDismiss={() => setError(null)} />}
      {success && <Alert variant="success" description={success} dismissible onDismiss={() => setSuccess(null)} />}

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Spinner size="lg" />
        </div>
      ) : sections.length === 0 ? (
        /* Empty State */
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No content sections yet</p>
            <Button onClick={openCreateModal}>
              <PlusIcon className="h-5 w-5 mr-2" />
              Create First Section
            </Button>
          </div>
        </Card>
      ) : (
        /* Sections List */
        <div className="space-y-4">
          {sections.map((section, index) => (
            <Card key={section.id}>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                        {section.order}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {section.title}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {section.content.substring(0, 150)}
                      {section.content.length > 150 ? '...' : ''}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <span>{section.content.length.toLocaleString()} characters</span>
                      <span>•</span>
                      <span>Updated {new Date(section.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    {/* Move Up */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMove(section, 'up')}
                      disabled={index === 0}
                      title="Move up"
                    >
                      <ArrowUpIcon className="h-4 w-4" />
                    </Button>

                    {/* Move Down */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMove(section, 'down')}
                      disabled={index === sections.length - 1}
                      title="Move down"
                    >
                      <ArrowDownIcon className="h-4 w-4" />
                    </Button>

                    {/* Edit */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(section)}
                      title="Edit"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteModal(section)}
                      title="Delete"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      <ContentSectionEditor
        isOpen={showEditor}
        onClose={() => {
          setShowEditor(false)
          setEditingSection(null)
        }}
        onSave={handleSave}
        section={editingSection}
        mode={editorMode}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setDeletingSection(null)
        }}
        title="Delete Content Section"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete &ldquo;<strong>{deletingSection?.title}</strong>&rdquo;?
          </p>
          <p className="text-sm text-gray-600">
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false)
                setDeletingSection(null)
              }}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleteLoading}
            >
              Delete Section
            </Button>
          </div>
        </div>
      </Modal>

      {/* JSON Editor Modal */}
      <Modal
        isOpen={showJsonEditor}
        onClose={() => {
          setShowJsonEditor(false)
          setJsonError(null)
        }}
        title="Edit Content Sections (JSON)"
        size="xl"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Instructions:</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Edit the JSON array of content sections below</li>
              <li>Each section must have: id, title, content, order, createdAt, updatedAt</li>
              <li>You can add, remove, or modify sections</li>
              <li>Use empty array [] to remove all sections</li>
              <li>Changes will replace all existing sections</li>
            </ul>
          </div>

          {jsonError && (
            <Alert variant="error" description={jsonError} />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              JSON Content
            </label>
            <textarea
              value={jsonContent}
              onChange={(e) => setJsonContent(e.target.value)}
              className="w-full h-96 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder='[{"id": "...", "title": "...", "content": "...", "order": 1, ...}]'
              spellCheck={false}
            />
            <p className="text-xs text-gray-500 mt-1">
              {jsonContent.length.toLocaleString()} characters
            </p>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                // Format/prettify JSON
                try {
                  const parsed = JSON.parse(jsonContent)
                  setJsonContent(JSON.stringify(parsed, null, 2))
                  setJsonError(null)
                } catch (e) {
                  setJsonError('Invalid JSON - cannot format')
                }
              }}
            >
              Format JSON
            </Button>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowJsonEditor(false)
                  setJsonError(null)
                }}
                disabled={jsonSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleJsonSave}
                loading={jsonSaving}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function ContentManagementPage() {
  return (

    <ContentManagementContent />

  )
}

