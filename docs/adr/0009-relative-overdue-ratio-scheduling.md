# Relative Overdue Ratio Scheduling

To prevent priority starvation under a fixed daily crawl budget (e.g. 10 shops/day), task scheduling orders pending shops by their Relative Overdue Ratio:
$$\text{Urgency Score} = \frac{\text{Days since last run}}{\text{Tier cadence days}}$$

Shops with the highest score are dequeued first. A neglected Tier 2 (monthly) or Tier 3 (bi-monthly) shop will naturally surpass a recently crawled Tier 1 (weekly) shop once sufficiently overdue, guaranteeing that lower-cadence tiers always receive crawl budget without requiring rigid manual slot partitions.
