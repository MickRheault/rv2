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
});
