'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Button, Input, Card, Alert } from '@/components/ui';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  const { user, isAdmin, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  // Redirect if already authenticated as admin
  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      router.push('/admin');
    }
  }, [user, isAdmin, authLoading, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.user) {
        setMessage('Signed in successfully! Checking admin privileges...');
        
        // The useAdminAuth hook will handle the redirect
        // once it confirms admin status
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Sign in error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.user) {
        setMessage('Account created! Please check your email for verification. Note: Admin privileges must be granted separately.');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Sign up error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Global Moto Rentals</h2>
          <p className="mt-2 text-sm text-gray-600">Admin Access</p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 text-center">
              Sign in to Admin Panel
            </h3>
            <p className="mt-1 text-sm text-gray-600 text-center">
              Admin credentials required
            </p>
          </div>

          {error && (
            <Alert 
              variant="error" 
              description={error} 
              className="mb-4"
              dismissible
              onDismiss={() => setError(null)}
            />
          )}

          {message && (
            <Alert 
              variant="success" 
              description={message} 
              className="mb-4"
              dismissible
              onDismiss={() => setMessage(null)}
            />
          )}

          <form className="space-y-6" onSubmit={handleSignIn}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@globalmotorentals.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col space-y-3">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isLoading}
                className="w-full"
                onClick={handleSignUp}
              >
                Create Account
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Admin Access Information</span>
              </div>
            </div>

            <div className="mt-4 text-xs text-gray-500 space-y-1">
              <p>• Admin privileges are granted separately after account creation</p>
              <p>• Contact the system administrator to request admin access</p>
              <p>• Regular user accounts cannot access admin features</p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.push('/')}
            >
              ← Back to Global Moto Rentals
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
} 