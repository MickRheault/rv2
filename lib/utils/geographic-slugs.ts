// Geographic Slug Generation Utilities
// Task 7.1.6: Create location slug generation utilities
//
// This module provides utilities for generating, parsing, and managing
// URL slugs for the geo-first URL structure

import { supabase } from '@/lib/supabase/client'

// ===============================================
// TYPES AND INTERFACES
// ===============================================

export interface SlugGenerationOptions {
  maxLength?: number
  preserveCase?: boolean
  allowNumbers?: boolean
  customSeparator?: string
  preventDuplicates?: boolean
  suffix?: string
}

export interface GeographicSlug {
  original: string
  slug: string
  isUnique: boolean
  conflicts?: string[]
}

export interface SlugValidationResult {
  isValid: boolean
  slug: string
  issues: string[]
  suggestions: string[]
}

export interface ParsedGeographicUrl {
  country?: {
    name: string
    slug: string
    code?: string
  }
  city?: {
    name: string
    slug: string
    id?: string
  }
  pageType?: 'country' | 'city' | 'motorcycle-rental' | 'motorcycle'
  shopSlug?: string
  isValid: boolean
  fullPath: string
  breadcrumbs: Array<{
    name: string
    slug: string
    url: string
    type: string
  }>
}

// ===============================================
// CORE SLUG GENERATION FUNCTIONS
// ===============================================

/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(
  text: string, 
  options: SlugGenerationOptions = {}
): string {
  const {
    maxLength = 50,
    preserveCase = false,
    allowNumbers = true,
    customSeparator = '-',
    suffix = ''
  } = options

  if (!text || typeof text !== 'string') {
    return ''
  }

  let slug = text.trim()

  // Handle case preservation
  if (!preserveCase) {
    slug = slug.toLowerCase()
  }

  // Replace spaces and special characters
  slug = slug
    .replace(/[àáâäãåā]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôöõø]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ýÿ]/g, 'y')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .replace(/[ß]/g, 'ss')
    .replace(/[æ]/g, 'ae')
    .replace(/[œ]/g, 'oe')
    .replace(/[ð]/g, 'd')
    .replace(/[þ]/g, 'th')

  // Remove or replace special characters
  if (allowNumbers) {
    slug = slug.replace(/[^a-zA-Z0-9\s-_]/g, '')
  } else {
    slug = slug.replace(/[^a-zA-Z\s-_]/g, '')
  }

  // Replace spaces and underscores with separator
  slug = slug.replace(/[\s_]+/g, customSeparator)

  // Remove multiple consecutive separators
  slug = slug.replace(new RegExp(`\\${customSeparator}+`, 'g'), customSeparator)

  // Remove leading and trailing separators
  slug = slug.replace(new RegExp(`^\\${customSeparator}+|\\${customSeparator}+$`, 'g'), '')

  // Apply length limit
  if (slug.length > maxLength) {
    // Try to cut at word boundary
    const truncated = slug.substring(0, maxLength)
    const lastSeparator = truncated.lastIndexOf(customSeparator)
    
    if (lastSeparator > maxLength * 0.7) {
      slug = truncated.substring(0, lastSeparator)
    } else {
      slug = truncated
    }
  }

  // Add suffix if provided
  if (suffix) {
    const suffixWithSeparator = `${customSeparator}${suffix}`
    if (slug.length + suffixWithSeparator.length <= maxLength) {
      slug += suffixWithSeparator
    }
  }

  return slug || 'untitled'
}

/**
 * Generate a unique slug by checking against existing slugs
 */
export async function generateUniqueSlug(
  text: string, 
  table: 'countries' | 'cities', 
  options: SlugGenerationOptions = {}
): Promise<GeographicSlug> {
  const baseSlug = generateSlug(text, { ...options, preventDuplicates: false })
  
  if (!options.preventDuplicates) {
    return {
      original: text,
      slug: baseSlug,
      isUnique: true
    }
  }

  // Check for existing slugs
  const { data: existingSlugs, error } = await supabase
    .from(table)
    .select('slug')
    .not('slug', 'is', null)

  if (error) {
    console.error('Error checking existing slugs:', error)
    return {
      original: text,
      slug: baseSlug,
      isUnique: false,
      conflicts: ['database-error']
    }
  }

  const existingSlugSet = new Set(existingSlugs?.map(item => item.slug) || [])
  
  if (!existingSlugSet.has(baseSlug)) {
    return {
      original: text,
      slug: baseSlug,
      isUnique: true
    }
  }

  // Generate variations to find unique slug
  const conflicts: string[] = [baseSlug]
  let counter = 1
  let uniqueSlug = baseSlug

  while (existingSlugSet.has(uniqueSlug) && counter <= 100) {
    uniqueSlug = `${baseSlug}-${counter}`
    if (existingSlugSet.has(uniqueSlug)) {
      conflicts.push(uniqueSlug)
    }
    counter++
  }

  return {
    original: text,
    slug: uniqueSlug,
    isUnique: !existingSlugSet.has(uniqueSlug),
    conflicts
  }
}

/**
 * Batch generate slugs for multiple items
 */
export async function batchGenerateSlugs(
  items: Array<{ name: string; id?: string }>,
  table: 'countries' | 'cities',
  options: SlugGenerationOptions = {}
): Promise<Array<GeographicSlug & { id?: string }>> {
  const results: Array<GeographicSlug & { id?: string }> = []
  
  for (const item of items) {
    const slugResult = await generateUniqueSlug(item.name, table, options)
    results.push({
      ...slugResult,
      id: item.id
    })
  }

  return results
}

// ===============================================
// SLUG VALIDATION FUNCTIONS
// ===============================================

/**
 * Validate a slug according to geographic URL requirements
 */
export function validateSlug(slug: string): SlugValidationResult {
  const issues: string[] = []
  const suggestions: string[] = []

  if (!slug) {
    issues.push('Slug cannot be empty')
    return {
      isValid: false,
      slug,
      issues,
      suggestions: ['Generate a slug from the location name']
    }
  }

  // Check length
  if (slug.length < 2) {
    issues.push('Slug must be at least 2 characters long')
    suggestions.push('Use a longer, more descriptive name')
  }

  if (slug.length > 50) {
    issues.push('Slug should not exceed 50 characters')
    suggestions.push('Use abbreviations or shorter terms')
  }

  // Check format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    issues.push('Slug can only contain lowercase letters, numbers, and hyphens')
    suggestions.push('Remove special characters and convert to lowercase')
  }

  // Check for consecutive hyphens
  if (slug.includes('--')) {
    issues.push('Slug cannot contain consecutive hyphens')
    suggestions.push('Replace multiple hyphens with single hyphens')
  }

  // Check start/end
  if (slug.startsWith('-') || slug.endsWith('-')) {
    issues.push('Slug cannot start or end with a hyphen')
    suggestions.push('Remove leading and trailing hyphens')
  }

  // Check for reserved words
  const reservedWords = [
    'admin', 'api', 'auth', 'www', 'mail', 'ftp', 'localhost',
    'search', 'browse', 'compare', 'favorites', 'help', 'about',
    'contact', 'privacy', 'terms', 'cookies', 'safety', 'careers',
    'how-it-works', 'report'
  ]

  if (reservedWords.includes(slug)) {
    issues.push(`"${slug}" is a reserved word and cannot be used`)
    suggestions.push('Add a location-specific prefix or suffix')
  }

  // SEO recommendations
  if (slug.length < 5) {
    suggestions.push('Consider using a longer slug for better SEO')
  }

  if (!slug.includes('-') && slug.length > 8) {
    suggestions.push('Consider using hyphens to separate words for better readability')
  }

  return {
    isValid: issues.length === 0,
    slug,
    issues,
    suggestions
  }
}

/**
 * Suggest alternative slugs based on validation issues
 */
export function suggestAlternativeSlug(originalText: string, currentSlug: string): string[] {
  const suggestions: string[] = []
  
  // Basic cleaned version
  const basicSlug = generateSlug(originalText)
  if (basicSlug !== currentSlug) {
    suggestions.push(basicSlug)
  }

  // Abbreviated version
  const words = originalText.split(/\s+/)
  if (words.length > 1) {
    const abbreviated = words.map(word => word.substring(0, 3)).join('-')
    const abbreviatedSlug = generateSlug(abbreviated)
    if (abbreviatedSlug !== currentSlug && !suggestions.includes(abbreviatedSlug)) {
      suggestions.push(abbreviatedSlug)
    }
  }

  // Short version (first word only)
  if (words.length > 1) {
    const shortSlug = generateSlug(words[0])
    if (shortSlug !== currentSlug && !suggestions.includes(shortSlug)) {
      suggestions.push(shortSlug)
    }
  }

  // Remove common words version
  const commonWords = ['the', 'of', 'in', 'at', 'on', 'for', 'with', 'by']
  const filteredWords = words.filter(word => 
    !commonWords.includes(word.toLowerCase()) && word.length > 2
  )
  
  if (filteredWords.length > 0 && filteredWords.length !== words.length) {
    const filteredSlug = generateSlug(filteredWords.join(' '))
    if (filteredSlug !== currentSlug && !suggestions.includes(filteredSlug)) {
      suggestions.push(filteredSlug)
    }
  }

  return suggestions.slice(0, 5) // Return max 5 suggestions
}

// ===============================================
// URL PARSING FUNCTIONS
// ===============================================

/**
 * Parse a geographic URL path into its components
 */
export async function parseGeographicUrl(urlPath: string): Promise<ParsedGeographicUrl> {
  // Clean and split the path
  const cleanPath = urlPath.replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
  const segments = cleanPath.split('/').filter(Boolean)

  const result: ParsedGeographicUrl = {
    isValid: false,
    fullPath: urlPath,
    breadcrumbs: []
  }

  if (segments.length === 0) {
    return result
  }

  try {
    // First segment should be country
    const countrySlug = segments[0]
    const { data: countryData } = await supabase
      .from('countries')
      .select('code, name, slug')
      .eq('slug', countrySlug)
      .single()

    if (!countryData) {
      return result
    }

    result.country = {
      name: countryData.name,
      slug: countryData.slug!,
      code: countryData.code
    }

    result.breadcrumbs.push({
      name: countryData.name,
      slug: countryData.slug!,
      url: `/${countryData.slug}`,
      type: 'country'
    })

    if (segments.length === 1) {
      // Country page
      result.pageType = 'country'
      result.isValid = true
      return result
    }

    // Second segment should be city
    const citySlug = segments[1]
    const { data: cityData } = await supabase
      .from('cities')
      .select(`
        id, name, slug,
        provinces!inner(
          countries!inner(code)
        )
      `)
      .eq('slug', citySlug)
      .eq('provinces.countries.code', countryData.code)
      .single()

    if (!cityData) {
      return result
    }

    result.city = {
      name: cityData.name,
      slug: cityData.slug!,
      id: cityData.id
    }

    result.breadcrumbs.push({
      name: cityData.name,
      slug: cityData.slug!,
      url: `/${countryData.slug}/${cityData.slug}`,
      type: 'city'
    })

    if (segments.length === 2) {
      // City page
      result.pageType = 'city'
      result.isValid = true
      return result
    }

    // Third segment determines page type
    const pageTypeSegment = segments[2]
    
    if (pageTypeSegment === 'motorcycle-rental') {
      result.pageType = 'motorcycle-rental'
      
      if (segments.length === 3) {
        // City motorcycle rental listing page
        result.isValid = true
        return result
      } else if (segments.length === 4) {
        // Individual shop page
        result.shopSlug = segments[3]
        result.isValid = true
        return result
      }
    } else if (pageTypeSegment === 'motorcycle') {
      result.pageType = 'motorcycle'
      
      if (segments.length === 3) {
        // City motorcycle listing page
        result.isValid = true
        return result
      }
    }

  } catch (error) {
    console.error('Error parsing geographic URL:', error)
  }

  return result
}

/**
 * Build a geographic URL from components
 */
export function buildGeographicUrl(components: {
  countrySlug: string
  citySlug?: string
  pageType?: 'motorcycle-rental' | 'motorcycle'
  shopSlug?: string
}): string {
  const { countrySlug, citySlug, pageType, shopSlug } = components
  
  let url = `/${countrySlug}`
  
  if (citySlug) {
    url += `/${citySlug}`
    
    if (pageType) {
      url += `/${pageType}`
      
      if (shopSlug && pageType === 'motorcycle-rental') {
        url += `/${shopSlug}`
      }
    }
  }
  
  return url
}

/**
 * Extract slug from full URL or path
 */
export function extractSlugFromUrl(url: string, position: 'country' | 'city' | 'shop' = 'country'): string | null {
  const cleanPath = url.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/+|\/+$/g, '')
  const segments = cleanPath.split('/').filter(Boolean)
  
  switch (position) {
    case 'country':
      return segments[0] || null
    case 'city':
      return segments[1] || null
    case 'shop':
      return segments[3] || null // Assuming /country/city/motorcycle-rental/shop structure
    default:
      return null
  }
}

// ===============================================
// SLUG MANAGEMENT FUNCTIONS
// ===============================================

/**
 * Update slugs in database for consistency
 */
export async function updateLocationSlugs(
  table: 'countries' | 'cities',
  options: SlugGenerationOptions = {}
): Promise<{
  updated: number
  errors: Array<{ id: string; error: string }>
}> {
  const results = {
    updated: 0,
    errors: [] as Array<{ id: string; error: string }>
  }

  try {
    let records: Array<{ id: string; name: string; slug: string | null }> = []
    
    if (table === 'countries') {
      const { data, error: fetchError } = await supabase
        .from('countries')
        .select('code, name, slug')
        .or('slug.is.null,slug.eq.')
      
      if (fetchError) throw fetchError
      
      records = (data || []).map(item => ({
        id: item.code,
        name: item.name,
        slug: item.slug
      }))
    } else {
      const { data, error: fetchError } = await supabase
        .from('cities')
        .select('id, name, slug')
        .or('slug.is.null,slug.eq.')
      
      if (fetchError) throw fetchError
      
      records = data || []
    }

    if (records.length === 0) {
      return results
    }

    // Generate and update slugs
    for (const record of records) {
      try {
        const slugResult = await generateUniqueSlug(record.name, table, {
          ...options,
          preventDuplicates: true
        })

        const updateQuery = table === 'countries'
          ? supabase.from('countries').update({ slug: slugResult.slug }).eq('code', record.id)
          : supabase.from('cities').update({ slug: slugResult.slug }).eq('id', record.id)

        const { error: updateError } = await updateQuery

        if (updateError) {
          results.errors.push({
            id: record.id,
            error: updateError.message
          })
        } else {
          results.updated++
        }
      } catch (error) {
        results.errors.push({
          id: record.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

  } catch (error) {
    results.errors.push({
      id: 'general',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  return results
}

/**
 * Find and resolve slug conflicts
 */
export async function resolveSlugConflicts(
  table: 'countries' | 'cities'
): Promise<{
  conflicts: Array<{
    slug: string
    records: Array<{ id: string; name: string }>
  }>
  resolved: number
  errors: string[]
}> {
  const results = {
    conflicts: [] as Array<{
      slug: string
      records: Array<{ id: string; name: string }>
    }>,
    resolved: 0,
    errors: [] as string[]
  }

  try {
    let duplicates: Array<{ id: string; name: string; slug: string }> = []
    
    if (table === 'countries') {
      const { data, error } = await supabase
        .from('countries')
        .select('code, name, slug')
        .not('slug', 'is', null)
      
      if (error) throw error
      
      duplicates = (data || []).map(item => ({
        id: item.code,
        name: item.name,
        slug: item.slug!
      }))
    } else {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, slug')
        .not('slug', 'is', null)
      
      if (error) throw error
      
      duplicates = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        slug: item.slug!
      }))
    }

    if (duplicates.length === 0) {
      return results
    }

    // Group by slug to find conflicts
    const slugGroups: Record<string, Array<{ id: string; name: string }>> = {}
    
    duplicates.forEach(record => {
      if (!slugGroups[record.slug]) {
        slugGroups[record.slug] = []
      }
      slugGroups[record.slug].push({
        id: record.id,
        name: record.name
      })
    })

    // Identify conflicts (more than one record with same slug)
    Object.entries(slugGroups).forEach(([slug, records]) => {
      if (records.length > 1) {
        results.conflicts.push({ slug, records })
      }
    })

    // Resolve conflicts by regenerating slugs for duplicates
    for (const conflict of results.conflicts) {
      // Keep the first record's slug, update others
      const recordsToUpdate = conflict.records.slice(1)
      
      for (const record of recordsToUpdate) {
        try {
          const slugResult = await generateUniqueSlug(record.name, table, {
            preventDuplicates: true
          })

          const updateQuery = table === 'countries'
            ? supabase.from('countries').update({ slug: slugResult.slug }).eq('code', record.id)
            : supabase.from('cities').update({ slug: slugResult.slug }).eq('id', record.id)

          const { error: updateError } = await updateQuery

          if (updateError) {
            results.errors.push(`Failed to update ${record.name}: ${updateError.message}`)
          } else {
            results.resolved++
          }
        } catch (error) {
          results.errors.push(`Error resolving conflict for ${record.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

  } catch (error) {
    results.errors.push(`General error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return results
}

// ===============================================
// UTILITY EXPORTS
// ===============================================

export const geographicSlugs = {
  // Core functions
  generate: generateSlug,
  generateUnique: generateUniqueSlug,
  batchGenerate: batchGenerateSlugs,
  
  // Validation
  validate: validateSlug,
  suggest: suggestAlternativeSlug,
  
  // URL handling
  parse: parseGeographicUrl,
  build: buildGeographicUrl,
  extract: extractSlugFromUrl,
  
  // Management
  update: updateLocationSlugs,
  resolveConflicts: resolveSlugConflicts
}