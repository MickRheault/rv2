import { supabase } from '@/lib/supabase/client'
import { ContentSection } from '@/types'

// Validation helpers
export const validateContentSection = (section: Partial<ContentSection>): string[] => {
  const errors: string[] = []

  // Title validation
  if (!section.title || section.title.trim().length === 0) {
    errors.push('Title is required')
  } else if (section.title.length > 200) {
    errors.push('Title cannot exceed 200 characters')
  }

  // Content validation
  if (!section.content || section.content.trim().length === 0) {
    errors.push('Content is required')
  } else if (section.content.length > 100000) {
    errors.push('Content cannot exceed 100,000 characters')
  }

  // Order validation
  if (section.order !== undefined && (section.order < 0 || !Number.isInteger(section.order))) {
    errors.push('Order must be a positive integer')
  }

  return errors
}

export const countryContentService = {
  // Get all content sections for a country
  async getContentSections(countryCode: string): Promise<ContentSection[]> {
    const { data, error } = await supabase
      .from('countries')
      .select('content_sections')
      .eq('code', countryCode)
      .single()

    if (error) {
      console.error('Error fetching content sections:', error)
      throw error
    }

    // Return empty array if no sections or null
    if (!data?.content_sections) {
      return []
    }

    return data.content_sections as unknown as ContentSection[]
  },

  // Add a new content section
  async addContentSection(
    countryCode: string,
    section: Omit<ContentSection, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ContentSection> {
    // Validate section
    const errors = validateContentSection(section)
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`)
    }

    // Get existing sections
    const existingSections = await this.getContentSections(countryCode)

    // Create new section with generated fields
    const newSection: ContentSection = {
      id: crypto.randomUUID(),
      ...section,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Append to existing sections
    const updatedSections = [...existingSections, newSection]

    // Update database
    const { error } = await supabase
      .from('countries')
      .update({ content_sections: updatedSections as unknown as any })
      .eq('code', countryCode)

    if (error) {
      console.error('Error adding content section:', error)
      throw error
    }

    return newSection
  },

  // Update a specific content section
  async updateContentSection(
    countryCode: string,
    sectionId: string,
    updates: Partial<Omit<ContentSection, 'id' | 'createdAt'>>
  ): Promise<ContentSection> {
    // Validate updates
    const errors = validateContentSection(updates)
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`)
    }

    // Get existing sections
    const existingSections = await this.getContentSections(countryCode)

    // Find the section to update
    const sectionIndex = existingSections.findIndex(s => s.id === sectionId)
    if (sectionIndex === -1) {
      throw new Error(`Section with id ${sectionId} not found`)
    }

    // Update the section
    const updatedSection: ContentSection = {
      ...existingSections[sectionIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    // Replace in array
    const updatedSections = [...existingSections]
    updatedSections[sectionIndex] = updatedSection

    // Update database
    const { error } = await supabase
      .from('countries')
      .update({ content_sections: updatedSections as unknown as any })
      .eq('code', countryCode)

    if (error) {
      console.error('Error updating content section:', error)
      throw error
    }

    return updatedSection
  },

  // Delete a content section
  async deleteContentSection(countryCode: string, sectionId: string): Promise<void> {
    // Get existing sections
    const existingSections = await this.getContentSections(countryCode)

    // Filter out the section to delete
    const updatedSections = existingSections.filter(s => s.id !== sectionId)

    // Check if section was found
    if (updatedSections.length === existingSections.length) {
      throw new Error(`Section with id ${sectionId} not found`)
    }

    // Update database
    const { error } = await supabase
      .from('countries')
      .update({ content_sections: (updatedSections.length > 0 ? updatedSections : null) as unknown as any })
      .eq('code', countryCode)

    if (error) {
      console.error('Error deleting content section:', error)
      throw error
    }
  },

  // Reorder sections based on provided section IDs array
  async reorderSections(countryCode: string, sectionIds: string[]): Promise<ContentSection[]> {
    // Get existing sections
    const existingSections = await this.getContentSections(countryCode)

    // Create a map for quick lookup
    const sectionMap = new Map(existingSections.map(s => [s.id, s]))

    // Reorder sections based on sectionIds array
    const reorderedSections: ContentSection[] = []
    sectionIds.forEach((id, index) => {
      const section = sectionMap.get(id)
      if (section) {
        reorderedSections.push({
          ...section,
          order: index + 1,
          updatedAt: new Date().toISOString(),
        })
      }
    })

    // Add any sections not in the sectionIds array at the end
    existingSections.forEach(section => {
      if (!sectionIds.includes(section.id)) {
        reorderedSections.push({
          ...section,
          order: reorderedSections.length + 1,
          updatedAt: new Date().toISOString(),
        })
      }
    })

    // Update database
    const { error } = await supabase
      .from('countries')
      .update({ content_sections: reorderedSections as unknown as any })
      .eq('code', countryCode)

    if (error) {
      console.error('Error reordering content sections:', error)
      throw error
    }

    return reorderedSections
  },
}

export default countryContentService

