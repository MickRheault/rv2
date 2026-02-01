'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BuildingStorefrontIcon, ChevronDownIcon, ChevronUpIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline'
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell
} from '@/components/ui/Table'
import { formatCurrency, cn } from '@/lib/utils'
import { Button } from '@/components/ui'

interface MotorcycleTableProps {
    motorcycles: any[]
    title?: string
    showShopColumn?: boolean
}

type SortKey = 'bike' | 'shop' | 'type' | 'cc' | 'price'
type SortDirection = 'asc' | 'desc'

export default function MotorcycleTable({ motorcycles, title, showShopColumn = false }: MotorcycleTableProps) {
    const router = useRouter()
    const [isExpanded, setIsExpanded] = useState(false)
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
        key: 'bike',
        direction: 'asc'
    })

    // Helper to get best rate for sorting
    const getBestRateValue = (motorcycle: any) => {
        if (motorcycle.rental_rate_tiers && motorcycle.rental_rate_tiers.length > 0) {
            const dailyRate = motorcycle.rental_rate_tiers.find((tier: any) => tier.min_days === 1)
            if (dailyRate) return dailyRate.rate_per_day
            return Math.min(...motorcycle.rental_rate_tiers.map((t: any) => t.rate_per_day))
        }
        return motorcycle.rental_rate_per_day || 0
    }

    // Sort motorcycles based on sortConfig
    const sortedMotorcycles = useMemo(() => {
        if (!motorcycles) return []
        return [...motorcycles].sort((a, b) => {
            let valA: any = ''
            let valB: any = ''

            switch (sortConfig.key) {
                case 'bike':
                    valA = `${a.brands?.name || ''} ${a.model || ''}`.trim().toLowerCase()
                    valB = `${b.brands?.name || ''} ${b.model || ''}`.trim().toLowerCase()
                    break
                case 'shop':
                    valA = (a.rental_shops?.provider_name || '').toLowerCase()
                    valB = (b.rental_shops?.provider_name || '').toLowerCase()
                    break
                case 'type':
                    valA = (a.categories?.name || '').toLowerCase()
                    valB = (b.categories?.name || '').toLowerCase()
                    break
                case 'cc':
                    valA = a.engine_capacity_cc || 0
                    valB = b.engine_capacity_cc || 0
                    break
                case 'price':
                    valA = getBestRateValue(a)
                    valB = getBestRateValue(b)
                    break
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })
    }, [motorcycles, sortConfig])

    if (!motorcycles || motorcycles.length === 0) return null

    const requestSort = (key: SortKey) => {
        let direction: SortDirection = 'asc'
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    const SortIndicator = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortConfig.key !== columnKey) return <ChevronUpDownIcon className="w-3 h-3 ml-1 text-gray-300" />
        return sortConfig.direction === 'asc'
            ? <ChevronUpIcon className="w-3 h-3 ml-1 text-blue-500" />
            : <ChevronDownIcon className="w-3 h-3 ml-1 text-blue-500" />
    }

    const INITIAL_DISPLAY_COUNT = 15
    const hasMore = sortedMotorcycles.length > INITIAL_DISPLAY_COUNT
    const displayedMotorcycles = isExpanded ? sortedMotorcycles : sortedMotorcycles.slice(0, INITIAL_DISPLAY_COUNT)

    return (
        <div className="mt-4 md:mt-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6">
                <div className="flex items-center gap-2">
                    <BuildingStorefrontIcon className="w-5 h-5 text-gray-400" />
                    <h2 className="text-lg md:text-2xl font-bold text-gray-900">
                        {title || `Motorcycles Available (${motorcycles.length})`}
                    </h2>
                </div>

                {/* Mobile Sort Controls */}
                <div className="md:hidden flex gap-2">
                    <select
                        className="text-sm bg-white border border-gray-200 rounded px-2 py-1.5 w-full font-medium text-gray-700"
                        value={`${sortConfig.key}-${sortConfig.direction}`}
                        onChange={(e) => {
                            const [key, direction] = e.target.value.split('-') as [SortKey, SortDirection]
                            setSortConfig({ key, direction })
                        }}
                    >
                        <option value="bike-asc">Bike (A-Z)</option>
                        <option value="price-asc">Price (Low to High)</option>
                        <option value="price-desc">Price (High to Low)</option>
                        <option value="cc-desc">Capacity (High to Low)</option>
                    </select>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block mb-4 overflow-hidden">
                <Table className="w-full text-sm border-collapse">
                    <TableHeader className="bg-gray-50/50">
                        <TableRow className="border-b border-gray-100 hover:bg-transparent">
                            <TableHead
                                className="py-3 px-3 text-left font-bold uppercase tracking-wider text-xs text-gray-500 cursor-pointer hover:text-gray-900 transition-colors"
                                onClick={() => requestSort('bike')}
                            >
                                <div className="flex items-center">Bike <SortIndicator columnKey="bike" /></div>
                            </TableHead>
                            {showShopColumn && (
                                <TableHead
                                    className="hidden md:table-cell py-1 md:py-3 px-1 md:px-3 text-left font-bold uppercase tracking-tighter md:tracking-wider text-[9px] md:text-xs text-gray-400 md:text-gray-500 cursor-pointer hover:text-gray-900 transition-colors"
                                    onClick={() => requestSort('shop')}
                                >
                                    <div className="flex items-center">Shop <SortIndicator columnKey="shop" /></div>
                                </TableHead>
                            )}
                            <TableHead
                                className="py-3 px-3 text-left font-bold uppercase tracking-wider text-xs text-gray-500 cursor-pointer hover:text-gray-900 transition-colors"
                                onClick={() => requestSort('type')}
                            >
                                <div className="flex items-center">Type <SortIndicator columnKey="type" /></div>
                            </TableHead>
                            <TableHead
                                className="hidden md:table-cell py-1 md:py-3 px-0 md:px-3 text-center font-bold uppercase tracking-tighter md:tracking-wider text-[9px] md:text-xs text-gray-400 md:text-gray-500 w-8 md:w-20 cursor-pointer hover:text-gray-900 transition-colors"
                                onClick={() => requestSort('cc')}
                            >
                                <div className="flex items-center justify-center">CC <SortIndicator columnKey="cc" /></div>
                            </TableHead>
                            <TableHead
                                className="py-3 px-3 text-right font-bold uppercase tracking-wider text-xs text-gray-500 w-28 cursor-pointer hover:text-gray-900 transition-colors"
                                onClick={() => requestSort('price')}
                            >
                                <div className="flex items-center justify-end">Price <SortIndicator columnKey="price" /></div>
                            </TableHead>
                            <TableHead className="hidden md:table-cell py-1 md:py-3 px-0 md:px-3 text-right font-bold uppercase tracking-tighter md:tracking-wider text-[9px] md:text-xs text-gray-400 md:text-gray-500 w-10 md:w-24">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y">
                        {displayedMotorcycles.map((motorcycle) => {
                            const getBestRate = () => {
                                if (motorcycle.rental_rate_tiers && motorcycle.rental_rate_tiers.length > 0) {
                                    const dailyRate = motorcycle.rental_rate_tiers.find((tier: any) => tier.min_days === 1)
                                    if (dailyRate) return { amount: dailyRate.rate_per_day, currency: dailyRate.currency }

                                    const lowestRate = motorcycle.rental_rate_tiers.reduce((prev: any, current: any) =>
                                        prev.rate_per_day < current.rate_per_day ? prev : current
                                    )
                                    return { amount: lowestRate.rate_per_day, currency: lowestRate.currency }
                                }
                                return { amount: motorcycle.rental_rate_per_day, currency: motorcycle.rental_rate_currency }
                            }

                            const bestRate = getBestRate()
                            const price = bestRate.amount ? formatCurrency(bestRate.amount, bestRate.currency || 'USD') : 'On request'

                            return (
                                <TableRow
                                    key={motorcycle.id}
                                    className="hover:bg-gray-100/50 border-b border-gray-100 last:border-0 cursor-pointer transition-colors"
                                    onClick={() => router.push(`/motorcycle/${motorcycle.id}`)}
                                >
                                    <TableCell className="py-2 md:py-4 px-2 md:px-3 font-medium leading-tight">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="line-clamp-1 text-sm md:text-base">
                                                {(() => {
                                                    const fullName = `${motorcycle.brands?.name || ''} ${motorcycle.model || ''}`.trim()
                                                    return fullName.length > 25 ? `${fullName.slice(0, 25)}...` : fullName
                                                })()}
                                            </span>
                                            {showShopColumn && (
                                                <span className="md:hidden text-xs text-gray-500 font-normal line-clamp-1">
                                                    {motorcycle.rental_shops?.provider_name || 'Shop'}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    {showShopColumn && (
                                        <TableCell className="hidden md:table-cell py-0.5 md:py-4 px-1 md:px-3 text-gray-600">
                                            <span className="line-clamp-1">
                                                {motorcycle.rental_shops?.provider_name
                                                    ? motorcycle.rental_shops.provider_name.length > 20
                                                        ? `${motorcycle.rental_shops.provider_name.slice(0, 20)}...`
                                                        : motorcycle.rental_shops.provider_name
                                                    : 'Shop'}
                                            </span>
                                        </TableCell>
                                    )}
                                    <TableCell className="py-4 px-3 text-gray-600">
                                        {motorcycle.categories?.name || 'Motorcycle'}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell py-0.5 md:py-4 px-0 md:px-3 text-center text-gray-400 md:text-gray-600 whitespace-nowrap">
                                        {motorcycle.engine_capacity_cc || '-'}
                                    </TableCell>
                                    <TableCell className="py-2 md:py-4 px-2 md:px-3 text-right font-bold text-gray-900 whitespace-nowrap">
                                        <div className="flex flex-col items-end gap-0.5">
                                            <span className="text-sm md:text-base">{price}</span>
                                            <span className="md:hidden text-xs text-gray-400 font-normal">
                                                {motorcycle.engine_capacity_cc ? `${motorcycle.engine_capacity_cc}cc` : '-'}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell py-0.5 md:py-4 px-0 md:px-3 text-right">
                                        <Link
                                            href={`/motorcycle/${motorcycle.id}`}
                                            className="text-blue-600 font-bold hover:text-blue-700 text-sm"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            View
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile List View (2-Line Row) */}
            <div className="md:hidden space-y-3 mb-6">
                {displayedMotorcycles.map((motorcycle) => {
                    const getBestRate = () => {
                        if (motorcycle.rental_rate_tiers && motorcycle.rental_rate_tiers.length > 0) {
                            const dailyRate = motorcycle.rental_rate_tiers.find((tier: any) => tier.min_days === 1)
                            if (dailyRate) return { amount: dailyRate.rate_per_day, currency: dailyRate.currency }
                            const lowestRate = motorcycle.rental_rate_tiers.reduce((prev: any, current: any) =>
                                prev.rate_per_day < current.rate_per_day ? prev : current
                            )
                            return { amount: lowestRate.rate_per_day, currency: lowestRate.currency }
                        }
                        return { amount: motorcycle.rental_rate_per_day, currency: motorcycle.rental_rate_currency }
                    }

                    const bestRate = getBestRate()
                    const price = bestRate.amount ? formatCurrency(bestRate.amount, bestRate.currency || 'USD') : 'On request'

                    return (
                        <div
                            key={motorcycle.id}
                            onClick={() => router.push(`/motorcycle/${motorcycle.id}`)}
                            className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm active:bg-gray-50 transition-colors cursor-pointer"
                        >
                            {/* Line 1: Name & Price */}
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="font-semibold text-gray-900 text-sm line-clamp-1 pr-2">
                                    {motorcycle.brands?.name} {motorcycle.model}
                                </h3>
                                <div className="text-right whitespace-nowrap">
                                    <span className="font-bold text-gray-900 text-sm">{price}</span>
                                </div>
                            </div>

                            {/* Line 2: Details & Action */}
                            <div className="flex justify-between items-center text-xs text-gray-500">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {showShopColumn && (
                                        <span className="truncate max-w-[120px]">
                                            {motorcycle.rental_shops?.provider_name || 'Shop'}
                                        </span>
                                    )}
                                    {showShopColumn && motorcycle.engine_capacity_cc && <span>•</span>}
                                    {motorcycle.engine_capacity_cc && (
                                        <span>{motorcycle.engine_capacity_cc}cc</span>
                                    )}
                                </div>
                                <div className="text-blue-600 font-medium">View details &rarr;</div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {hasMore && (
                <div className="flex justify-center mt-4">
                    <Button
                        variant="outline"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-2 text-gray-600 border-gray-200 hover:bg-gray-50 transition-all w-full md:w-auto justify-center"
                    >
                        {isExpanded ? (
                            <>
                                Show less <ChevronUpIcon className="w-4 h-4" />
                            </>
                        ) : (
                            <>
                                Show all available ({motorcycles.length}) <ChevronDownIcon className="w-4 h-4" />
                            </>
                        )}
                    </Button>
                </div>
            )}
        </div>
    )
}
