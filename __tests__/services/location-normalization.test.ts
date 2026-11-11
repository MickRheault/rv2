/**
 * @jest-environment node
 */

import { locationService } from '@/services/locations';
import { clearAllTtlCaches } from '@/services/shops';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
    supabase: {
        from: jest.fn(),
    },
}));

describe('locationService.searchLocations normalization, accented catalog matching & narrow projections (#224)', () => {
    const catalogCities = [
        {
            id: 'city-rome',
            name: 'Rome',
            province_id: 'prov-lazio',
            provinces: {
                id: 'prov-lazio',
                name: 'Lazio',
                country_code: 'IT',
                countries: { code: 'IT', name: 'Italy' },
            },
        },
        {
            id: 'city-malaga',
            name: 'Málaga',
            province_id: 'prov-andalusia',
            provinces: {
                id: 'prov-andalusia',
                name: 'Andalusia',
                country_code: 'ES',
                countries: { code: 'ES', name: 'Spain' },
            },
        },
        {
            id: 'city-hanoi',
            name: 'Hanoi',
            province_id: 'prov-hanoi',
            provinces: {
                id: 'prov-hanoi',
                name: 'Hanoi',
                country_code: 'VN',
                countries: { code: 'VN', name: 'Vietnam' },
            },
        },
        {
            id: 'city-hoi-an',
            name: 'Hội An',
            province_id: 'prov-qn',
            provinces: {
                id: 'prov-qn',
                name: 'Quang Nam',
                country_code: 'VN',
                countries: { code: 'VN', name: 'Vietnam' },
            },
        },
        {
            id: 'city-da-nang',
            name: 'Da Nang',
            province_id: 'prov-dn',
            provinces: {
                id: 'prov-dn',
                name: 'Da Nang',
                country_code: 'VN',
                countries: { code: 'VN', name: 'Vietnam' },
            },
        },
        {
            id: 'city-hcmc',
            name: 'Ho Chi Minh City',
            province_id: 'prov-hcmc',
            provinces: {
                id: 'prov-hcmc',
                name: 'Ho Chi Minh',
                country_code: 'VN',
                countries: { code: 'VN', name: 'Vietnam' },
            },
        },
    ];

    const catalogCountries = [
        { code: 'IT', name: 'Italy' },
        { code: 'ES', name: 'Spain' },
        { code: 'TH', name: 'Thailand' },
        { code: 'VN', name: 'Vietnam' },
    ];

    let recordedSelects: Array<{ table: string; cols: string }> = [];

    function matchesIlikePattern(value: string, pattern: string): boolean {
        const inner = pattern.replace(/^%|%$/g, '').toLowerCase();
        return value.toLowerCase().includes(inner);
    }

    function matchesOrExpr(row: Record<string, any>, expr: string): boolean {
        return expr.split(',').some((clause) => {
            const match = clause.trim().match(/^([a-z_]+)\.ilike\.(.+)$/i);
            if (!match) return false;
            const [, col, pattern] = match;
            return matchesIlikePattern(String(row[col] ?? ''), pattern);
        });
    }

    beforeEach(() => {
        jest.clearAllMocks();
        clearAllTtlCaches();
        recordedSelects = [];
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            const sourceRows =
                table === 'cities'
                    ? catalogCities
                    : table === 'countries'
                      ? catalogCountries
                      : [];

            let filtered = [...sourceRows];
            const resolveResult = () => Promise.resolve({ data: filtered, error: null });
            const builder: any = {
                select: jest.fn((cols: string) => {
                    recordedSelects.push({ table, cols });
                    return builder;
                }),
                ilike: jest.fn((col: string, pattern: string) => {
                    filtered = filtered.filter((r: any) =>
                        matchesIlikePattern(String(r[col] ?? ''), pattern)
                    );
                    return builder;
                }),
                or: jest.fn((expr: string) => {
                    filtered = filtered.filter((r: any) => matchesOrExpr(r, expr));
                    return builder;
                }),
                order: jest.fn(() => resolveResult()),
                limit: jest.fn((n: number) =>
                    Promise.resolve({ data: filtered.slice(0, n), error: null })
                ),
            };
            return builder;
        });
    });

    it('resolves diacritics (both accented queries and accented DB rows like Hội An & Málaga), curated aliases, and "City, Country" qualifiers with narrow column projections', async () => {
        const romaRes = await locationService.searchLocations('Roma');
        expect(romaRes.cities.map((c) => c.id)).toEqual(['city-rome']);

        // Egress standard: searchLocations must NEVER select * or content_sections
        expect(recordedSelects.length).toBeGreaterThan(0);
        for (const { cols } of recordedSelects) {
            expect(cols).not.toContain('*');
            expect(cols).not.toContain('content_sections');
        }

        const hanoiRes = await locationService.searchLocations('Hà Nội');
        expect(hanoiRes.cities.map((c) => c.id)).toEqual(['city-hanoi']);

        // Accented catalog row matched by both unaccented ("Hoi An") and accented ("Hội An") inputs
        const hoiAnAsciiRes = await locationService.searchLocations('Hoi An');
        expect(hoiAnAsciiRes.cities.map((c) => c.id)).toEqual(['city-hoi-an']);

        const hoiAnAccentedRes = await locationService.searchLocations('Hội An');
        expect(hoiAnAccentedRes.cities.map((c) => c.id)).toEqual(['city-hoi-an']);

        const malagaAsciiRes = await locationService.searchLocations('Malaga, Spain');
        expect(malagaAsciiRes.cities.map((c) => c.id)).toEqual(['city-malaga']);

        const malagaAccentedRes = await locationService.searchLocations('Málaga');
        expect(malagaAccentedRes.cities.map((c) => c.id)).toEqual(['city-malaga']);

        const daNangRes = await locationService.searchLocations('Đà Nẵng');
        expect(daNangRes.cities.map((c) => c.id)).toEqual(['city-da-nang']);

        const saigonRes = await locationService.searchLocations('Sài Gòn');
        expect(saigonRes.cities.map((c) => c.id)).toEqual(['city-hcmc']);

        const hanoiVietNamRes = await locationService.searchLocations('Hanoi, Viet Nam');
        expect(hanoiVietNamRes.cities.map((c) => c.id)).toEqual(['city-hanoi']);

        const romeThailandRes = await locationService.searchLocations('Rome, Thailand');
        expect(romeThailandRes.cities).toEqual([]);
    });
});
