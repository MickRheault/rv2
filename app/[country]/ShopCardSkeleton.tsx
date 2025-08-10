export default function ShopCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-pulse">
      {/* Header */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0">
            {/* Shop name skeleton */}
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="flex space-x-2 ml-2">
            {/* Action buttons skeleton */}
            <div className="w-6 h-6 bg-gray-200 rounded"></div>
            <div className="w-6 h-6 bg-gray-200 rounded"></div>
          </div>
        </div>

        {/* Rating skeleton */}
        <div className="flex items-center space-x-2 mb-3">
          <div className="flex space-x-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-4 h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-3 bg-gray-200 rounded w-16"></div>
        </div>

        {/* Location skeleton */}
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-4 h-4 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-40"></div>
        </div>

        {/* Contact info skeleton */}
        <div className="space-y-1 mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-28"></div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-32"></div>
          </div>
        </div>

        {/* Tags skeleton */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="h-5 bg-gray-200 rounded-full w-16"></div>
          <div className="h-5 bg-gray-200 rounded-full w-12"></div>
          <div className="h-5 bg-gray-200 rounded-full w-20"></div>
        </div>

        {/* Services skeleton */}
        <div className="space-y-2 mb-4">
          <div className="h-3 bg-gray-200 rounded w-16"></div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-32"></div>
          </div>
        </div>

        {/* Inclusions skeleton */}
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-16"></div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
            <div className="h-3 bg-gray-200 rounded w-28"></div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
            <div className="h-3 bg-gray-200 rounded w-36"></div>
          </div>
        </div>
      </div>

      {/* Footer buttons skeleton */}
      <div className="p-4 pt-0">
        <div className="flex w-full gap-2">
          <div className="h-8 bg-gray-200 rounded flex-1"></div>
          <div className="h-8 bg-gray-200 rounded flex-1"></div>
        </div>
      </div>
    </div>
  )
}