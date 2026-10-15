/**
 * @jest-environment node
 */

import { executeTool } from '@/lib/mcp/tools';
import { motorcycleService } from '@/services/motorcycles';

const registeredTools: Record<string, { config: any; handler: Function }> = {};

jest.mock('mcp-handler', () => ({
  createMcpHandler: (setup: (server: any) => void) => {
    const mockServer = {
      registerTool: (name: string, config: any, handler: Function) => {
        registeredTools[name] = { config, handler };
      },
    };
    setup(mockServer);
    return jest.fn();
  },
  withMcpAuth: (handler: any) => handler,
}));

jest.mock('@/services/motorcycles', () => ({
  motorcycleService: {
    getMotorcycles: jest.fn(),
    getMotorcycleById: jest.fn(),
  },
}));

describe('GMR MCP Tools Model Year Range Support (#139)', () => {
  beforeAll(() => {
    require('@/app/api/mcp/[transport]/route');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('lib/mcp/tools.ts executeTool', () => {
    it('includes year_to in list_motorcycles and get_motorcycle tool responses', async () => {
      const sampleBike = {
        id: 'bike-1',
        model: 'CB500X',
        year: 2015,
        year_to: 2020,
        rental_rate_per_day: 25,
        rental_rate_currency: 'USD',
        brands: { name: 'Honda' },
        categories: { name: 'Adventure' },
        rental_shops: {
          provider_name: 'Chiang Mai Moto',
          slug: 'chiang-mai-moto',
          rating: 4.8,
          cities: {
            name: 'Chiang Mai',
            provinces: {
              countries: { name: 'Thailand' },
            },
          },
        },
      };

      (motorcycleService.getMotorcycles as jest.Mock).mockResolvedValue({
        total: 1,
        motorcycles: [sampleBike],
      });
      (motorcycleService.getMotorcycleById as jest.Mock).mockResolvedValue(sampleBike);

      const listResult = await executeTool('list_motorcycles', {});
      expect(listResult.success).toBe(true);
      expect((listResult.data as any).motorcycles[0]).toMatchObject({
        id: 'bike-1',
        model: 'CB500X',
        year: 2015,
        year_to: 2020,
      });

      const getResult = await executeTool('get_motorcycle', { id: 'bike-1' });
      expect(getResult.success).toBe(true);
      expect(getResult.data).toMatchObject({
        id: 'bike-1',
        year: 2015,
        year_to: 2020,
      });
    });

    it('defaults year_to to null in list_motorcycles when unset', async () => {
      (motorcycleService.getMotorcycles as jest.Mock).mockResolvedValue({
        total: 1,
        motorcycles: [
          {
            id: 'bike-2',
            model: 'Click 125i',
            year: 2023,
            rental_rate_per_day: 10,
            rental_rate_currency: 'USD',
          },
        ],
      });

      const listResult = await executeTool('list_motorcycles', {});
      expect(listResult.success).toBe(true);
      expect((listResult.data as any).motorcycles[0]).toMatchObject({
        id: 'bike-2',
        year: 2023,
        year_to: null,
      });
    });
  });

  describe('app/api/mcp/[transport]/route.ts MCP tool schemas and handlers', () => {
    it('defines year_to on create_motorcycle and update_motorcycle inputSchema', () => {
      const createSchema = registeredTools.create_motorcycle?.config?.inputSchema;
      const updateSchema = registeredTools.update_motorcycle?.config?.inputSchema;

      expect(createSchema).toBeDefined();
      expect(createSchema.year_to).toBeDefined();
      expect(createSchema.year_to.safeParse(2020).success).toBe(true);
      expect(createSchema.year_to.safeParse(null).success).toBe(true);
      expect(createSchema.year_to.safeParse(undefined).success).toBe(true);

      expect(updateSchema).toBeDefined();
      expect(updateSchema.year_to).toBeDefined();
      expect(updateSchema.year_to.safeParse(2020).success).toBe(true);
      expect(updateSchema.year_to.safeParse(null).success).toBe(true);
      expect(updateSchema.year_to.safeParse(undefined).success).toBe(true);
    });

    it('passes year_to through create_motorcycle and update_motorcycle handlers', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: 'bike-1', model: 'CB500X', year: 2015, year_to: 2020 },
        }),
      } as any);

      const adminExtra = { authInfo: { extra: { accessLevel: 'admin' } } };

      await registeredTools.create_motorcycle.handler(
        {
          model: 'CB500X',
          shop_id: 'shop-1',
          year: 2015,
          year_to: 2020,
        },
        adminExtra
      );

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/motorcycles'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            model: 'CB500X',
            shop_id: 'shop-1',
            year: 2015,
            year_to: 2020,
          }),
        })
      );

      fetchSpy.mockClear();

      await registeredTools.update_motorcycle.handler(
        {
          id: 'bike-1',
          year: 2015,
          year_to: 2020,
        },
        adminExtra
      );

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/motorcycles/bike-1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            year: 2015,
            year_to: 2020,
          }),
        })
      );

      fetchSpy.mockRestore();
    });
  });
});
