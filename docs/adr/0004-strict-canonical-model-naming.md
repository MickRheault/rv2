# Strict Canonical Model Naming Without Fuzzy Guessing

Inventory matching and model naming must strictly adhere to canonical manufacturer naming rather than automated fuzzy guessing or arbitrary scraper title strings. Existing database names are authoritative; updates require deterministic matching against existing shop inventory—including punctuation/hyphen and alphanumeric boundary normalization (`Zoomer-X` ↔ `Zoomer X`, `PG1` ↔ `PG 1` ↔ `PG-1`) and composite matching of bare family names with `engine_capacity_cc` (`Click` + `125` ↔ `Click 125`) while keeping normalization strictly separate from curated display names and keeping distinct variant qualifiers (`Click 125 Gen 5th`) separate.

