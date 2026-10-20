# Spec: Remove "Ride the world!" Section from Homepage

**Date**: 2026-10-20
**Status**: Approved
**Issue**: [#173](https://github.com/MickRheault/rv2/issues/173)

## 1. Goal & Problem Statement
The homepage (`app/page.tsx`) currently renders a lower section below the hero containing `"Ride the world!"` and `"Discover rental shops and compare their bikes."`. With the new AI Chat & Location Search discovery card in the hero section, this lower panel is redundant and adds unnecessary whitespace below the hero.

## 2. Requirements
1. **Remove Story/Promise Section (`app/page.tsx`)**:
   - Remove the `<section className="py-20 lg:py-32">` containing `"Ride the world!"` and `"Discover rental shops and compare their bikes."` (along with the stale cleanup comments around it) so the homepage renders `<AuthTokenDetector />` and the Hero section cleanly.
2. **Testing (`components/search/HeroDiscoveryCard.test.tsx`)**:
   - Verify in the `<Home />` test that neither `"Ride the world!"` nor `"Discover rental shops and compare their bikes."` is rendered on the homepage.
