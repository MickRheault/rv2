'use client';

import { useEffect, useState, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Spinner } from '@/components/ui';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing invitation...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Auth callback triggered');
        console.log('Current URL:', window.location.href);
        console.log('Hash:', window.location.hash);
        console.log('Search params:', window.location.search);
        
        // Check both URL parameters and hash fragments (Supabase can use either)
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        // Try URL parameters first, then hash fragments
        let access_token = urlParams.get('access_token') || hashParams.get('access_token');
        let refresh_token = urlParams.get('refresh_token') || hashParams.get('refresh_token');
        let type = urlParams.get('type') || hashParams.get('type');
        
        // Also check for token_hash (used in some Supabase invitation flows)
        const token_hash = urlParams.get('token_hash') || hashParams.get('token_hash');
        
        // If we have a token_hash but no access_token, try to use the token_hash
        if (!access_token && token_hash) {
          access_token = token_hash;
          console.log('Using token_hash as access_token');
        }
        
        console.log('URL params:', { 
          access_token: !!urlParams.get('access_token'), 
          refresh_token: !!urlParams.get('refresh_token'), 
          type: urlParams.get('type'),
          token_hash: !!urlParams.get('token_hash')
        });
        console.log('Hash params:', { 
          access_token: !!hashParams.get('access_token'), 
          refresh_token: !!hashParams.get('refresh_token'), 
          type: hashParams.get('type'),
          token_hash: !!hashParams.get('token_hash')
        });
        console.log('Final parsed params:', { access_token: !!access_token, refresh_token: !!refresh_token, type, token_hash: !!token_hash });

        if (type === 'invite' && access_token) {
          console.log('Processing invite with access token');
          // Handle invitation - set the session with the provided tokens
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token: refresh_token || '',
          });

          if (error) {
            console.error('Error setting session:', error);
            setStatus('error');
            setMessage('Failed to process invitation. Please try again.');
            return;
          }

          if (data.user) {
            console.log('Session set successfully, user:', data.user.email);
            setStatus('success');
            setMessage('Invitation accepted! Please set up your password.');
            
            // Redirect to password setup after a brief delay
            setTimeout(() => {
              console.log('Redirecting to password setup');
              router.push('/auth/setup-password');
            }, 1500);
          } else {
            console.error('No user data after setting session');
            setStatus('error');
            setMessage('Failed to process invitation. No user data.');
          }
        } else if (type === 'recovery' && access_token) {
          // Handle password recovery
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token: refresh_token || '',
          });

          if (error) {
            console.error('Error setting session:', error);
            setStatus('error');
            setMessage('Failed to process password recovery. Please try again.');
            return;
          }

          setStatus('success');
          setMessage('Password recovery verified! Redirecting to reset password.');
          
          setTimeout(() => {
            router.push('/auth/reset-password');
          }, 1500);
        } else {
          console.log('No invite/recovery type found, checking current session');
          // Regular auth callback or unknown type - check if user is already authenticated
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Auth callback error:', error);
            setStatus('error');
            setMessage('Authentication failed. Please try again.');
            return;
          }

          if (session && session.user) {
            console.log('User already has session:', session.user.email);
            // Check if they need to set up password (invited users)
            if (session.user.invited_at && !session.user.email_confirmed_at) {
              console.log('User was invited and needs password setup');
              setStatus('success');
              setMessage('Invitation accepted! Please set up your password.');
              
              setTimeout(() => {
                router.push('/auth/setup-password');
              }, 1500);
            } else {
              setStatus('success');
              setMessage('Authentication successful! Redirecting...');
              
              setTimeout(() => {
                router.push('/');
              }, 1500);
            }
          } else {
            console.log('No session found, redirecting to login');
            setStatus('error');
            setMessage('No valid session found. Redirecting to login...');
            
            setTimeout(() => {
              router.push('/admin/login');
            }, 2000);
          }
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <Image
            className="mx-auto h-12 w-auto"
            src="/logo.svg"
            alt="Global Moto Rentals"
            width={48}
            height={48}
            onError={(e) => {
              const target = e.currentTarget as unknown as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            {status === 'loading' && 'Processing...'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Error'}
          </h2>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            {status === 'loading' && (
              <div className="flex flex-col items-center">
                <Spinner size="lg" />
                <p className="mt-4 text-sm text-gray-600">{message}</p>
              </div>
            )}

            {status === 'success' && (
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-green-100 p-3">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="mt-4 text-sm text-gray-600">{message}</p>
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-red-100 p-3">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="mt-4 text-sm text-gray-600">{message}</p>
                <button
                  onClick={() => router.push('/')}
                  className="mt-4 text-sm text-blue-600 hover:text-blue-500"
                >
                  Go to Homepage
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}