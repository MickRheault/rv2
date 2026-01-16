'use client'

import React from 'react'
import Link from 'next/link'
import { BuildingStorefrontIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { generateSlug } from '@/lib/utils'

interface SameModelWidgetProps {
    currentMotorcycleId: string
    count: number
    countryName: string
    brandName?: string
    modelName?: string
}

export default function SameModelWidget({
    currentMotorcycleId,
    count,
    countryName,
    brandName,
    modelName
}: SameModelWidgetProps) {
    if (count <= 0) return null

    // Construct URL: /motorcycle/[country]/[model-slug]
    const countrySlug = generateSlug(countryName)
    const fullModelSlug = generateSlug(`${brandName || ''} ${modelName || ''}`)

    return (
        <Link
            href={`/motorcycle/${countrySlug}/${fullModelSlug}`}
            className="block mt-6 group"
        >
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors duration-200">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                        <BuildingStorefrontIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">
                            {count} more {count === 1 ? 'shop' : 'shops'} offering this model
                        </h3>
                        <p className="text-sm text-gray-600">
                            Compare prices in {countryName}
                        </p>
                    </div>
                </div>
                <ChevronRightIcon className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </div>
        </Link>
    )
}
