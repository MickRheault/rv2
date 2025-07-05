'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Alert from '@/components/ui/Alert';
import { 
  ContentType, 
  FlagCategory, 
  CreateFlaggedContentData, 
  FLAG_CATEGORIES, 
  validateFlaggedContent 
} from '@/types/flagged-content';
import { FlaggedContentService, FlaggedContentUtils } from '@/services/flagged-content';

interface FlagContentFormProps {
  contentType: ContentType;
  entityId: string;
  entityData: Record<string, any>;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
}

export const FlagContentForm: React.FC<FlagContentFormProps> = ({
  contentType,
  entityId,
  entityData,
  onSubmit,
  onCancel,
  isSubmitting,
  setIsSubmitting
}) => {
  const [formData, setFormData] = useState<CreateFlaggedContentData>({
    content_type: contentType,
    entity_id: entityId,
    flag_category: 'incorrect_info',
    flag_reason: '',
    proposed_data: {},
    flagged_by_email: '',
    priority: 2
  });

  const [editableFields, setEditableFields] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  // Initialize editable fields from entity data
  useEffect(() => {
    const fieldsToEdit = getEditableFields(entityData, contentType);
    setEditableFields(fieldsToEdit);
  }, [entityData, contentType]);

  // Get editable fields based on content type
  const getEditableFields = (data: Record<string, any>, type: ContentType): Record<string, any> => {
    const filtered: Record<string, any> = {};
    
    if (type === 'motorcycle') {
      // Extract only editable motorcycle fields
      const motorcycleFields = [
        'model',
        'year',
        'engine_capacity_cc',
        'rental_rate_per_day',
        'rental_rate_currency',
        'availability_status'
      ];
      
      motorcycleFields.forEach(field => {
        if (data[field] !== null && data[field] !== undefined) {
          filtered[field] = data[field];
        }
      });
      
      // Add brand name if available
      if (data.brands?.name) {
        filtered.brand_name = data.brands.name;
      }
      
      // Add category name if available
      if (data.categories?.name) {
        filtered.category_name = data.categories.name;
      }
      
    } else if (type === 'rental_shop') {
      // Extract only editable rental shop fields
      const shopFields = [
        'provider_name',
        'full_address',
        'phone',
        'website',
        'business_description',
        'rating',
        'google_maps_url'
      ];
      
      shopFields.forEach(field => {
        if (data[field] !== null && data[field] !== undefined) {
          filtered[field] = data[field];
        }
      });
      
      // Add location information if available
      if (data.cities?.name) {
        filtered.city_name = data.cities.name;
      }
      if (data.cities?.provinces?.name) {
        filtered.province_name = data.cities.provinces.name;
      }
      if (data.cities?.provinces?.countries?.name) {
        filtered.country_name = data.cities.provinces.countries.name;
      }
    }
    
    return filtered;
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setEditableFields(prev => ({
      ...prev,
      [fieldName]: value
    }));
    
    // Update proposed data with changes
    setFormData(prev => {
      const currentProposedData = prev.proposed_data && typeof prev.proposed_data === 'object' && !Array.isArray(prev.proposed_data)
        ? prev.proposed_data as Record<string, any>
        : {};
      
      return {
        ...prev,
        proposed_data: {
          ...currentProposedData,
          [fieldName]: value
        }
      };
    });
  };

  const handleInputChange = (field: keyof CreateFlaggedContentData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    try {
      // Validate form data
      const validationErrors = validateFlaggedContent(formData);
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        setIsSubmitting(false);
        return;
      }

      // Create the flagged content
      await FlaggedContentService.createFlaggedContent(formData, entityData);
      
      setShowSuccess(true);
      setTimeout(() => {
        onSubmit();
      }, 2000);
    } catch (error) {
      console.error('Error submitting flagged content:', error);
      setErrors([error instanceof Error ? error.message : 'An error occurred']);
      setIsSubmitting(false);
    }
  };

  const renderFieldEditor = (fieldName: string, value: any) => {
    const displayName = FlaggedContentUtils.getFieldDisplayName(fieldName);
    const isCritical = FlaggedContentUtils.isCriticalField(fieldName);
    
    // Determine input type based on field name and value
    const getInputType = () => {
      if (fieldName.includes('email')) return 'email';
      if (fieldName.includes('phone')) return 'tel';
      if (fieldName.includes('url') || fieldName.includes('website')) return 'url';
      if (typeof value === 'number') return 'number';
      return 'text';
    };

    const isTextArea = fieldName.includes('description') || fieldName.includes('notes') || fieldName.includes('reason');
    const inputType = getInputType();

    return (
      <div key={fieldName} className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {displayName}
          {isCritical && <span className="text-red-500 ml-1">*</span>}
        </label>
        
        {isTextArea ? (
          <Textarea
            value={editableFields[fieldName] || ''}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            placeholder={`Enter ${displayName.toLowerCase()}`}
            rows={3}
            className="w-full"
          />
        ) : (
          <Input
            type={inputType}
            value={editableFields[fieldName] || ''}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            placeholder={`Enter ${displayName.toLowerCase()}`}
            className="w-full"
          />
        )}
        
        {value && (
          <p className="text-xs text-gray-500">
            Current: {FlaggedContentUtils.formatFieldValue(value)}
          </p>
        )}
      </div>
    );
  };

  if (showSuccess) {
    return (
      <div className="text-center py-8">
        <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Thank you for your report!</h3>
        <p className="text-gray-600">
          Your report has been submitted successfully. Our team will review it and update the information accordingly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error display */}
      {errors.length > 0 && (
        <Alert variant="error" className="mb-4">
          <div className="flex items-start">
            <XCircleIcon className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Please fix the following errors:</p>
              <ul className="mt-1 list-disc list-inside text-sm">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </Alert>
      )}

      {/* Flag category selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          What type of issue are you reporting?
        </label>
        <Select
          value={formData.flag_category}
          onChange={(e) => handleInputChange('flag_category', e.target.value as FlagCategory)}
          options={FLAG_CATEGORIES}
          className="w-full"
        />
      </div>

      {/* Flag reason */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Please describe the issue in detail
        </label>
        <Textarea
          value={formData.flag_reason}
          onChange={(e) => handleInputChange('flag_reason', e.target.value)}
          placeholder="Describe what's wrong and what it should be..."
          rows={4}
          className="w-full"
          required
        />
      </div>

      {/* Editable fields */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-4">
          Correct the information below (only edit fields that need changes)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(editableFields).map(([fieldName, value]) => 
            renderFieldEditor(fieldName, value)
          )}
        </div>
      </div>

      {/* Contact email for anonymous users */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email address (optional)
        </label>
        <Input
          type="email"
          value={formData.flagged_by_email || ''}
          onChange={(e) => handleInputChange('flagged_by_email', e.target.value)}
          placeholder="your.email@example.com"
          className="w-full"
        />
        <p className="text-xs text-gray-500 mt-1">
          We'll use this to contact you if we need clarification about your report.
        </p>
      </div>

      {/* Priority selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Priority Level
        </label>
        <Select
          value={formData.priority?.toString() || '2'}
          onChange={(e) => handleInputChange('priority', parseInt(e.target.value))}
          options={[
            { value: '1', label: 'Low - Minor issue' },
            { value: '2', label: 'Normal - Standard issue' },
            { value: '3', label: 'Medium - Important issue' },
            { value: '4', label: 'High - Critical issue' },
            { value: '5', label: 'Critical - Urgent issue' }
          ]}
          className="w-full"
        />
      </div>

      {/* Action buttons */}
      <div className="flex justify-end space-x-3 pt-6 border-t">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Submit Report
        </Button>
      </div>
    </form>
  );
};

export default FlagContentForm; 