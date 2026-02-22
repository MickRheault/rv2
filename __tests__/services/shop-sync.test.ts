import { ShopSyncService } from '@/services/shop-sync';
import { ShopManifest } from '@/types/shop-manifest';

// Mocking Tools
jest.mock('@/lib/mcp/tools', () => ({
  resolveCityId: jest.fn().mockResolvedValue('city-uuid-123'),
  resolveBrandId: jest.fn().mockResolvedValue('brand-uuid-123'),
  resolveCategoryId: jest.fn().mockResolvedValue('category-uuid-123'),
}));

describe('ShopSyncService', () => {
  let service: ShopSyncService;
  let mockSupabase: any;
  let queryBuilder: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a robust chainable mock
    queryBuilder = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      eq: jest.fn(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      then: jest.fn(), // Initialize here!
    };

    // Make chainable methods return 'this' (the builder)
    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.insert.mockReturnValue(queryBuilder);
    queryBuilder.update.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);

    // Default 'then' behavior (resolve with empty data)
    queryBuilder.then.mockImplementation((resolve: any) => resolve({ data: [] }));

    mockSupabase = {
      from: jest.fn().mockReturnValue(queryBuilder),
    };

    service = new ShopSyncService(mockSupabase as any);
  });

  it('creates a new shop if it does not exist', async () => {
    // Setup: Shop not found
    queryBuilder.maybeSingle.mockResolvedValue({ data: null });
    // Setup: Create returns ID
    queryBuilder.single.mockResolvedValue({ data: { id: 'new-shop-id' }, error: null });
    
    // Inventory query uses default 'then' mock -> { data: [] }

    const manifest: ShopManifest = {
      shop: {
        provider_name: 'Test Shop',
        city: 'Bangkok',
      },
      inventory: { items: [] },
    };

    const result = await service.sync(manifest);

    expect(result.action).toBe('created');
    expect(result.shopId).toBe('new-shop-id');
    expect(mockSupabase.from).toHaveBeenCalledWith('rental_shops');
    expect(queryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      provider_name: 'Test Shop',
      city_id: 'city-uuid-123',
    }));
  });

  it('updates an existing shop', async () => {
    // Setup: Shop found
    queryBuilder.maybeSingle.mockResolvedValue({ data: { id: 'existing-id', slug: 'test-shop' } });
    
    // Setup: Update matches
    // .update().eq() -> awaits builder
    queryBuilder.then.mockImplementation((resolve: any) => resolve({ error: null }));

    const manifest: ShopManifest = {
      shop: {
        provider_name: 'Test Shop Updated',
        city: 'Bangkok',
      },
      inventory: { items: [] },
    };

    const result = await service.sync(manifest);

    expect(result.action).toBe('updated');
    expect(result.shopId).toBe('existing-id');
    expect(queryBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
      provider_name: 'Test Shop Updated',
    }));
  });

  it('syncs inventory items', async () => {
    // Shop found
    queryBuilder.maybeSingle.mockResolvedValue({ data: { id: 'shop-id', slug: 'test-shop' } });
    
    // Inventory query: existing item
    const existingInventory = [{ id: 'bike-1', model: 'Old Model', rental_rate_per_day: 100 }];
    
    // We need `then` to return different things.
    // 1. Inventory Fetch: .select().eq() -> { data: existingInventory }
    // 2. Insert/Update calls -> { error: null }
    
    queryBuilder.then
      .mockImplementationOnce((resolve: any) => resolve({ data: existingInventory })) // Inventory fetch
      .mockImplementation((resolve: any) => resolve({ error: null })); // Subsequent writes

    const manifest: ShopManifest = {
      shop: { provider_name: 'Test Shop', city: 'Bangkok' },
      inventory: {
        items: [
          { model: 'New Model', brand: 'Honda', category: 'Scooter', daily_rate: 200 }
        ]
      }
    };

    const result = await service.sync(manifest);

    expect(result.inventory.created).toBe(1);
    // Since we're creating new item, insert is called
    expect(queryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      model: 'New Model',
      shop_id: 'shop-id',
      rental_rate_per_day: 200,
    }));
  });
});
