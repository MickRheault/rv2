// Cookie consent management for GDPR compliance

export type ConsentPreferences = {
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
};

export type ConsentStatus = 'pending' | 'accepted' | 'declined' | 'partial';

const CONSENT_KEY = 'ridevault_cookie_consent';
const CONSENT_VERSION = '1.0';

// Get stored consent preferences
export const getConsentPreferences = (): { 
  status: ConsentStatus; 
  preferences: ConsentPreferences;
  version: string;
} | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    return {
      status: parsed.status || 'pending',
      preferences: parsed.preferences || {
        analytics: false,
        marketing: false,
        functional: true, // Always true for essential functionality
      },
      version: parsed.version || '1.0',
    };
  } catch {
    return null;
  }
};

// Store consent preferences
export const setConsentPreferences = (
  status: ConsentStatus,
  preferences: ConsentPreferences
): void => {
  if (typeof window === 'undefined') return;
  
  const consentData = {
    status,
    preferences,
    version: CONSENT_VERSION,
    timestamp: new Date().toISOString(),
  };
  
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consentData));
  
  // Trigger custom event for components to react to consent changes
  window.dispatchEvent(new CustomEvent('consentChange', { 
    detail: consentData 
  }));
};

// Accept all cookies
export const acceptAllCookies = (): void => {
  setConsentPreferences('accepted', {
    analytics: true,
    marketing: true,
    functional: true,
  });
};

// Decline all non-essential cookies
export const declineAllCookies = (): void => {
  setConsentPreferences('declined', {
    analytics: false,
    marketing: false,
    functional: true, // Keep functional cookies for basic site operation
  });
};

// Check if analytics cookies are allowed
export const isAnalyticsAllowed = (): boolean => {
  const consent = getConsentPreferences();
  return consent?.preferences.analytics || false;
};

// Check if marketing cookies are allowed
export const isMarketingAllowed = (): boolean => {
  const consent = getConsentPreferences();
  return consent?.preferences.marketing || false;
};

// Check if user has made a consent choice
export const hasUserConsented = (): boolean => {
  const consent = getConsentPreferences();
  return consent !== null && consent.status !== 'pending';
};

// Clear all consent data (for testing or reset)
export const clearConsent = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CONSENT_KEY);
  window.dispatchEvent(new CustomEvent('consentChange', { 
    detail: null 
  }));
};

// Check if consent needs to be updated (version change)
export const needsConsentUpdate = (): boolean => {
  const consent = getConsentPreferences();
  return !consent || consent.version !== CONSENT_VERSION;
};