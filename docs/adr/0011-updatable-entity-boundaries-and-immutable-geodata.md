# Updatable Entity Boundaries and Protected Geodata

Change Proposals can propose updates across both inventory and shop-level information, subject to a strict immutability boundary:
- **Immutable / Protected Fields**: `provider_name`, `full_address`, `latitude`, `longitude`, `place_id`. These fields anchor geocoding and Google Places synchronization and must never be altered by crawler proposals.
- **Updatable Shop Fields**: `business_description`, `phone`, `website`, `rental_shop_inclusions`, and `rental_shop_conditions`.
- **Updatable Inventory Fields**: `motorcycle_rentals`, `rental_rate_tiers`, `motorcycle_conditions`, and `motorcycle_features`. For `motorcycle_conditions`, omitting `proposedData.conditions` preserves existing rows, an explicit empty array (`[]`) clears them, condition types must reference existing `condition_types` rows without duplicates, stale before-states (`originalData.conditions` mismatching current DB rows) are rejected, and updates are applied atomically without erasing existing conditions or rental rate tiers on failure.

