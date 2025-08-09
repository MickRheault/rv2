'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { XMarkIcon, CogIcon } from '@heroicons/react/24/outline';
import {
  hasUserConsented,
  acceptAllCookies,
  declineAllCookies,
  setConsentPreferences,
  getConsentPreferences,
  type ConsentPreferences,
} from '@/lib/analytics/consent';

export default function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    analytics: false,
    marketing: false,
    functional: true,
  });

  useEffect(() => {
    // Show banner if user hasn't consented yet
    if (!hasUserConsented()) {
      setShowBanner(true);
    }

    // Load existing preferences if any
    const existing = getConsentPreferences();
    if (existing) {
      setPreferences(existing.preferences);
    }
  }, []);

  const handleAcceptAll = () => {
    acceptAllCookies();
    setShowBanner(false);
    setShowPreferences(false);
  };

  const handleDeclineAll = () => {
    declineAllCookies();
    setShowBanner(false);
    setShowPreferences(false);
  };

  const handleSavePreferences = () => {
    const status = preferences.analytics || preferences.marketing ? 'partial' : 'declined';
    setConsentPreferences(status, preferences);
    setShowBanner(false);
    setShowPreferences(false);
  };

  const togglePreference = (key: keyof ConsentPreferences) => {
    if (key === 'functional') return; // Functional cookies are always required
    
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg">
      <div className="container mx-auto px-4 py-4">
        {!showPreferences ? (
          // Simple banner
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">
                We use cookies to enhance your experience
              </h3>
              <p className="text-sm text-gray-600">
                We use cookies and similar technologies to improve your browsing experience, 
                  analyze site traffic, and provide personalized content. By clicking &quot;Accept All&quot;, 
                you consent to our use of cookies.{' '}
                <a href="/privacy" className="text-blue-600 hover:underline">
                  Learn more in our Privacy Policy
                </a>.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreferences(true)}
              >
                <CogIcon className="w-4 h-4 mr-2" />
                Preferences
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeclineAll}
              >
                Decline
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAcceptAll}
              >
                Accept All
              </Button>
            </div>
          </div>
        ) : (
          // Detailed preferences
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Cookie Preferences
              </h3>
              <button
                onClick={() => setShowPreferences(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* Functional Cookies */}
              <div className="flex items-start justify-between">
                <div className="flex-1 mr-4">
                  <h4 className="font-medium text-gray-900">Functional Cookies</h4>
                  <p className="text-sm text-gray-600">
                    Essential for the website to function properly. These cannot be disabled.
                  </p>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-500">Always On</span>
                </div>
              </div>

              {/* Analytics Cookies */}
              <div className="flex items-start justify-between">
                <div className="flex-1 mr-4">
                  <h4 className="font-medium text-gray-900">Analytics Cookies</h4>
                  <p className="text-sm text-gray-600">
                    Help us understand how visitors interact with our website by collecting 
                    and reporting information anonymously.
                  </p>
                </div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={() => togglePreference('analytics')}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {preferences.analytics ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>

              {/* Marketing Cookies */}
              <div className="flex items-start justify-between">
                <div className="flex-1 mr-4">
                  <h4 className="font-medium text-gray-900">Marketing Cookies</h4>
                  <p className="text-sm text-gray-600">
                    Used to track visitors across websites to display relevant advertisements 
                    and marketing campaigns.
                  </p>
                </div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.marketing}
                    onChange={() => togglePreference('marketing')}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {preferences.marketing ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeclineAll}
              >
                Decline All
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSavePreferences}
              >
                Save Preferences
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}