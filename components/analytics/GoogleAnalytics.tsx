'use client';

import { useEffect, useState } from 'react';
import { GoogleAnalytics as GA } from '@next/third-parties/google';
import { isAnalyticsAllowed, hasUserConsented } from '@/lib/analytics/consent';
import { GA_TRACKING_ID, isGAEnabled } from '@/lib/analytics/gtag';

export default function GoogleAnalytics() {
  const [shouldLoadGA, setShouldLoadGA] = useState(false);

  useEffect(() => {
    // Function to check consent and update GA loading state
    const checkConsent = () => {
      if (!isGAEnabled) {
        setShouldLoadGA(false);
        return;
      }

      // If user hasn't consented yet, don't load GA
      if (!hasUserConsented()) {
        setShouldLoadGA(false);
        return;
      }

      // If user has consented and allows analytics, load GA
      setShouldLoadGA(isAnalyticsAllowed());
    };

    // Check consent on mount
    checkConsent();

    // Listen for consent changes
    const handleConsentChange = () => {
      checkConsent();
    };

    window.addEventListener('consentChange', handleConsentChange);

    return () => {
      window.removeEventListener('consentChange', handleConsentChange);
    };
  }, []);

  // Don't render anything if GA is not enabled or consent not given
  if (!isGAEnabled || !shouldLoadGA) {
    return null;
  }

  return (
    <GA 
      gaId={GA_TRACKING_ID!} 
      dataLayerName="dataLayer"
    />
  );
}

// Hook for components to track events safely
export function useAnalytics() {
  const [canTrack, setCanTrack] = useState(false);

  useEffect(() => {
    const checkTrackingPermission = () => {
      const canTrackAnalytics = Boolean(isGAEnabled && hasUserConsented() && isAnalyticsAllowed());
      setCanTrack(canTrackAnalytics);
    };

    checkTrackingPermission();

    const handleConsentChange = () => {
      checkTrackingPermission();
    };

    window.addEventListener('consentChange', handleConsentChange);

    return () => {
      window.removeEventListener('consentChange', handleConsentChange);
    };
  }, []);

  return { canTrack };
}