import { Metadata } from 'next';
import { AdminRoute } from '@/components/admin/AdminRoute';
import { FlaggedContentDashboard } from '@/components/admin/FlaggedContentDashboard';

export const metadata: Metadata = {
  title: 'Flagged Content Management | RideVault Admin',
  description: 'Review and manage user-reported content issues'
};

export default function FlaggedContentPage() {
  return (
    <AdminRoute requiredPermission="content.moderate">
      <FlaggedContentDashboard />
    </AdminRoute>
  );
} 