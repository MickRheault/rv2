'use client';

import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function AdminUnauthorizedPage() {
  const router = useRouter();
  const { user, signOut } = useAdminAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-sm text-gray-600">
            Insufficient admin permissions
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Permission Required
            </h3>
            
            <div className="text-sm text-gray-600 mb-6 space-y-2">
              <p>You don't have the required permissions to access this admin area.</p>
              
              {user ? (
                <div className="mt-4 p-3 bg-gray-50 rounded-md text-left">
                  <p className="font-medium text-gray-700">Current Account:</p>
                  <p className="text-gray-600">{user.email}</p>
                  <p className="text-gray-600">Role: {user.role}</p>
                  {user.permissions.length > 0 && (
                    <p className="text-gray-600">
                      Permissions: {user.permissions.join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                <p>You are not currently signed in as an admin.</p>
              )}
            </div>

            <div className="space-y-3">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => router.push('/admin')}
              >
                Go to Admin Dashboard
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => router.push('/')}
              >
                Return to RideVault
              </Button>

              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={signOut}
                >
                  Sign Out
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Need Help?</span>
              </div>
            </div>

            <div className="mt-4 text-xs text-gray-500 space-y-1">
              <p>• Contact your system administrator to request access</p>
              <p>• Ensure you're signed in with the correct admin account</p>
              <p>• Some areas require specific permissions beyond basic admin access</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
} 