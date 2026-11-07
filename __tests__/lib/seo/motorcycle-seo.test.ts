import { generateMotorcycleSEO } from '@/lib/seo/config';
import {
  generateMotorcycleSchema,
  generateVehicleSchema,
  generateEnhancedMotorcycleSchema,
  generateShopMotorcycleSchemas,
} from '@/lib/seo/structured-data';

describe('Motorcycle SEO & JSON-LD Model Year Range (#137)', () => {
  it('formats Model Year Range in generateMotorcycleSEO title and description', () => {
    const seo = generateMotorcycleSEO({
      id: 'bike-1',
      brand: 'Honda',
      model: 'CB500X',
      year: 2015,
      year_to: 2020,
      location: 'Chiang Mai',
      pricePerDay: 25,
      currency: '$',
    });

    expect(seo.title).toBe('2015-2020 Honda CB500X Rental in Chiang Mai - Book Now');
    expect(seo.description).toContain('Rent a 2015-2020 Honda CB500X in Chiang Mai');
  });

  it('formats Model Year Range in generateMotorcycleSchema name and Year additionalProperty', () => {
    const schema = generateMotorcycleSchema({
      id: 'bike-1',
      brand: 'Honda',
      model: 'CB500X',
      year: 2015,
      year_to: 2020,
      engineSize: 471,
    });

    expect(schema.name).toBe('2015-2020 Honda CB500X');
    expect(schema.additionalProperty).toEqual(
      expect.arrayContaining([
        {
          '@type': 'PropertyValue',
          name: 'Year',
          value: '2015-2020',
        },
      ])
    );
  });

  it('formats Model Year Range in generateVehicleSchema and generateEnhancedMotorcycleSchema name and vehicleModelDate', () => {
    const vehicle = generateVehicleSchema({
      id: 'bike-1',
      brand: 'Honda',
      model: 'CB500X',
      year: 2015,
      year_to: 2020,
    });

    expect(vehicle.name).toBe('2015-2020 Honda CB500X');
    expect(vehicle.vehicleModelDate).toBe('2015-2020');

    const enhanced = generateEnhancedMotorcycleSchema({
      id: 'bike-1',
      brand: 'Honda',
      model: 'CB500X',
      year: 2015,
      year_to: 2020,
      rentalRates: [{ minDays: 1, ratePerDay: 25, currency: 'USD' }],
    });

    expect(enhanced.name).toBe('2015-2020 Honda CB500X');
    expect(enhanced.vehicleModelDate).toBe('2015-2020');
    expect((enhanced as any).offers?.name).toBe('2015-2020 Honda CB500X Rental');
  });

  it('emits accurate Schema.org UnitPriceSpecification units and meta descriptions for flexible non-daily offers (#210)', () => {
    const exactSeo = generateMotorcycleSEO({
      id: 'bike-2',
      brand: 'Honda',
      model: 'Forza 350',
      year: 2024,
      location: 'Bangkok',
      headlineOffer: {
        amount: 6000,
        currency: 'THB',
        billingBasis: 'per_calendar_month',
        durationUnit: 'calendar_month',
        minDuration: 1,
        maxDuration: null,
        isFrom: false,
      },
    });
    expect(exactSeo.description).toContain('at THB 6,000 per calendar month');
    expect(exactSeo.description).not.toContain('from THB 6,000');
    expect(exactSeo.description).not.toContain('/day');

    const fromSeo = generateMotorcycleSEO({
      id: 'bike-2',
      brand: 'Honda',
      model: 'Forza 350',
      year: 2024,
      location: 'Bangkok',
      headlineOffer: {
        amount: 6000,
        currency: 'THB',
        billingBasis: 'per_calendar_month',
        durationUnit: 'calendar_month',
        minDuration: 1,
        maxDuration: null,
        isFrom: true,
      },
    });
    expect(fromSeo.description).toContain('from THB 6,000 per calendar month');

    const enhanced = generateEnhancedMotorcycleSchema({
      id: 'bike-2',
      brand: 'Honda',
      model: 'Forza 350',
      year: 2024,
      rentalOffers: [
        {
          offerType: 'hourly',
          amount: 100,
          currency: 'THB',
          billingBasis: 'per_hour',
          durationUnit: 'hour',
          minDuration: 1,
          maxDuration: 2,
          minCommitment: { value: 4, unit: 'hour' },
          billingIncrement: { value: 30, unit: 'minute' },
          supplierLabel: 'City Pass',
          isFrom: true,
          sortOrder: 0,
          dailyEquivalent: null,
          extensions: [],
        },
        {
          offerType: 'package',
          amount: 3000,
          currency: 'THB',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 7,
          maxDuration: 7,
          minCommitment: null,
          billingIncrement: null,
          supplierLabel: 'Weekly Package',
          isFrom: false,
          sortOrder: 1,
          dailyEquivalent: 428.57,
          extensions: [
            {
              offerType: 'extension',
              amount: 450,
              currency: 'THB',
              billingBasis: 'per_day',
              durationUnit: 'day',
              minDuration: 1,
              maxDuration: null,
              billingIncrement: null,
              supplierLabel: null,
              isFrom: false,
              sortOrder: 0,
              dailyEquivalent: null,
            },
          ],
        },
        {
          offerType: 'monthly',
          amount: 6000,
          currency: 'THB',
          billingBasis: 'per_calendar_month',
          durationUnit: 'calendar_month',
          minDuration: 1,
          maxDuration: null,
          minCommitment: null,
          billingIncrement: null,
          supplierLabel: null,
          isFrom: false,
          sortOrder: 2,
          dailyEquivalent: null,
          extensions: [],
        },
      ],
    });

    const specs = (enhanced as any).offers.priceSpecification;
    expect(specs).toHaveLength(3);
    expect(specs[0]).toMatchObject({
      '@type': 'UnitPriceSpecification',
      name: 'From — City Pass',
      price: '100',
      priceCurrency: 'THB',
      referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'HUR' },
      eligibleQuantity: {
        '@type': 'QuantitativeValue',
        minValue: 1,
        maxValue: 2,
        unitCode: 'HUR',
      },
    });
    expect(specs[0].eligibleQuantity.minValue).toBeLessThanOrEqual(
      specs[0].eligibleQuantity.maxValue
    );
    expect(specs[0].description).toContain('30-minute increments');
    expect(specs[0].description).toContain('Min. commitment: 4 hours');
    expect(specs[1]).toMatchObject({
      '@type': 'UnitPriceSpecification',
      name: 'Weekly Package',
      price: '3000',
      priceCurrency: 'THB',
      referenceQuantity: { '@type': 'QuantitativeValue', value: 7, unitCode: 'DAY' },
    });
    expect(specs[1].description).toContain('428.57 THB/day daily equivalent');
    expect(specs[1].description).toContain('450 THB per extra day');
    expect(specs[2]).toMatchObject({
      '@type': 'UnitPriceSpecification',
      price: '6000',
      priceCurrency: 'THB',
      referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
    });
  });

  it('generates shop-page motorcycle JSON-LD schemas with real non-daily billing units, null-status availability, and fallback rate tiers (#212)', () => {
    const schemas = generateShopMotorcycleSchemas({
      provider_name: 'Patoy Moto',
      motorcycle_rentals: [
        {
          id: 'shop-bike-pkg',
          model: 'ADV 350',
          year: 2024,
          engine_capacity_cc: 330,
          availability_status: null, // null means available per isMotorcycleAvailable
          rental_rate_per_day: null,
          rental_rate_currency: 'THB',
          brands: { name: 'Honda' },
          categories: { name: 'Scooter' },
          rental_rate_tiers: [],
          // Raw DB rows or hydrated offers both supported
          rental_offers: [
            {
              id: 'raw-pkg-7',
              motorcycle_id: 'shop-bike-pkg',
              parent_offer_id: null,
              offer_type: 'package',
              amount: 3000,
              currency: 'THB',
              billing_basis: 'package_total',
              duration_unit: 'day',
              min_duration: 7,
              max_duration: 7,
              min_commitment_value: null,
              min_commitment_unit: null,
              billing_increment_value: null,
              billing_increment_unit: null,
              supplier_label: 'Weekly Deal',
              is_from: false,
              sort_order: 0,
            },
            {
              id: 'raw-pkg-ext',
              motorcycle_id: 'shop-bike-pkg',
              parent_offer_id: 'raw-pkg-7',
              offer_type: 'extension',
              amount: 450,
              currency: 'THB',
              billing_basis: 'per_day',
              duration_unit: 'day',
              min_duration: 1,
              max_duration: null,
              min_commitment_value: null,
              min_commitment_unit: null,
              billing_increment_value: null,
              billing_increment_unit: null,
              supplier_label: null,
              is_from: false,
              sort_order: 0,
            },
            {
              id: 'raw-cal-month',
              motorcycle_id: 'shop-bike-pkg',
              parent_offer_id: null,
              offer_type: 'monthly',
              amount: 6000,
              currency: 'THB',
              billing_basis: 'per_calendar_month',
              duration_unit: 'calendar_month',
              min_duration: 1,
              max_duration: null,
              min_commitment_value: null,
              min_commitment_unit: null,
              billing_increment_value: null,
              billing_increment_unit: null,
              supplier_label: null,
              is_from: false,
              sort_order: 1,
            },
          ],
        },
        {
          id: 'shop-bike-legacy-tiers',
          model: 'Click 125',
          year: 2023,
          engine_capacity_cc: 125,
          availability_status: 'available',
          rental_rate_per_day: 250,
          rental_rate_currency: 'THB',
          brands: { name: 'Honda' },
          categories: { name: 'Scooter' },
          rental_offers: [],
          rental_rate_tiers: [
            { min_days: 1, max_days: 6, rate_per_day: 250, currency: 'THB' },
            { min_days: 7, max_days: null, rate_per_day: 200, currency: 'THB' },
          ],
        },
      ],
    });

    expect(schemas).toHaveLength(2);

    const flexOffers = (schemas[0] as any).offers;
    expect(flexOffers.availability).toBe('https://schema.org/InStock');
    expect(flexOffers.priceSpecification).toHaveLength(2);
    expect(flexOffers.priceSpecification[0]).toMatchObject({
      '@type': 'UnitPriceSpecification',
      name: 'Weekly Deal',
      price: '3000',
      priceCurrency: 'THB',
      referenceQuantity: { '@type': 'QuantitativeValue', value: 7, unitCode: 'DAY' },
    });
    expect(flexOffers.priceSpecification[0].description).toContain('for 7 days');
    expect(flexOffers.priceSpecification[0].description).toContain('428.57 THB/day daily equivalent');
    expect(flexOffers.priceSpecification[0].description).toContain('450 THB per extra day');
    expect(flexOffers.priceSpecification[1]).toMatchObject({
      '@type': 'UnitPriceSpecification',
      name: '6000 THB per calendar month',
      price: '6000',
      priceCurrency: 'THB',
      referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
    });
    // Unlabeled offer has billing unit in `name` and does NOT duplicate `name` into `description`
    expect(flexOffers.priceSpecification[1].description).toBeUndefined();
    expect(JSON.stringify(flexOffers)).not.toContain('Daily Rate');

    const openapi = require('@/public/openapi.json');
    const getMotorcyclesParams = openapi.paths['/motorcycles'].get.parameters;
    const minPriceParam = getMotorcyclesParams.find((p: any) => p.name === 'minPrice');
    const maxPriceParam = getMotorcyclesParams.find((p: any) => p.name === 'maxPrice');
    expect(minPriceParam.schema.type).toBe('number');
    expect(maxPriceParam.schema.type).toBe('number');

    const legacyTierSpecs = (schemas[1] as any).offers.priceSpecification;
    expect(legacyTierSpecs).toHaveLength(2);
    expect(legacyTierSpecs[0]).toMatchObject({
      price: '250',
      priceCurrency: 'THB',
      referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'DAY' },
    });
    expect(legacyTierSpecs[1]).toMatchObject({
      price: '200',
      priceCurrency: 'THB',
      referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'DAY' },
    });
  });
});
