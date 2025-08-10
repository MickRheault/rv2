import locationService from '@/services/locations';
import Link from 'next/link';
import { Metadata } from 'next';
import { generateBrowsePageSchema, StructuredData } from '@/lib/seo/structured-data';

export const metadata: Metadata = {
  title: 'Browse Motorcycle Rentals by Location',
  description:
    'Explore motorcycle rental shops by country and city. Find the best rental locations worldwide.',
};

type LocationsByCountry = Record<string, {
  country: { code: string; name: string }
  provinces: Record<string, {
    province: { id: string; name: string }
    cities: Array<{ id: string; name: string }>
  }>
}>

export default async function BrowsePage() {
  const locationsByCountry: LocationsByCountry = await locationService
    .getLocationsWithShops()
    .catch((error) => {
      console.warn('BrowsePage: failed to fetch locations during build, rendering empty list.', error)
      return {} as LocationsByCountry
    });
  const countries = Object.values(locationsByCountry).sort((a, b) =>
    a.country.name.localeCompare(b.country.name)
  );

  const browsePageSchema = generateBrowsePageSchema(countries);

  return (
    <>
      <StructuredData schema={browsePageSchema} />
      <div className="container-custom py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Browse Locations
          </h1>

          {countries.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-gray-600">No locations with rental shops found.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {countries.map(({ country, provinces }) => (
                <div key={country.code} className="card p-6">
                  <Link
                    href={`/${country.name.toLowerCase().replace(/\s+/g, '-')}`}
                    className="text-2xl font-bold text-gray-800 hover:text-purple-600"
                  >
                    {country.name}
                  </Link>
                  <ul className="pl-4 mt-4 space-y-2 list-disc list-inside">
                    {Object.values(provinces)
                      .flatMap(p => p.cities)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(city => (
                        <li key={city.id}>
                          <Link
                            href={`/${country.name
                              .toLowerCase()
                              .replace(/\s+/g, '-')}/${city.name
                              .toLowerCase()
                              .replace(/\s+/g, '-')}`}
                            className="text-gray-700 hover:text-purple-600"
                          >
                            {city.name}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}