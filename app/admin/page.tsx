'use client';

import { AdminRoute } from '@/components/admin/AdminRoute';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Card, Button } from '@/components/ui';
import { 
  ChartBarIcon, 
  ExclamationTriangleIcon, 
  StarIcon, 
  CogIcon,
  UsersIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';

function AdminDashboardContent() {
  const { user, signOut } = useAdminAuth();

  const stats = [
    {
      name: 'Total Motorcycles',
      value: '1,247',
      icon: ChartBarIcon,
      color: 'bg-blue-500',
      href: '/admin/motorcycles'
    },
    {
      name: 'Total Shops',
      value: '89',
      icon: BuildingOfficeIcon,
      color: 'bg-green-500',
      href: '/admin/shops'
    },
    {
      name: 'Premium Listings',
      value: '156',
      icon: StarIcon,
      color: 'bg-yellow-500',
      href: '/admin/premium-listings'
    },
    {
      name: 'Flagged Content',
      value: '12',
      icon: ExclamationTriangleIcon,
      color: 'bg-red-500',
      href: '/admin/flagged-content'
    }
  ];

  const quickActions = [
    {
      name: 'Content Moderation',
      description: 'Review flagged content and manage reports',
      icon: ExclamationTriangleIcon,
      href: '/admin/flagged-content',
      permission: 'content.moderate',
      color: 'border-red-200 hover:border-red-300'
    },
    {
      name: 'Premium Management',
      description: 'Manage premium listings and pricing',
      icon: StarIcon,
      href: '/admin/premium-listings',
      permission: 'premium.manage',
      color: 'border-yellow-200 hover:border-yellow-300'
    },
    {
      name: 'Analytics Dashboard',
      description: 'View platform metrics and insights',
      icon: ChartBarIcon,
      href: '/admin/analytics',
      permission: 'analytics.view',
      color: 'border-blue-200 hover:border-blue-300'
    },
    {
      name: 'System Settings',
      description: 'Configure platform settings',
      icon: CogIcon,
      href: '/admin/settings',
      permission: 'system.manage',
      color: 'border-gray-200 hover:border-gray-300'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="mt-1 text-sm text-gray-600">
                Welcome back, {user?.email}
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={signOut}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Stats */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Platform Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <Card key={stat.name} className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-center">
                  <div className={`flex-shrink-0 p-3 rounded-lg ${stat.color}`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                    <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {quickActions.map((action) => (
              <Card 
                key={action.name} 
                className={`p-6 border-2 transition-all cursor-pointer hover:shadow-lg ${action.color}`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <action.icon className="h-8 w-8 text-gray-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">{action.name}</h3>
                    <p className="mt-1 text-sm text-gray-600">{action.description}</p>
                    <div className="mt-3">
                      <Button variant="outline" size="sm">
                        Access →
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
          <Card className="p-6">
            <div className="text-center py-12">
              <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No recent activity</h3>
              <p className="mt-1 text-sm text-gray-500">
                Activity tracking will be implemented in future updates.
              </p>
            </div>
          </Card>
        </div>

        {/* Debug Information */}
        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Admin Debug Info</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <p><strong>User ID:</strong> {user?.id}</p>
            <p><strong>Role:</strong> {user?.role}</p>
            <p><strong>Permissions:</strong> {user?.permissions.join(', ')}</p>
            <p><strong>Created:</strong> {user?.created_at}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <AdminRoute requiredPermission="system.manage">
      <AdminDashboardContent />
    </AdminRoute>
  );
} 