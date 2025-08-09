'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FlagIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  EyeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import Checkbox from '@/components/ui/Checkbox';
import { 
  FlaggedContentWithChanges, 
  FlaggedContentStats, 
  FlagStatus, 
  ContentType,
  getStatusColor,
  getPriorityColor,
  getFlagCategoryLabel,
  getFlagStatusLabel 
} from '@/types/flagged-content';
import { FlaggedContentService, FlaggedContentUtils } from '@/services/flagged-content';

interface FlaggedContentDashboardProps {
  initialStats?: FlaggedContentStats;
}

export const FlaggedContentDashboard: React.FC<FlaggedContentDashboardProps> = ({
  initialStats
}) => {
  const [flaggedContent, setFlaggedContent] = useState<FlaggedContentWithChanges[]>([]);
  const [stats, setStats] = useState<FlaggedContentStats | null>(initialStats || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FlagStatus | ''>('');
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentType | ''>('');
  const [selectedFlag, setSelectedFlag] = useState<FlaggedContentWithChanges | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | ''>('');
  const [bulkActionNotes, setBulkActionNotes] = useState('');
  const [showBulkActionModal, setShowBulkActionModal] = useState(false);

  const itemsPerPage = 20;

  // Load flagged content and stats
  const loadFlaggedContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const data = await FlaggedContentService.getFlaggedContent(
        statusFilter || undefined,
        contentTypeFilter || undefined,
        itemsPerPage,
        offset
      );
      
      setFlaggedContent(data);
      setTotalPages(Math.ceil(data.length / itemsPerPage));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flagged content');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, contentTypeFilter]);

  const loadStats = useCallback(async () => {
    try {
      const statsData = await FlaggedContentService.getFlaggedContentStats();
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  useEffect(() => {
    loadFlaggedContent();
    loadStats();
  }, [loadFlaggedContent, loadStats]);

  const handleStatusUpdate = async (id: string, status: FlagStatus, notes?: string) => {
    try {
      await FlaggedContentService.updateFlaggedContent(id, { status, admin_notes: notes });
      await loadFlaggedContent();
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleApplyChanges = async (id: string) => {
    try {
      const success = await FlaggedContentService.applyFlaggedContentChanges(id);
      if (success) {
        await loadFlaggedContent();
        await loadStats();
      } else {
        setError('Failed to apply changes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply changes');
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedItems.size === 0) return;

    try {
      await FlaggedContentService.bulkUpdateStatus(
        Array.from(selectedItems),
        bulkAction === 'approve' ? 'approved' : 'rejected',
        bulkActionNotes
      );
      
      setSelectedItems(new Set());
      setBulkAction('');
      setBulkActionNotes('');
      setShowBulkActionModal(false);
      await loadFlaggedContent();
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform bulk action');
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      await loadFlaggedContent();
      return;
    }

    try {
      const results = await FlaggedContentService.searchFlaggedContent(
        searchTerm,
        statusFilter || undefined,
        contentTypeFilter || undefined
      );
      setFlaggedContent(results.map(item => ({ ...item, changes: [] })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search');
    }
  };

  const toggleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === flaggedContent.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(flaggedContent.map(item => item.id)));
    }
  };

  const openDiffModal = (flag: FlaggedContentWithChanges) => {
    setSelectedFlag(flag);
    setShowDiffModal(true);
  };

  const renderStatsCards = () => {
    if (!stats) return null;

    const cards = [
      { title: 'Pending Review', value: stats.total_pending, color: 'bg-yellow-500' },
      { title: 'Under Review', value: stats.total_under_review, color: 'bg-blue-500' },
      { title: 'Approved', value: stats.total_approved, color: 'bg-green-500' },
      { title: 'Applied', value: stats.total_applied, color: 'bg-purple-500' },
      { title: 'Critical Issues', value: stats.critical_pending, color: 'bg-red-500' },
      { title: 'Motorcycle Flags', value: stats.motorcycle_flags, color: 'bg-gray-500' },
      { title: 'Shop Flags', value: stats.rental_shop_flags, color: 'bg-gray-500' },
      { title: 'Rejected', value: stats.total_rejected, color: 'bg-gray-400' }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((card, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${card.color} mr-3`} />
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderFilters = () => (
    <div className="flex flex-wrap gap-4 mb-6">
      <div className="flex-1 min-w-[200px]">
        <Input
          type="text"
          placeholder="Search flagged content..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="w-full"
        />
      </div>
      
      <Select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as FlagStatus)}
        options={[
          { value: '', label: 'All Statuses' },
          { value: 'pending', label: 'Pending' },
          { value: 'under_review', label: 'Under Review' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'applied', label: 'Applied' }
        ]}
        className="w-40"
      />
      
      <Select
        value={contentTypeFilter}
        onChange={(e) => setContentTypeFilter(e.target.value as ContentType)}
        options={[
          { value: '', label: 'All Types' },
          { value: 'motorcycle', label: 'Motorcycles' },
          { value: 'rental_shop', label: 'Rental Shops' }
        ]}
        className="w-40"
      />
      
      <Button variant="secondary" onClick={handleSearch}>
        <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
        Search
      </Button>
    </div>
  );

  const renderBulkActions = () => (
    <div className="flex items-center gap-4 mb-4">
      <Checkbox
        checked={selectedItems.size === flaggedContent.length && flaggedContent.length > 0}
        onChange={toggleSelectAll}
        label="Select All"
      />
      
      {selectedItems.size > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {selectedItems.size} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setBulkAction('approve');
              setShowBulkActionModal(true);
            }}
          >
            Approve Selected
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setBulkAction('reject');
              setShowBulkActionModal(true);
            }}
          >
            Reject Selected
          </Button>
        </div>
      )}
    </div>
  );

  const renderFlaggedContentTable = () => (
    <div className="bg-white rounded-lg shadow">
      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                Select
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">
                Type & ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[160px]">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                Priority
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                Created
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {flaggedContent.map((flag) => (
              <tr key={flag.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap">
                  <Checkbox
                    checked={selectedItems.has(flag.id)}
                    onChange={() => toggleSelectItem(flag.id)}
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {flag.content_type}
                  </div>
                  <div className="text-sm text-gray-500">
                    {flag.entity_id.substring(0, 8)}...
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {getFlagCategoryLabel(flag.flag_category)}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <Badge className={getStatusColor(flag.status)}>
                    {getFlagStatusLabel(flag.status)}
                  </Badge>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <Badge className={getPriorityColor(flag.priority || 2)}>
                    Priority {flag.priority || 2}
                  </Badge>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {flag.created_at ? new Date(flag.created_at).toLocaleDateString() : 'Unknown'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDiffModal(flag)}
                    >
                      <EyeIcon className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    
                    {flag.status === 'pending' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStatusUpdate(flag.id, 'approved')}
                        >
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStatusUpdate(flag.id, 'rejected')}
                        >
                          <XCircleIcon className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    
                    {flag.status === 'approved' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleApplyChanges(flag.id)}
                      >
                        Apply Changes
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden">
        {flaggedContent.map((flag) => (
          <div key={flag.id} className="border-b border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedItems.has(flag.id)}
                  onChange={() => toggleSelectItem(flag.id)}
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {flag.content_type}
                  </div>
                  <div className="text-xs text-gray-500">
                    {flag.entity_id.substring(0, 8)}...
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(flag.status)}>
                  {getFlagStatusLabel(flag.status)}
                </Badge>
                <Badge className={getPriorityColor(flag.priority || 2)}>
                  P{flag.priority || 2}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2 mb-3">
              <div className="text-sm">
                <span className="font-medium text-gray-700">Category:</span>{' '}
                {getFlagCategoryLabel(flag.flag_category)}
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-700">Created:</span>{' '}
                {flag.created_at ? new Date(flag.created_at).toLocaleDateString() : 'Unknown'}
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openDiffModal(flag)}
              >
                <EyeIcon className="h-4 w-4 mr-1" />
                View
              </Button>
              
              {flag.status === 'pending' && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusUpdate(flag.id, 'approved')}
                  >
                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusUpdate(flag.id, 'rejected')}
                  >
                    <XCircleIcon className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </>
              )}
              
              {flag.status === 'approved' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleApplyChanges(flag.id)}
                >
                  Apply Changes
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPagination = () => (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
      <div className="flex items-center">
        <p className="text-sm text-gray-700">
          Showing page {currentPage} of {totalPages}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderDiffModal = () => (
    <Modal
      isOpen={showDiffModal}
      onClose={() => setShowDiffModal(false)}
      title="Review Flagged Content"
      size="xl"
    >
      {selectedFlag && (
        <div className="space-y-6">
          {/* Flag Details Section */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Flag Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Category:</span> {getFlagCategoryLabel(selectedFlag.flag_category)}
              </div>
              <div>
                <span className="font-medium">Priority:</span> {selectedFlag.priority}
              </div>
              <div>
                <span className="font-medium">Status:</span> {getFlagStatusLabel(selectedFlag.status)}
              </div>
              <div>
                <span className="font-medium">Created:</span> {selectedFlag.created_at ? new Date(selectedFlag.created_at).toLocaleDateString() : 'Unknown'}
              </div>
            </div>
            <div className="mt-4">
              <span className="font-medium">Reason:</span>
              <p className="mt-1 text-gray-700">{selectedFlag.flag_reason}</p>
            </div>
          </div>

          {/* Proposed Changes Section */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-4">Proposed Changes</h3>
            <div className="space-y-4">
              {(selectedFlag.proposed_data && typeof selectedFlag.proposed_data === 'object' && !Array.isArray(selectedFlag.proposed_data)) ? 
                Object.entries(selectedFlag.proposed_data as Record<string, any>).map(([key, value]) => {
                  const originalData = selectedFlag.original_data && typeof selectedFlag.original_data === 'object' && !Array.isArray(selectedFlag.original_data) 
                    ? selectedFlag.original_data as Record<string, any> 
                    : {};
                  const originalValue = originalData[key];
                  const isDifferent = originalValue !== value;
                
                return (
                  <div key={key} className={`p-3 rounded-lg ${isDifferent ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                    <div className="font-medium text-sm text-gray-900 mb-2">
                      {FlaggedContentUtils.getFieldDisplayName(key)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-red-600">Original:</span>
                        <div className="mt-1 p-2 bg-red-50 rounded text-gray-700 break-words">
                          {FlaggedContentUtils.formatFieldValue(originalValue)}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-green-600">Proposed:</span>
                        <div className="mt-1 p-2 bg-green-50 rounded text-gray-700 break-words">
                          {FlaggedContentUtils.formatFieldValue(value)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-gray-500">No data available to compare</p>
              )}
            </div>
          </div>

          {/* Action Buttons Section */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowDiffModal(false)}>
              Close
            </Button>
            {selectedFlag.status === 'pending' && (
              <>
                <Button
                  variant="danger"
                  onClick={() => {
                    handleStatusUpdate(selectedFlag.id, 'rejected');
                    setShowDiffModal(false);
                  }}
                >
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    handleStatusUpdate(selectedFlag.id, 'approved');
                    setShowDiffModal(false);
                  }}
                >
                  Approve
                </Button>
              </>
            )}
            {selectedFlag.status === 'approved' && (
              <Button
                onClick={() => {
                  handleApplyChanges(selectedFlag.id);
                  setShowDiffModal(false);
                }}
              >
                Apply Changes
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6 flex items-center">
        <Link href="/admin" className="mr-4">
          <Button variant="outline" size="sm">
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Flagged Content Dashboard</h1>
          <p className="text-gray-600">Review and manage user-reported content issues</p>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {renderStatsCards()}
      {renderFilters()}
      {renderBulkActions()}
      
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {renderFlaggedContentTable()}
          {renderPagination()}
        </>
      )}

      {renderDiffModal()}

      {/* Bulk Action Modal */}
      <Modal
        isOpen={showBulkActionModal}
        onClose={() => setShowBulkActionModal(false)}
        title={`Bulk ${bulkAction === 'approve' ? 'Approve' : 'Reject'} Items`}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to {bulkAction} {selectedItems.size} items?
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={bulkActionNotes}
              onChange={(e) => setBulkActionNotes(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Add notes for this bulk action..."
            />
          </div>
          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={() => setShowBulkActionModal(false)}>
              Cancel
            </Button>
            <Button
              variant={bulkAction === 'approve' ? 'primary' : 'danger'}
              onClick={handleBulkAction}
            >
              {bulkAction === 'approve' ? 'Approve' : 'Reject'} Selected
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FlaggedContentDashboard; 