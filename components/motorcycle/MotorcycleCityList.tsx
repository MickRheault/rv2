'use client'

import React from 'react'
import { MotorcycleWithDetails } from '@/services/motorcycles'
import MotorcycleTable from './MotorcycleTable'
import { MapPinIcon } from '@heroicons/react/24/outline'

interface MotorcycleCityListProps {
    motorcycles: MotorcycleWithDetails[]
}

export default function MotorcycleCityList({ motorcycles }: MotorcycleCityListProps) {
    // Group motorcycles by city
    const groupedByCity = motorcycles.reduce((acc, motorcycle) => {
        const cityName = motorcycle.rental_shops?.cities?.name || 'Unknown City'
        if (!acc[cityName]) {
            acc[cityName] = []
        }
        acc[cityName].push(motorcycle)
        return acc
    }, {} as Record<string, MotorcycleWithDetails[]>)

    // Sort cities alphabetically
    const sortedCities = Object.keys(groupedByCity).sort()

    if (sortedCities.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                No motorcycles found.
            </div>
        )
    }

    return (
        <div className="space-y-12">
            {sortedCities.map((city) => (
                <section key={city} className="scroll-mt-20" id={`city-${city.toLowerCase().replace(/\s+/g, '-')}`}>
                    <div className="flex items-center gap-2 mb-4 border-b border-gray-200 pb-2">
                        <MapPinIcon className="w-6 h-6 text-gray-400" />
                        <h2 className="text-2xl font-bold text-gray-900">
                            {city}
                        </h2>
                        <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {groupedByCity[city].length}
                        </span>
                    </div>

                    <MotorcycleTable
                        motorcycles={groupedByCity[city]}
                        showShopColumn={true}
                        title={`${groupedByCity[city].length} ${groupedByCity[city].length === 1 ? 'bike' : 'bikes'} available in ${city}`}
                    />
                </section>
            ))}
        </div>
    )
}
