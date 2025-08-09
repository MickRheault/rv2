'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  XMarkIcon, 
  MagnifyingGlassPlusIcon 
} from '@heroicons/react/24/outline'
import { Modal } from '@/components/ui'

interface MotorcycleImage {
  id: string
  url: string
  alt_text: string | null
}

interface MotorcycleGalleryProps {
  images: MotorcycleImage[]
  motorcycleName: string
}

function MotorcycleGalleryInner({ images, motorcycleName }: MotorcycleGalleryProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [translateX, setTranslateX] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const thumbnailsRef = useRef<HTMLDivElement>(null)

  const currentImage = images[currentImageIndex]
  const hasMultipleImages = images.length > 1

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const goToImage = (index: number) => {
    setCurrentImageIndex(index)
  }

  // Touch and mouse drag handlers
  const handleStart = (clientX: number) => {
    setIsDragging(true)
    setStartX(clientX)
    setTranslateX(0)
  }

  const handleMove = (clientX: number) => {
    if (!isDragging) return
    
    const diff = clientX - startX
    setTranslateX(diff)
  }

  const handleEnd = () => {
    if (!isDragging) return
    
    const threshold = 50
    if (Math.abs(translateX) > threshold) {
      if (translateX > 0) {
        prevImage()
      } else {
        nextImage()
      }
    }
    
    setIsDragging(false)
    setTranslateX(0)
  }

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!hasMultipleImages) return
    e.preventDefault()
    handleStart(e.clientX)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!hasMultipleImages) return
    handleMove(e.clientX)
  }

  const handleMouseUp = () => {
    if (!hasMultipleImages) return
    handleEnd()
  }

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasMultipleImages) return
    handleStart(e.touches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!hasMultipleImages) return
    handleMove(e.touches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!hasMultipleImages) return
    handleEnd()
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasMultipleImages) return
      
      if (e.key === 'ArrowLeft') {
        prevImage()
      } else if (e.key === 'ArrowRight') {
        nextImage()
      } else if (e.key === 'Escape' && isZoomModalOpen) {
        setIsZoomModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasMultipleImages, isZoomModalOpen])

  // Auto-scroll thumbnails to keep current image visible
  useEffect(() => {
    if (thumbnailsRef.current && hasMultipleImages) {
      const thumbnail = thumbnailsRef.current.children[currentImageIndex] as HTMLElement
      if (thumbnail) {
        thumbnail.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        })
      }
    }
  }, [currentImageIndex, hasMultipleImages])

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div 
        ref={containerRef}
        className="relative bg-gray-100 rounded-lg overflow-hidden group select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="aspect-[4/3] relative">
          <div 
            className={`w-full h-full transition-transform duration-200 ${
              isDragging ? 'cursor-grabbing' : hasMultipleImages ? 'cursor-grab' : 'cursor-pointer'
            }`}
            style={{ 
              transform: `translateX(${translateX}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out'
            }}
            onClick={() => !isDragging && setIsZoomModalOpen(true)}
          >
          <Image
            src={currentImage.url}
            alt={currentImage.alt_text || `${motorcycleName} - Image ${currentImageIndex + 1}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={currentImageIndex === 0}
              draggable={false}
          />
          </div>
          
          {/* Zoom button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsZoomModalOpen(true)
            }}
            className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="Zoom image"
          >
            <MagnifyingGlassPlusIcon className="w-5 h-5" />
          </button>

          {/* Navigation arrows for desktop */}
          {hasMultipleImages && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  prevImage()
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 hidden sm:block"
                aria-label="Previous image"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  nextImage()
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 hidden sm:block"
                aria-label="Next image"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Image counter */}
          {hasMultipleImages && (
            <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
              {currentImageIndex + 1} / {images.length}
            </div>
          )}

          {/* Swipe indicator for mobile */}
          {hasMultipleImages && (
            <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-xs sm:hidden">
              Swipe
            </div>
          )}
        </div>
      </div>

      {/* Thumbnail strip for multiple images */}
      {hasMultipleImages && (
        <div className="relative">
          <div 
            ref={thumbnailsRef}
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => goToImage(index)}
                className={`relative flex-shrink-0 w-20 h-16 rounded border-2 overflow-hidden transition-all snap-start ${
                index === currentImageIndex 
                  ? 'border-blue-500 ring-2 ring-blue-200' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Image
                src={image.url}
                alt={image.alt_text || `${motorcycleName} thumbnail ${index + 1}`}
                fill
                className="object-cover"
                sizes="80px"
              />
            </button>
          ))}
          </div>
        </div>
      )}

      {/* Zoom Modal */}
      <Modal isOpen={isZoomModalOpen} onClose={() => setIsZoomModalOpen(false)}>
        <div className="relative max-w-4xl max-h-[90vh] mx-auto">
          <button
            onClick={() => setIsZoomModalOpen(false)}
            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
            aria-label="Close zoom"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
          
          <div className="relative">
            <Image
              src={currentImage.url}
              alt={currentImage.alt_text || `${motorcycleName} - Zoomed view`}
              width={1200}
              height={900}
              className="max-w-full max-h-[90vh] object-contain"
            />
            
            {/* Navigation in modal */}
            {hasMultipleImages && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full"
                  aria-label="Previous image"
                >
                  <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full"
                  aria-label="Next image"
                >
                  <ChevronRightIcon className="w-6 h-6" />
                </button>
                
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full">
                  {currentImageIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function MotorcycleGallery({ images, motorcycleName }: MotorcycleGalleryProps) {
  const hasImages = Array.isArray(images) && images.length > 0
  if (!hasImages) {
    return (
      <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="w-24 h-24 mx-auto mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p>No images available</p>
        </div>
      </div>
    )
  }
  return <MotorcycleGalleryInner images={images} motorcycleName={motorcycleName} />
}