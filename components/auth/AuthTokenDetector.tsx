'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Component that detects auth tokens in the URL hash and redirects to auth callback
 * This handles cases where Supabase redirects to the homepage with tokens
 */
export default function AuthTokenDetector() {
  const router = useRouter();

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Check if we have auth tokens in the URL hash
    const hash = window.location.hash;
    
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const access_token = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      // If we have auth tokens, redirect to the auth callback with the hash intact
      if (access_token && (type === 'invite' || type === 'recovery')) {
        console.log('Auth tokens detected on homepage, redirecting to auth callback');
        
        // Preserve the current hash and redirect to auth callback
        const currentUrl = window.location.href;
        const authCallbackUrl = currentUrl.replace(window.location.pathname, '/auth/callback');
        
        // Use window.location.replace to avoid creating history entry
        window.location.replace(authCallbackUrl);
      }
    }
  }, [router]);

  // This component doesn't render anything
  return null;
}