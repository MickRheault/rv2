'use client'

import PremiumListingsDashboard from '@/components/admin/PremiumListingsDashboard'
import PremiumUpgradeForm from '@/components/admin/PremiumUpgradeForm'
import PremiumAnalyticsChart from '@/components/admin/PremiumAnalyticsChart'
import { Modal, Alert, Button } from '@/components/ui'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useState, useRef } from 'react'
import { PremiumListingWithDetails, PremiumUpgradeFormData } from '@/types/premium-listings'
import { PremiumListingsService } from '@/services/premium-listings'
import { useAdminAuth } from '@/hooks/useAdminAuth'

function PremiumListingsContent() {
  const { user } = useAdminAuth()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [selectedListing, setSelectedListing] = useState<PremiumListingWithDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const refreshDataRef = useRef<(() => void) | null>(null)

  const handleCreateListing = () => {
    setShowCreateForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleEditListing = (listing: PremiumListingWithDetails) => {
    setSelectedListing(listing)
    setShowEditForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleViewAnalytics = (listing: PremiumListingWithDetails) => {
    setSelectedListing(listing)
    setShowAnalytics(true)
  }

  const handleCloseModals = () => {
    setShowCreateForm(false)
    setShowEditForm(false)
    setShowAnalytics(false)
    setSelectedListing(null)
    setError(null)
    setSuccess(null)
  }

  const handleCreateSubmit = async (data: PremiumUpgradeFormData) => {
    try {
      setLoading(true)
      setError(null)
      
      await PremiumListingsService.createPremiumListing(data, user?.id)
      
      setSuccess('Premium listing created successfully!')
      setTimeout(() => {
        handleCloseModals()
        // Refresh the dashboard data
        if (refreshDataRef.current) {
          refreshDataRef.current()
        }
      }, 1500)
    } catch (error) {
      console.error('Error creating premium listing:', error)
      setError('Failed to create premium listing. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleEditSubmit = async (data: PremiumUpgradeFormData) => {
    if (!selectedListing) return
    
    try {
      setLoading(true)
      setError(null)
      
      // Convert form data to update format
      const now = new Date()
      const endDate = new Date(now.getTime() + (data.duration_days * 24 * 60 * 60 * 1000))
      
      const updateData = {
        premium_tier: data.premium_tier,
        end_date: endDate.toISOString().split('T')[0],
        price_paid: data.price_paid,
        currency: data.currency,
        auto_renew: data.auto_renew,
        admin_notes: data.admin_notes
      }
      
      await PremiumListingsService.updatePremiumListing(selectedListing.id, updateData, user?.id)
      
      setSuccess('Premium listing updated successfully!')
      setTimeout(() => {
        handleCloseModals()
        // Refresh the dashboard data
        if (refreshDataRef.current) {
          refreshDataRef.current()
        }
      }, 1500)
    } catch (error) {
      console.error('Error updating premium listing:', error)
      setError('Failed to update premium listing. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link href="/admin" className="mr-4">
                <Button variant="outline" size="sm">
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Premium Listings</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage premium motorcycle and rental shop listings
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PremiumListingsDashboard 
          onCreateListing={handleCreateListing}
          onEditListing={handleEditListing}
          onRefresh={(refreshFn) => { refreshDataRef.current = refreshFn }}
        />
      </div>

      {/* Create Premium Listing Modal */}
      <Modal
        isOpen={showCreateForm}
        onClose={handleCloseModals}
        title="Create Premium Listing"
        size="lg"
      >
        <div className="space-y-4">
          {error && (
            <Alert variant="error">
              {error}
            </Alert>
          )}
          {success && (
            <Alert variant="success">
              {success}
            </Alert>
          )}
          
          <PremiumUpgradeForm
            onSubmit={handleCreateSubmit}
            onCancel={handleCloseModals}
            loading={loading}
          />
        </div>
      </Modal>

      {/* Edit Premium Listing Modal */}
      <Modal
        isOpen={showEditForm}
        onClose={handleCloseModals}
        title="Edit Premium Listing"
        size="lg"
      >
        <div className="space-y-4">
          {error && (
            <Alert variant="error">
              {error}
            </Alert>
          )}
          {success && (
            <Alert variant="success">
              {success}
            </Alert>
          )}
          
          {selectedListing && (
            <PremiumUpgradeForm
              initialData={{
                content_type: selectedListing.content_type,
                entity_id: selectedListing.entity_id,
                premium_tier: selectedListing.premium_tier,
                duration_days: Math.ceil((new Date(selectedListing.end_date).getTime() - new Date(selectedListing.start_date).getTime()) / (1000 * 60 * 60 * 24)),
                price_paid: selectedListing.price_paid,
                currency: selectedListing.currency,
                auto_renew: selectedListing.auto_renew,
                admin_notes: selectedListing.admin_notes
              }}
              onSubmit={handleEditSubmit}
              onCancel={handleCloseModals}
              isEditing={true}
              loading={loading}
            />
          )}
        </div>
      </Modal>

      {/* Premium Analytics Modal */}
      <Modal
        isOpen={showAnalytics}
        onClose={handleCloseModals}
        title="Premium Listing Analytics"
        size="xl"
      >
        {selectedListing && (
          <PremiumAnalyticsChart
            premiumListingId={selectedListing.id}
          />
        )}
      </Modal>
    </div>
  )
}

export default function PremiumListingsPage() {
  return (
    
      <PremiumListingsContent />
    
  )
} 