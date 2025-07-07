'use client'

import { useState, useEffect } from 'react'
import { CheckIcon, CurrencyDollarIcon, ClockIcon, StarIcon } from '@heroicons/react/24/outline'
import { Button, Input, Select, Textarea, Card, CardContent, Badge, Alert } from '@/components/ui'
import { PremiumPricingService, PremiumListingsService } from '@/services/premium-listings'
import { shopService } from '@/services/shops'
import {
  PremiumUpgradeFormData,
  PremiumPricingPlan,
  PremiumContentType,
  PremiumTier,
  PREMIUM_TIERS,
  PREMIUM_CONTENT_TYPES,
  PREMIUM_DURATION_OPTIONS,
  formatPremiumPrice,
  formatPremiumDuration,
  getPremiumTierColor,
  getPremiumBadgeColor
} from '@/types/premium-listings'

interface RentalShopOption {
  id: string
  provider_name: string
  location_name: string | null
  full_address: string
}

interface PremiumUpgradeFormProps {
  initialData?: Partial<PremiumUpgradeFormData>
  onSubmit: (data: PremiumUpgradeFormData) => void
  onCancel: () => void
  isEditing?: boolean
  loading?: boolean
}

export default function PremiumUpgradeForm({
  initialData,
  onSubmit,
  onCancel,
  isEditing = false,
  loading = false
}: PremiumUpgradeFormProps) {
  const [formData, setFormData] = useState<PremiumUpgradeFormData>({
    content_type: 'rental_shop', // Fixed to rental_shop only
    entity_id: initialData?.entity_id || '',
    premium_tier: initialData?.premium_tier || 'gold',
    duration_days: initialData?.duration_days || 30,
    price_paid: initialData?.price_paid || 0,
    currency: initialData?.currency || 'USD',
    auto_renew: initialData?.auto_renew || false,
    admin_notes: initialData?.admin_notes || ''
  })

  const [pricingPlans, setPricingPlans] = useState<PremiumPricingPlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<PremiumPricingPlan | null>(null)
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [rentalShops, setRentalShops] = useState<RentalShopOption[]>([])
  const [loadingShops, setLoadingShops] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load initial data
  useEffect(() => {
    loadRentalShops()
    loadPricingPlans()
  }, [])

  // Load pricing plans when tier changes
  useEffect(() => {
    loadPricingPlans()
  }, [formData.premium_tier])

  // Update price when plan changes
  useEffect(() => {
    if (selectedPlan) {
      setFormData(prev => ({
        ...prev,
        price_paid: selectedPlan.price,
        duration_days: selectedPlan.duration_days,
        currency: selectedPlan.currency
      }))
    }
  }, [selectedPlan])

  const loadRentalShops = async () => {
    try {
      setLoadingShops(true)
      const shops = await shopService.getAllShopsForDropdown()
      setRentalShops(shops)
    } catch (error) {
      console.error('Error loading rental shops:', error)
    } finally {
      setLoadingShops(false)
    }
  }

  const loadPricingPlans = async () => {
    try {
      setLoadingPlans(true)
      const plans = await PremiumPricingService.getPricingPlansByTier(formData.premium_tier)
      setPricingPlans(plans)
      
      // Auto-select the first plan if available
      if (plans.length > 0) {
        const defaultPlan = plans.find(p => p.duration_days === formData.duration_days) || plans[0]
        setSelectedPlan(defaultPlan)
      }
    } catch (error) {
      console.error('Error loading pricing plans:', error)
    } finally {
      setLoadingPlans(false)
    }
  }

  const handleInputChange = (field: keyof PremiumUpgradeFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handlePlanSelect = (plan: PremiumPricingPlan) => {
    setSelectedPlan(plan)
  }

  const getSelectedShopName = (): string => {
    const selectedShop = rentalShops.find(shop => shop.id === formData.entity_id)
    if (!selectedShop) return 'No shop selected'
    
    return selectedShop.location_name 
      ? `${selectedShop.provider_name} - ${selectedShop.location_name}`
      : selectedShop.provider_name
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.entity_id.trim()) {
      newErrors.entity_id = 'Please select a rental shop'
    }

    if (!formData.premium_tier) {
      newErrors.premium_tier = 'Premium tier is required'
    }

    if (!formData.duration_days || formData.duration_days <= 0) {
      newErrors.duration_days = 'Duration must be greater than 0'
    }

    if (!formData.price_paid || formData.price_paid <= 0) {
      newErrors.price_paid = 'Price must be greater than 0'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    onSubmit(formData)
  }

  const getTierFeatures = (tier: PremiumTier): string[] => {
    const features: Record<PremiumTier, string[]> = {
      gold: [
        'Priority placement in search results',
        'Golden premium badge',
        '50% boost in search ranking',
        'Enhanced listing visibility'
      ],
      platinum: [
        'Top priority placement',
        'Platinum premium badge',
        '75% boost in search ranking',
        'Featured in category pages',
        'Enhanced listing visibility'
      ],
      featured: [
        'Maximum priority placement',
        'Featured premium badge',
        '100% boost in search ranking',
        'Featured in category pages',
        'Homepage featured section',
        'Maximum visibility boost'
      ]
    }
    
    return features[tier] || []
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Select Rental Shop</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rental Shop
              </label>
              {loadingShops ? (
                <div className="py-2 text-sm text-gray-500">Loading rental shops...</div>
              ) : (
                <Select
                  value={formData.entity_id}
                  onChange={(e) => handleInputChange('entity_id', e.target.value)}
                  options={[
                    { value: '', label: 'Select a rental shop...' },
                    ...rentalShops.map(shop => ({
                      value: shop.id,
                      label: shop.location_name 
                        ? `${shop.provider_name} - ${shop.location_name}`
                        : shop.provider_name
                    }))
                  ]}
                  disabled={isEditing}
                />
              )}
              {errors.entity_id && (
                <p className="text-red-500 text-sm mt-1">{errors.entity_id}</p>
              )}
              {formData.entity_id && rentalShops.length > 0 && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                  <strong>Address:</strong> {rentalShops.find(s => s.id === formData.entity_id)?.full_address}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Premium Tier Selection */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Premium Tier Selection</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {PREMIUM_TIERS.map((tier) => (
                <div
                  key={tier.value}
                  className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${
                    formData.premium_tier === tier.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleInputChange('premium_tier', tier.value)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getPremiumBadgeColor(tier.value)}>
                      {tier.label}
                    </Badge>
                    {formData.premium_tier === tier.value && (
                      <CheckIcon className="w-5 h-5 text-blue-500" />
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    {getTierFeatures(tier.value).map((feature, index) => (
                      <div key={index} className="flex items-center text-sm text-gray-600">
                        <CheckIcon className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            {errors.premium_tier && (
              <p className="text-red-500 text-sm mt-1">{errors.premium_tier}</p>
            )}
          </CardContent>
        </Card>

        {/* Pricing Plans */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Pricing Plans</h3>
            
            {loadingPlans ? (
              <div className="text-center py-8">Loading pricing plans...</div>
            ) : pricingPlans.length === 0 ? (
              <Alert>
                No pricing plans available for the selected tier.
              </Alert>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pricingPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${
                      selectedPlan?.id === plan.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handlePlanSelect(plan)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <ClockIcon className="w-5 h-5 text-gray-400 mr-2" />
                        <span className="font-medium">{formatPremiumDuration(plan.duration_days)}</span>
                      </div>
                      {selectedPlan?.id === plan.id && (
                        <CheckIcon className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    
                    <div className="mb-2">
                      <span className="text-2xl font-bold text-gray-900">
                        {formatPremiumPrice(plan.price, plan.currency)}
                      </span>
                      <span className="text-sm text-gray-500 ml-1">
                        / {formatPremiumDuration(plan.duration_days)}
                      </span>
                    </div>
                    
                    {plan.description && (
                      <p className="text-sm text-gray-600">{plan.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custom Pricing */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Custom Pricing (Optional)</h3>
            <p className="text-sm text-gray-600 mb-4">
              Override the default pricing plan with custom values
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (Days)
                </label>
                <Input
                  type="number"
                  value={formData.duration_days}
                  onChange={(e) => handleInputChange('duration_days', parseInt(e.target.value) || 0)}
                  min="1"
                  max="365"
                />
                {errors.duration_days && (
                  <p className="text-red-500 text-sm mt-1">{errors.duration_days}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price
                </label>
                <Input
                  type="number"
                  value={formData.price_paid}
                  onChange={(e) => handleInputChange('price_paid', parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                />
                {errors.price_paid && (
                  <p className="text-red-500 text-sm mt-1">{errors.price_paid}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <Select
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  options={[
                    { value: 'USD', label: 'USD ($)' },
                    { value: 'EUR', label: 'EUR (€)' },
                    { value: 'GBP', label: 'GBP (£)' },
                    { value: 'CAD', label: 'CAD ($)' }
                  ]}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Options */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Additional Options</h3>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="auto_renew"
                  checked={formData.auto_renew}
                  onChange={(e) => handleInputChange('auto_renew', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="auto_renew" className="ml-2 block text-sm text-gray-700">
                  Enable auto-renewal
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Notes
                </label>
                <Textarea
                  value={formData.admin_notes}
                  onChange={(e) => handleInputChange('admin_notes', e.target.value)}
                  placeholder="Add any notes or special instructions..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Summary</h3>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Rental Shop:</span>
                <span className="font-medium">{getSelectedShopName()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Premium Tier:</span>
                <Badge className={getPremiumBadgeColor(formData.premium_tier)}>
                  {formData.premium_tier}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Duration:</span>
                <span className="font-medium">{formatPremiumDuration(formData.duration_days)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Price:</span>
                <span className="font-medium text-lg">
                  {formatPremiumPrice(formData.price_paid || 0, formData.currency)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Auto-renewal:</span>
                <span className="font-medium">{formData.auto_renew ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Processing...' : isEditing ? 'Update Premium Listing' : 'Create Premium Listing'}
          </Button>
        </div>
      </form>
    </div>
  )
} 
 
 
 