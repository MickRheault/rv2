function stripContentSections<T>(value: T, childKeys: readonly string[] = []): T {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
        return value.map((item) => stripContentSections(item, childKeys)) as unknown as T;
    }

    const { content_sections: _omitted, ...rest } = value as Record<string, unknown>;
    const [nextKey, ...remainingKeys] = childKeys;
    if (nextKey && nextKey in rest) {
        return {
            ...rest,
            [nextKey]: stripContentSections(rest[nextKey], remainingKeys),
        } as unknown as T;
    }

    return rest as unknown as T;
}

export function sanitizeShopForTool<T>(rawShop: T): T {
    if (!rawShop || typeof rawShop !== 'object') return rawShop;
    if (Array.isArray(rawShop)) {
        return rawShop.map((item) => sanitizeShopForTool(item)) as unknown as T;
    }

    const cleaned = stripContentSections(rawShop as Record<string, unknown>);
    return {
        ...cleaned,
        ...('cities' in cleaned
            ? { cities: stripContentSections(cleaned.cities, ['provinces', 'countries']) }
            : {}),
        ...('motorcycle_rentals' in cleaned && Array.isArray(cleaned.motorcycle_rentals)
            ? {
                  motorcycle_rentals: cleaned.motorcycle_rentals.map((m) =>
                      sanitizeMotorcycleForTool(m)
                  ),
              }
            : {}),
    } as unknown as T;
}

export function sanitizeMotorcycleForTool<T>(rawMotorcycle: T): T {
    if (!rawMotorcycle || typeof rawMotorcycle !== 'object') return rawMotorcycle;
    if (Array.isArray(rawMotorcycle)) {
        return rawMotorcycle.map((item) => sanitizeMotorcycleForTool(item)) as unknown as T;
    }

    const cleaned = stripContentSections(rawMotorcycle as Record<string, unknown>);
    return {
        ...cleaned,
        ...('rental_shops' in cleaned
            ? { rental_shops: sanitizeShopForTool(cleaned.rental_shops) }
            : {}),
    } as unknown as T;
}
