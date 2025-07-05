'use client';

import React, { useState } from 'react';
import { FlagIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { FlagContentForm } from './FlagContentForm';
import { ContentType } from '@/types/flagged-content';

interface FlagButtonProps {
  contentType: ContentType;
  entityId: string;
  entityData: Record<string, any>;
  className?: string;
  variant?: 'button' | 'link' | 'icon';
  showLabel?: boolean;
}

export const FlagButton: React.FC<FlagButtonProps> = ({
  contentType,
  entityId,
  entityData,
  className = '',
  variant = 'button',
  showLabel = true
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmitSuccess = () => {
    setIsModalOpen(false);
    // Show success message or notification
    // This could be handled by a toast notification system
  };

  const renderButton = () => {
    const baseClasses = 'inline-flex items-center gap-2 text-sm';
    
    switch (variant) {
      case 'link':
        return (
          <button
            onClick={handleOpenModal}
            className={`${baseClasses} text-gray-600 hover:text-red-600 transition-colors ${className}`}
          >
            <FlagIcon className="h-4 w-4" />
            {showLabel && 'Report Issue'}
          </button>
        );
      
      case 'icon':
        return (
          <button
            onClick={handleOpenModal}
            className={`${baseClasses} p-2 rounded-full text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors ${className}`}
            title="Report Issue"
          >
            <FlagIcon className="h-5 w-5" />
          </button>
        );
      
      default:
        return (
          <Button
            onClick={handleOpenModal}
            variant="outline"
            size="sm"
            className={`${baseClasses} border-gray-300 text-gray-700 hover:border-red-300 hover:text-red-700 hover:bg-red-50 ${className}`}
          >
            <FlagIcon className="h-4 w-4" />
            {showLabel && 'Report Issue'}
          </Button>
        );
    }
  };

  return (
    <>
      {renderButton()}
      
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Report an Issue"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-yellow-800 mb-1">Help us improve our data</p>
              <p className="text-yellow-700">
                If you notice incorrect, outdated, or missing information, please let us know. 
                Our team will review your report and update the information accordingly.
              </p>
            </div>
          </div>
          
          <FlagContentForm
            contentType={contentType}
            entityId={entityId}
            entityData={entityData}
            onSubmit={handleSubmitSuccess}
            onCancel={handleCloseModal}
            isSubmitting={isSubmitting}
            setIsSubmitting={setIsSubmitting}
          />
        </div>
      </Modal>
    </>
  );
};

export default FlagButton; 