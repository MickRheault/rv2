/**
 * @jest-environment node
 */

import {
  validateGeodataImmutability,
  GeodataImmutabilityError,
  ChangeProposalService,
} from '@/services/change-proposals';

describe('Change Proposal Application & Geodata Protection', () => {
  describe('validateGeodataImmutability', () => {
    it('passes for allowed mutable shop fields', () => {
      expect(() => {
        validateGeodataImmutability({
          business_description: 'Updated shop bio',
          phone: '+66 81 234 5678',
          website: 'https://new-url.com',
        });
      }).not.toThrow();
    });

    it('throws GeodataImmutabilityError when attempting to alter place_id', () => {
      expect(() => {
        validateGeodataImmutability({
          place_id: 'ChIJnewplaceid12345',
        });
      }).toThrow(GeodataImmutabilityError);
    });

    it('throws GeodataImmutabilityError when attempting to alter address or coordinates', () => {
      expect(() => {
        validateGeodataImmutability({
          full_address: '123 New Beach Road',
        });
      }).toThrow(GeodataImmutabilityError);

      expect(() => {
        validateGeodataImmutability({
          latitude: 7.8932,
          longitude: 98.2983,
        });
      }).toThrow(GeodataImmutabilityError);

      expect(() => {
        validateGeodataImmutability({
          provider_name: 'Renamed Shop Provider',
        });
      }).toThrow(GeodataImmutabilityError);
    });
  });
});
