/**
 * @jest-environment node
 */

import { locationService } from '@/services/locations';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
    supabase: {
        from: jest.fn(),
    },
}));

describe('locationService.searchLocations normalization & alias resolution (#224)', () => {
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
        { code: 'TH', name: 'Thailand' },
        { code: 'VN', name: 'Vietnam' },
    ];

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
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            const sourceRows =
                table === 'cities'
                    ? catalogCities
                    : table === 'countries'
                      ? catalogCountries
                      : [];

            let filtered = [...sourceRows];
            const builder: any = {
                select: jest.fn(() => builder),
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
                limit: jest.fn((n: number) =>
                    Promise.resolve({ data: filtered.slice(0, n), error: null })
                ),
            };
            return builder;
        });
    });

    it('resolves diacritics, curated aliases, and "City, Country" strings while filtering out mismatched country qualifiers', async () => {
        const romaRes = await locationService.searchLocations('Roma');
        expect(romaRes.cities.map((c) => c.id)).toEqual(['city-rome']);

        const hanoiRes = await locationService.searchLocations('Hà Nội');
        expect(hanoiRes.cities.map((c) => c.id)).toEqual(['city-hanoi']);

        const daNangRes = await locationService.searchLocations('Đà Nẵng');
        expect(daNangRes.cities.map((c) => c.id)).toEqual(['city-da-nang']);

        const saigonRes = await locationService.searchLocations('Sài Gòn');
        expect(saigonRes.cities.map((c) => c.id)).toEqual(['city-hcmc']);

        const romeItalyRes = await locationService.searchLocations('Roma, Italia');
        expect(romeItalyRes.cities.map((c) => c.id)).toEqual(['city-rome']);

        const romeThailandRes = await locationService.searchLocations('Rome, Thailand');
        expect(romeThailandRes.cities).toEqual([]);
    });
});
