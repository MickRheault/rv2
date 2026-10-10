# Verbatim Pricing as Source of Truth

The ingestion agent extracts pricing and rate tiers exactly as published on the shop's website without performing synthetic math (such as dividing monthly sums into synthetic daily averages or fabricating arbitrary day boundaries). What is published on the shop website is the authoritative source of truth. If a shop publishes specific day ranges, they are preserved verbatim; if only a single daily rate is advertised, only that single rate tier is captured.
