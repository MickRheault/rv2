'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button, Input, Card, Alert } from '@/components/ui';
import Image from 'next/image';

export default function SetupPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  
  const router = useRouter();

  // Check if user is authenticated and needs to set password
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // No authenticated user, redirect to login
        router.push('/admin/login');
        return;
      }

      setUser(user);
      
      // Check if user already has a password set
      // Users invited via email typically need to set a password
      if (user.email_confirmed_at && user.user_metadata?.password_set) {
        // User already has password, redirect appropriately
        router.push('/');
        return;
      }
    };

    checkAuth();
  }, [router]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    // Validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      // Update the user's password
      const { data, error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.user) {
        setMessage('Password set successfully! You can now sign in.');
        
        // Mark password as set in user metadata
        await supabase.auth.updateUser({
          data: { password_set: true }
        });
        
        // Redirect after success
        setTimeout(() => {
          router.push('/admin/login?message=Password set successfully! Please sign in.');
        }, 2000);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Password setup error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const validatePassword = (pwd: string) => {
    const minLength = pwd.length >= 6;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    
    return {
      minLength,
      hasUpper,
      hasLower,
      hasNumber,
      isStrong: minLength && hasUpper && hasLower && hasNumber
    };
  };

  const passwordStrength = validatePassword(password);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

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
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Set Your Password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Complete your account setup by creating a secure password
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="mb-6">
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Account:</strong> {user.email}</p>
              <p><strong>Status:</strong> Invitation accepted</p>
            </div>
          </div>

          {error && (
            <Alert variant="error" className="mb-6">
              {error}
            </Alert>
          )}

          {message && (
            <Alert variant="success" className="mb-6">
              {message}
            </Alert>
          )}

          <form onSubmit={handleSetPassword} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <div className="mt-1">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
              
              {password && (
                <div className="mt-2 text-xs space-y-1">
                  <div className={`${passwordStrength.minLength ? 'text-green-600' : 'text-red-600'}`}>
                    ✓ At least 6 characters
                  </div>
                  <div className={`${passwordStrength.hasUpper ? 'text-green-600' : 'text-gray-400'}`}>
                    {passwordStrength.hasUpper ? '✓' : '○'} Uppercase letter
                  </div>
                  <div className={`${passwordStrength.hasLower ? 'text-green-600' : 'text-gray-400'}`}>
                    {passwordStrength.hasLower ? '✓' : '○'} Lowercase letter
                  </div>
                  <div className={`${passwordStrength.hasNumber ? 'text-green-600' : 'text-gray-400'}`}>
                    {passwordStrength.hasNumber ? '✓' : '○'} Number
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <div className="mt-1">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                />
              </div>
              
              {confirmPassword && (
                <div className="mt-1 text-xs">
                  <div className={`${password === confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                    {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </div>
                </div>
              )}
            </div>

            <div>
              <Button
                type="submit"
                loading={isLoading}
                disabled={!passwordStrength.minLength || password !== confirmPassword}
                className="w-full"
              >
                Set Password
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="text-center text-sm text-gray-600">
              Need help?{' '}
              <Link href="/contact" className="font-medium text-blue-600 hover:text-blue-500">
                Contact Support
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}