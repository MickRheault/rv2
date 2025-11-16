# Decimal Days Migration Guide

## Overview
This migration enables support for hourly and half-day motorcycle rentals by converting `min_days` and `max_days` columns from integers to decimal values (NUMERIC with 4 decimal places).

## Migration File
`20250916000000_rental_rate_tiers_decimal_days.sql`

## What Changed
- `rental_rate_tiers.min_days`: INTEGER → NUMERIC(10, 4)
- `rental_rate_tiers.max_days`: INTEGER → NUMERIC(10, 4)

## Why This Is Safe ✅
1. **No Data Loss**: All existing integer values (1, 2, 3, etc.) are valid decimal values
2. **Automatic Conversion**: PostgreSQL automatically converts integers to numeric during the ALTER
3. **Backward Compatible**: Existing queries continue to work without modification
4. **Type System**: TypeScript already uses `number` type which supports both integers and decimals

## How to Apply the Migration

### Option 1: Using Supabase CLI (Recommended)
```bash
# Make sure you're in the project directory
cd /Users/mick/workspace/personal/rv2

# Apply the migration to your local database
supabase db reset

# Or push just this migration
supabase db push
```

### Option 2: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to "SQL Editor"
3. Copy and paste the contents of `20250916000000_rental_rate_tiers_decimal_days.sql`
4. Click "Run"

### Option 3: Using psql
```bash
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/20250916000000_rental_rate_tiers_decimal_days.sql
```

## Usage Examples

After applying the migration, you can now use decimal values for rental periods:

### Example Data
```json
{
  "rental_rates": [
    {
      "rate_text": "Hourly rate",
      "min_days": 0.042,
      "max_days": 0.042,
      "rate_per_day": 5,
      "currency": "USD"
    },
    {
      "rate_text": "Half day (4 hours)",
      "min_days": 0.167,
      "max_days": 0.167,
      "rate_per_day": 15,
      "currency": "USD"
    },
    {
      "rate_text": "Half day (12 hours)",
      "min_days": 0.5,
      "max_days": 0.5,
      "rate_per_day": 25,
      "currency": "USD"
    },
    {
      "rate_text": "Full day",
      "min_days": 1,
      "max_days": 1,
      "rate_per_day": 40,
      "currency": "USD"
    },
    {
      "rate_text": "Weekly rate",
      "min_days": 7,
      "max_days": null,
      "rate_per_day": 30,
      "currency": "USD"
    }
  ]
}
```

### Common Decimal Values
| Duration | Decimal Value | Calculation |
|----------|---------------|-------------|
| 1 hour | 0.0417 | 1/24 |
| 2 hours | 0.0833 | 2/24 |
| 3 hours | 0.125 | 3/24 |
| 4 hours | 0.1667 | 4/24 |
| 6 hours | 0.25 | 6/24 |
| 8 hours | 0.3333 | 8/24 |
| 12 hours (half day) | 0.5 | 12/24 |
| 1 day | 1.0 | 24/24 |

## Verification

After applying the migration, verify it worked:

```sql
-- Check the column types
SELECT 
  column_name, 
  data_type, 
  numeric_precision, 
  numeric_scale
FROM information_schema.columns 
WHERE table_name = 'rental_rate_tiers' 
  AND column_name IN ('min_days', 'max_days');

-- Expected output:
-- column_name | data_type | numeric_precision | numeric_scale
-- min_days    | numeric   | 10                | 4
-- max_days    | numeric   | 10                | 4
```

## Rollback (if needed)

If you need to rollback this migration:

```sql
-- WARNING: This will truncate decimal values to integers!
-- Only rollback if you haven't added any decimal data yet

ALTER TABLE rental_rate_tiers 
  ALTER COLUMN min_days TYPE INTEGER USING min_days::INTEGER;

ALTER TABLE rental_rate_tiers 
  ALTER COLUMN max_days TYPE INTEGER USING max_days::INTEGER;
```

## Notes
- The migration uses `NUMERIC(10, 4)` which allows up to 4 decimal places
- This is sufficient for hourly precision (1/24 = 0.0417)
- Maximum value supported: 999,999.9999 days (plenty for any rental period)
- The TypeScript types already support this change (using `number` type)

