/**
 * @jest-environment node
 */

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

describe('External MCP Flexible Rental Offers Tools (#210)', () => {
  const originalFetch = global.fetch;
  const mockFetch = jest.fn();

  beforeAll(() => {
    process.env.MCP_KEY_ADMIN = 'test-admin-key';
    require('@/app/api/mcp/[transport]/route');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as any;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('registers set_motorcycle_offers and calls PUT /api/v1/motorcycles/:id/offers', async () => {
    expect(registeredTools.set_motorcycle_offers).toBeDefined();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { offers: [{ offerType: 'package', amount: 3000, currency: 'THB', dailyEquivalent: 428.57 }] },
      }),
    });

    const offersPayload = [
      {
        offerType: 'package',
        amount: 3000,
        currency: 'THB',
        billingBasis: 'package_total',
        durationUnit: 'day',
        minDuration: 7,
        maxDuration: 7,
        extensions: [{ amount: 450, currency: 'THB', billingBasis: 'per_day' }],
      },
    ];

    const res = await registeredTools.set_motorcycle_offers.handler(
      {
        motorcycle_id: 'bike-123',
        offers: JSON.stringify(offersPayload),
      },
      { authInfo: { extra: { accessLevel: 'admin' } } }
    );

    expect(res.isError).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = mockFetch.mock.calls[0];
    expect(calledUrl).toContain('/motorcycles/bike-123/offers');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ offers: offersPayload });
  });

  it('passes rental_offers JSON string through create_motorcycle and update_motorcycle', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'bike-999' } }),
    });

    const offersJson = JSON.stringify([
      {
        offerType: 'monthly',
        amount: 6000,
        currency: 'THB',
        billingBasis: 'per_calendar_month',
        durationUnit: 'calendar_month',
        minDuration: 1,
      },
    ]);

    const createRes = await registeredTools.create_motorcycle.handler(
      {
        model: 'PCX 160',
        shop_id: 'shop-1',
        rental_offers: offersJson,
      },
      { authInfo: { extra: { accessLevel: 'admin' } } }
    );
    expect(createRes.isError).toBeUndefined();
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).rental_offers).toEqual(JSON.parse(offersJson));

    const updateRes = await registeredTools.update_motorcycle.handler(
      {
        id: 'bike-999',
        rental_offers: offersJson,
      },
      { authInfo: { extra: { accessLevel: 'admin' } } }
    );
    expect(updateRes.isError).toBeUndefined();
    expect(JSON.parse(mockFetch.mock.calls[1][1].body).rental_offers).toEqual(JSON.parse(offersJson));
  });
});
