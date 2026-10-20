import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline'

export const MAINTENANCE_NOTICE_LABEL = 'Scheduled Maintenance:'
export const MAINTENANCE_NOTICE_BODY =
  'We are currently upgrading our database infrastructure. Live search and AI chat may be temporarily unavailable for the next 24 hours.'

export function isMaintenanceBannerEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MAINTENANCE_MODE?.trim().toLowerCase() !== 'false'
}

export default function MaintenanceBanner() {
  if (!isMaintenanceBannerEnabled()) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-amber-900 text-xs sm:text-sm"
    >
      <div className="container-custom flex items-center justify-center gap-2 text-center">
        <WrenchScrewdriverIcon
          className="w-4 h-4 shrink-0 text-amber-700"
          aria-hidden="true"
        />
        <p className="font-medium leading-snug">
          <span className="font-semibold">{MAINTENANCE_NOTICE_LABEL}</span>{' '}
          {MAINTENANCE_NOTICE_BODY}
        </p>
      </div>
    </div>
  )
}
