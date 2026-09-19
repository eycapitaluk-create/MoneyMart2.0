import { UTM_LINK_EXAMPLES } from '../../../lib/utmLinks'
import { REFERRER_CHANNEL_NOTES } from '../../../lib/referrerBuckets'
import { fmt, labelClass, panelClass, panelPad, pctOrDash, titleClass } from './crmUi'

export default function CrmAttributionPanel({
  salesSummary = {},
  acquisitionSummary = {},
}) {
  const missing = Number(salesSummary.missingAttribution || 0)
  const withAttr = Number(salesSummary.withAttr || 0)
  const signups = Number(salesSummary.signups || 0)

  return (
    <div className="space-y-4">
      <div className={`${panelClass} ${panelPad}`}>
        <h3 className={titleClass}>Attribution quality</h3>
        <p className="text-[11px] text-gray-500 mt-0.5 mb-4">
          First-touch coverage for customer signups in range.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Signups', value: fmt(signups) },
            { label: 'Attributed', value: fmt(withAttr) },
            { label: 'Unknown source', value: fmt(missing) },
            { label: 'Attribution %', value: pctOrDash(salesSummary.attributionPct) },
            { label: 'UTM coverage', value: pctOrDash(salesSummary.utmPct) },
            { label: 'Referrer variants', value: fmt(acquisitionSummary.uniqueReferrerDomains) },
            { label: 'Landing paths', value: fmt(acquisitionSummary.uniqueLandingPaths) },
            { label: 'UTM combos', value: fmt(acquisitionSummary.uniqueUtmCombinations) },
          ].map((item) => (
            <div key={item.label} className="rounded-md border border-gray-200 dark:border-gray-800 p-3">
              <p className={labelClass}>{item.label}</p>
              <p className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white mt-1">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`${panelClass} ${panelPad}`}>
        <h3 className={titleClass}>What “Direct / unknown” means</h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
          Not only typed URLs and bookmarks. Includes untagged social or email links, in-app browsers,
          privacy-restricted referrals, and signups created before attribution capture.
          It means the source cannot be proven — not that the customer had no source.
        </p>
        {REFERRER_CHANNEL_NOTES?.smartnews ? (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
            {REFERRER_CHANNEL_NOTES.smartnews}
          </p>
        ) : null}
      </div>

      <div className={`${panelClass} ${panelPad}`}>
        <h3 className={titleClass}>UTM link examples</h3>
        <p className="text-[11px] text-gray-500 mt-0.5 mb-3">
          Tag every external link. Without UTM or <code className="text-[10px]">?ref=</code>, signups appear as unknown.
        </p>
        <ul className="space-y-2">
          {(UTM_LINK_EXAMPLES || []).map((ex) => (
            <li key={ex.label} className="rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2">
              <p className={`${labelClass} mb-1`}>{ex.label}</p>
              <code className="block text-[10px] text-gray-800 dark:text-gray-200 break-all select-all">{ex.url}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
