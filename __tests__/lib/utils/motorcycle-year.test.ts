import {
  formatMotorcycleYear,
  normalizeMotorcycleYearRange,
  isValidMotorcycleYearRange,
} from '@/lib/utils';

describe('Model Year Range Formatting & Normalization (#137)', () => {
  describe('formatMotorcycleYear', () => {
    it('formats a single year number or string', () => {
      expect(formatMotorcycleYear(2023)).toBe('2023');
      expect(formatMotorcycleYear('2023')).toBe('2023');
      expect(formatMotorcycleYear(2023, null)).toBe('2023');
    });

    it('formats a bounded year range when yearTo > year', () => {
      expect(formatMotorcycleYear(2015, 2020)).toBe('2015-2020');
      expect(formatMotorcycleYear('2015', '2020')).toBe('2015-2020');
    });

    it('collapses equal start and end years to a single year', () => {
      expect(formatMotorcycleYear(2020, 2020)).toBe('2020');
    });

    it('normalizes an already-formatted range string passed as year', () => {
      expect(formatMotorcycleYear('2015-2020')).toBe('2015-2020');
      expect(formatMotorcycleYear('2015–2020')).toBe('2015-2020');
      expect(formatMotorcycleYear('2020-2020')).toBe('2020');
    });

    it('returns null when year is null, undefined, empty, or invalid', () => {
      expect(formatMotorcycleYear(null, null)).toBeNull();
      expect(formatMotorcycleYear(undefined, undefined)).toBeNull();
      expect(formatMotorcycleYear('', null)).toBeNull();
      expect(formatMotorcycleYear(null, 2020)).toBeNull();
    });
  });

  describe('normalizeMotorcycleYearRange', () => {
    it('normalizes primitive single years and range strings', () => {
      expect(normalizeMotorcycleYearRange(2023)).toEqual({ year: 2023, year_to: null });
      expect(normalizeMotorcycleYearRange('2023')).toEqual({ year: 2023, year_to: null });
      expect(normalizeMotorcycleYearRange('2015-2020')).toEqual({ year: 2015, year_to: 2020 });
      expect(normalizeMotorcycleYearRange('2015–2020')).toEqual({ year: 2015, year_to: 2020 });
      expect(normalizeMotorcycleYearRange('2015 - 2020')).toEqual({ year: 2015, year_to: 2020 });
      expect(normalizeMotorcycleYearRange('2020-2020')).toEqual({ year: 2020, year_to: null });
      expect(normalizeMotorcycleYearRange(null)).toEqual({ year: null, year_to: null });
      expect(normalizeMotorcycleYearRange('')).toEqual({ year: null, year_to: null });
    });

    it('normalizes objects with explicit year/year_to and camelCase/snake_case aliases', () => {
      expect(normalizeMotorcycleYearRange({ year: 2015, year_to: 2020 })).toEqual({
        year: 2015,
        year_to: 2020,
      });
      expect(normalizeMotorcycleYearRange({ yearFrom: 2015, yearTo: 2020 })).toEqual({
        year: 2015,
        year_to: 2020,
      });
      expect(normalizeMotorcycleYearRange({ year_from: '2016', year_to: '2019' })).toEqual({
        year: 2016,
        year_to: 2019,
      });
      expect(normalizeMotorcycleYearRange({ modelYear: '2015-2020' })).toEqual({
        year: 2015,
        year_to: 2020,
      });
      expect(normalizeMotorcycleYearRange({ model_year: 2022, year_to: 2022 })).toEqual({
        year: 2022,
        year_to: null,
      });
    });

    it('nulls out year_to when year_to < year or when year is null', () => {
      expect(normalizeMotorcycleYearRange('2020-2015')).toEqual({ year: null, year_to: null });
      expect(normalizeMotorcycleYearRange({ year: 2020, year_to: 2015 })).toEqual({
        year: 2020,
        year_to: null,
      });
      expect(normalizeMotorcycleYearRange({ year: null, year_to: 2020 })).toEqual({
        year: null,
        year_to: null,
      });
    });
  });

  describe('isValidMotorcycleYearRange', () => {
    it('validates legal single years, ranges, and null bounds and rejects inverted or orphan yearTo', () => {
      expect(isValidMotorcycleYearRange(null, null)).toBe(true);
      expect(isValidMotorcycleYearRange(2023, null)).toBe(true);
      expect(isValidMotorcycleYearRange(2020, 2020)).toBe(true);
      expect(isValidMotorcycleYearRange(2015, 2020)).toBe(true);
      expect(isValidMotorcycleYearRange(2020, 2015)).toBe(false);
      expect(isValidMotorcycleYearRange(null, 2020)).toBe(false);
      expect(isValidMotorcycleYearRange(undefined, 2020)).toBe(false);
    });
  });

  describe('Database migration & service projection', () => {
    it('defines 20261015230000_add_motorcycle_year_to.sql with year_to column, check constraint, and updated get_entities_by_freshness RPC', () => {
      const fs = require('fs');
      const path = require('path');
      const migrationPath = path.join(
        process.cwd(),
        'supabase/migrations/20261015230000_add_motorcycle_year_to.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS year_to integer/i);
      expect(sql).toMatch(/motorcycle_rentals_year_range_check/i);
      expect(sql).toMatch(/CHECK\s*\(\s*year_to IS NULL OR\s*\(\s*year IS NOT NULL AND year_to > year\s*\)\s*\)/i);
      expect(sql).toContain("CONCAT(b.name, ' ', mr.model, ' (', mr.year, '-', mr.year_to, ')')");
      expect(sql).toContain("CONCAT(b.name, ' ', mr.model, ' (', mr.year, ')')");
      expect(sql).toContain("CONCAT(b.name, ' ', mr.model)");
    });
  });
});
