import { generateMotorcycleSEO } from '@/lib/seo/config';
import {
  generateMotorcycleSchema,
  generateVehicleSchema,
  generateEnhancedMotorcycleSchema,
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
    const seo = generateMotorcycleSEO({
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
      },
    });
    expect(seo.description).toContain('from THB 6,000 per calendar month');
    expect(seo.description).not.toContain('/day');

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
          maxDuration: null,
          minCommitment: { value: 2, unit: 'hour' },
          billingIncrement: null,
          supplierLabel: null,
          isFrom: false,
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
          extensions: [],
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
      price: '100',
      priceCurrency: 'THB',
      referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'HUR' },
    });
    expect(specs[1]).toMatchObject({
      '@type': 'UnitPriceSpecification',
      name: 'Weekly Package',
      price: '3000',
      priceCurrency: 'THB',
      referenceQuantity: { '@type': 'QuantitativeValue', value: 7, unitCode: 'DAY' },
    });
    expect(specs[2]).toMatchObject({
      '@type': 'UnitPriceSpecification',
      price: '6000',
      priceCurrency: 'THB',
      referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
    });
  });
});
