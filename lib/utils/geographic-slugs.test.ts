// Geographic Slug Utilities Tests
// Task 7.1.6: Unit tests for geographic slug utilities

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import {
  generateSlug,
  validateSlug,
  suggestAlternativeSlug,
  buildGeographicUrl,
  extractSlugFromUrl,
  geographicSlugs
} from './geographic-slugs'

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        not: jest.fn(() => ({
          single: jest.fn(),
          eq: jest.fn(() => ({
            single: jest.fn()
          }))
        })),
        eq: jest.fn(() => ({
          single: jest.fn()
        })),
        or: jest.fn()
      })),
      update: jest.fn(() => ({
        eq: jest.fn()
      }))
    }))
  }
}))

describe('Geographic Slug Utilities', () => {
  
  describe('generateSlug', () => {
    it('should generate basic slug from text', () => {
      expect(generateSlug('New York')).toBe('new-york')
      expect(generateSlug('Los Angeles')).toBe('los-angeles')
      expect(generateSlug('São Paulo')).toBe('sao-paulo')
    })

    it('should handle special characters', () => {
      expect(generateSlug('München')).toBe('munchen')
      expect(generateSlug('Zürich')).toBe('zurich')
      expect(generateSlug('Montréal')).toBe('montreal')
      expect(generateSlug('København')).toBe('kobenhavn')
    })

    it('should handle multiple spaces and special characters', () => {
      expect(generateSlug('  New   York  City  ')).toBe('new-york-city')
      expect(generateSlug('San Francisco, CA')).toBe('san-francisco-ca')
      expect(generateSlug('Washington D.C.')).toBe('washington-dc')
    })

    it('should respect maxLength option', () => {
      const longText = 'This is a very long city name that should be truncated'
      expect(generateSlug(longText, { maxLength: 20 })).toHaveLength(20)
      expect(generateSlug(longText, { maxLength: 10 })).toHaveLength(10)
    })

    it('should handle preserveCase option', () => {
      expect(generateSlug('New York', { preserveCase: true })).toBe('New-York')
      expect(generateSlug('LOS ANGELES', { preserveCase: true })).toBe('LOS-ANGELES')
    })

    it('should handle custom separator', () => {
      expect(generateSlug('New York', { customSeparator: '_' })).toBe('new_york')
      expect(generateSlug('Los Angeles', { customSeparator: '.' })).toBe('los.angeles')
    })

    it('should handle allowNumbers option', () => {
      expect(generateSlug('Route 66', { allowNumbers: true })).toBe('route-66')
      expect(generateSlug('Route 66', { allowNumbers: false })).toBe('route')
    })

    it('should add suffix when provided', () => {
      expect(generateSlug('Paris', { suffix: 'fr' })).toBe('paris-fr')
      expect(generateSlug('Paris', { suffix: 'texas' })).toBe('paris-texas')
    })

    it('should handle empty or invalid input', () => {
      expect(generateSlug('')).toBe('untitled')
      expect(generateSlug('   ')).toBe('untitled')
      expect(generateSlug('!!!')).toBe('untitled')
    })

    it('should handle edge cases', () => {
      expect(generateSlug('a')).toBe('a')
      expect(generateSlug('123')).toBe('123')
      expect(generateSlug('---')).toBe('untitled')
      expect(generateSlug('a-b-c')).toBe('a-b-c')
    })
  })

  describe('validateSlug', () => {
    it('should validate correct slugs', () => {
      const result = validateSlug('new-york')
      expect(result.isValid).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should detect empty slugs', () => {
      const result = validateSlug('')
      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('Slug cannot be empty')
    })

    it('should detect short slugs', () => {
      const result = validateSlug('a')
      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('Slug must be at least 2 characters long')
    })

    it('should detect long slugs', () => {
      const longSlug = 'a'.repeat(51)
      const result = validateSlug(longSlug)
      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('Slug should not exceed 50 characters')
    })

    it('should detect invalid characters', () => {
      const result = validateSlug('new york')
      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('Slug can only contain lowercase letters, numbers, and hyphens')
      
      const result2 = validateSlug('NEW-YORK')
      expect(result2.isValid).toBe(false)
      expect(result2.issues).toContain('Slug can only contain lowercase letters, numbers, and hyphens')
    })

    it('should detect consecutive hyphens', () => {
      const result = validateSlug('new--york')
      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('Slug cannot contain consecutive hyphens')
    })

    it('should detect leading/trailing hyphens', () => {
      const result1 = validateSlug('-new-york')
      expect(result1.isValid).toBe(false)
      expect(result1.issues).toContain('Slug cannot start or end with a hyphen')
      
      const result2 = validateSlug('new-york-')
      expect(result2.isValid).toBe(false)
      expect(result2.issues).toContain('Slug cannot start or end with a hyphen')
    })

    it('should detect reserved words', () => {
      const result = validateSlug('admin')
      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('"admin" is a reserved word and cannot be used')
      
      const result2 = validateSlug('search')
      expect(result2.isValid).toBe(false)
      expect(result2.issues).toContain('"search" is a reserved word and cannot be used')
    })

    it('should provide suggestions', () => {
      const result = validateSlug('ab')
      expect(result.suggestions).toContain('Consider using a longer slug for better SEO')
      
      const result2 = validateSlug('verylongslugwithoutdashes')
      expect(result2.suggestions).toContain('Consider using hyphens to separate words for better readability')
    })
  })

  describe('suggestAlternativeSlug', () => {
    it('should suggest basic alternatives', () => {
      const suggestions = suggestAlternativeSlug('New York City', 'nyc')
      expect(suggestions).toContain('new-york-city')
    })

    it('should suggest abbreviated alternatives', () => {
      const suggestions = suggestAlternativeSlug('New York City', 'new-york-city')
      expect(suggestions).toContain('new-yor-cit')
    })

    it('should suggest short alternatives', () => {
      const suggestions = suggestAlternativeSlug('New York City', 'new-york-city')
      expect(suggestions).toContain('new')
    })

    it('should filter common words', () => {
      const suggestions = suggestAlternativeSlug('City of New York', 'city-of-new-york')
      expect(suggestions).toContain('new-york')
    })

    it('should limit suggestions to 5', () => {
      const suggestions = suggestAlternativeSlug('Very Long City Name With Many Words', 'current-slug')
      expect(suggestions.length).toBeLessThanOrEqual(5)
    })
  })

  describe('buildGeographicUrl', () => {
    it('should build country URL', () => {
      const url = buildGeographicUrl({ countrySlug: 'usa' })
      expect(url).toBe('/usa')
    })

    it('should build city URL', () => {
      const url = buildGeographicUrl({ 
        countrySlug: 'usa', 
        citySlug: 'new-york' 
      })
      expect(url).toBe('/usa/new-york')
    })

    it('should build motorcycle rental URL', () => {
      const url = buildGeographicUrl({ 
        countrySlug: 'usa', 
        citySlug: 'new-york',
        pageType: 'motorcycle-rental'
      })
      expect(url).toBe('/usa/new-york/motorcycle-rental')
    })

    it('should build shop URL', () => {
      const url = buildGeographicUrl({ 
        countrySlug: 'usa', 
        citySlug: 'new-york',
        pageType: 'motorcycle-rental',
        shopSlug: 'harley-davidson-nyc'
      })
      expect(url).toBe('/usa/new-york/motorcycle-rental/harley-davidson-nyc')
    })

    it('should build motorcycle listing URL', () => {
      const url = buildGeographicUrl({ 
        countrySlug: 'usa', 
        citySlug: 'new-york',
        pageType: 'motorcycle'
      })
      expect(url).toBe('/usa/new-york/motorcycle')
    })
  })

  describe('extractSlugFromUrl', () => {
    it('should extract country slug', () => {
      expect(extractSlugFromUrl('/usa/new-york', 'country')).toBe('usa')
      expect(extractSlugFromUrl('https://example.com/usa/new-york', 'country')).toBe('usa')
    })

    it('should extract city slug', () => {
      expect(extractSlugFromUrl('/usa/new-york', 'city')).toBe('new-york')
      expect(extractSlugFromUrl('/usa/new-york/motorcycle-rental', 'city')).toBe('new-york')
    })

    it('should extract shop slug', () => {
      expect(extractSlugFromUrl('/usa/new-york/motorcycle-rental/harley-nyc', 'shop')).toBe('harley-nyc')
    })

    it('should handle missing segments', () => {
      expect(extractSlugFromUrl('/usa', 'city')).toBeNull()
      expect(extractSlugFromUrl('/usa/new-york', 'shop')).toBeNull()
    })

    it('should handle malformed URLs', () => {
      expect(extractSlugFromUrl('', 'country')).toBeNull()
      expect(extractSlugFromUrl('///', 'country')).toBeNull()
    })
  })

  describe('geographicSlugs utility object', () => {
    it('should export all expected functions', () => {
      expect(typeof geographicSlugs.generate).toBe('function')
      expect(typeof geographicSlugs.generateUnique).toBe('function')
      expect(typeof geographicSlugs.batchGenerate).toBe('function')
      expect(typeof geographicSlugs.validate).toBe('function')
      expect(typeof geographicSlugs.suggest).toBe('function')
      expect(typeof geographicSlugs.parse).toBe('function')
      expect(typeof geographicSlugs.build).toBe('function')
      expect(typeof geographicSlugs.extract).toBe('function')
      expect(typeof geographicSlugs.update).toBe('function')
      expect(typeof geographicSlugs.resolveConflicts).toBe('function')
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle null and undefined inputs', () => {
      expect(generateSlug(null as any)).toBe('untitled')
      expect(generateSlug(undefined as any)).toBe('untitled')
    })

    it('should handle non-string inputs', () => {
      expect(generateSlug(123 as any)).toBe('untitled')
      expect(generateSlug({} as any)).toBe('untitled')
      expect(generateSlug([] as any)).toBe('untitled')
    })

    it('should handle extreme length limits', () => {
      expect(generateSlug('test', { maxLength: 0 })).toBe('untitled')
      expect(generateSlug('test', { maxLength: 1 })).toBe('t')
      expect(generateSlug('test', { maxLength: 1000 })).toBe('test')
    })

    it('should handle special unicode characters', () => {
      expect(generateSlug('🏍️ Motorcycle')).toBe('motorcycle')
      expect(generateSlug('Café Racer')).toBe('cafe-racer')
      expect(generateSlug('Москва')).toBe('untitled') // Cyrillic not handled
    })
  })

  describe('Performance considerations', () => {
    it('should handle long strings efficiently', () => {
      const longString = 'a'.repeat(10000)
      const start = Date.now()
      const result = generateSlug(longString, { maxLength: 50 })
      const end = Date.now()
      
      expect(result.length).toBeLessThanOrEqual(50)
      expect(end - start).toBeLessThan(100) // Should complete in under 100ms
    })

    it('should handle many consecutive operations', () => {
      const start = Date.now()
      
      for (let i = 0; i < 1000; i++) {
        generateSlug(`Test City ${i}`)
      }
      
      const end = Date.now()
      expect(end - start).toBeLessThan(1000) // Should complete in under 1 second
    })
  })
})