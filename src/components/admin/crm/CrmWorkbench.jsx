import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import Button from '../../ui/Button'
import CrmAudiencePanel from '../CrmAudiencePanel'
import CrmAttributionPanel from './CrmAttributionPanel'
import CrmChannelsPanel from './CrmChannelsPanel'
import CrmCustomersPanel from './CrmCustomersPanel'
import CrmInsightStrip from './CrmInsightStrip'
import CrmKpiStrip from './CrmKpiStrip'
import CrmOverviewPanel from './CrmOverviewPanel'
import CrmSessionsPanel from './CrmSessionsPanel'
import { panelClass, panelPad, rangeBtn, subTabBtn, titleClass } from './crmUi'

const SUB_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'channels', label: 'Channels' },
  { id: 'audience', label: 'Audience' },
  { id: 'customers', label: 'Customers' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'attribution', label: 'Attribution' },
]

export default function CrmWorkbench({
  rangeDays,
  onRangeDaysChange,
  loading = false,
  error = '',
  trafficError = '',
  trafficLoading = false,
  audienceLoading = false,
  onRefresh,
  onDownloadCsv,
  csvDisabled = false,
  decisionMetrics,
  salesSummary,
  growthKpis,
  executiveSummary,
  acquisitionSummary,
  analysis,
  trafficChannels,
  signupChannels,
  trafficSummary,
  trafficSessions,
  userCreatedAtById,
  customerSignups,
  audience,
  audienceError,
  aiLoading,
  aiError,
  aiResult,
  aiGeneratedAt,
  onRunAi,
  aiDisabled = false,
}) {
  const [subTab, setSubTab] = useState('overview')
  const [channelFilter, setChannelFilter] = useState(null)
  const [aiOpen, setAiOpen] = useState(false)

  const channelLabel = useMemo(() => {
    if (!channelFilter) return null
    const hit = [...(trafficChannels || []), ...(signupChannels || [])]
      .find((r) => (r.id || r.label) === channelFilter)
    return hit?.label || channelFilter
  }, [channelFilter, trafficChannels, signupChannels])

  const selectChannel = (id) => {
    setChannelFilter((prev) => (prev === id ? null : id))
  }

  const busy = loading || trafficLoading || audienceLoading

  return (
    <div className="space-y-4">
      <div className={`${panelClass} ${panelPad} sticky top-[7.25rem] z-[70] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0">
            <h2 className={titleClass}>CRM · Acquisition workbench</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Period compare, channel quality, weekly cohorts. Staff and test accounts excluded.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end shrink-0">
            <span className="text-[10px] font-medium text-gray-500">Range</span>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onRangeDaysChange?.(d)}
                className={rangeBtn(rangeDays === d)}
              >
                {d}d
              </button>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={onDownloadCsv} disabled={csvDisabled}>
              <Download className="w-3.5 h-3.5 mr-1 inline-block align-middle" aria-hidden />
              CSV
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={busy}>
              {busy ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 p-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      ) : null}
      {trafficError ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">{trafficError}</p>
        </div>
      ) : null}

      {loading && !salesSummary?.signups && !decisionMetrics?.sessions ? (
        <div className={`${panelClass} ${panelPad} text-sm text-gray-500 animate-pulse`}>Loading CRM…</div>
      ) : (
        <>
          <CrmKpiStrip
            sessions={decisionMetrics?.sessions ?? trafficSummary?.uniqueSessions}
            signups={salesSummary?.signups}
            visitToSignupPct={decisionMetrics?.visitToSignupPct}
            activatedPct={salesSummary?.activatedPct}
            attributionPct={salesSummary?.attributionPct}
            premiumIntent={growthKpis?.premiumIntent ?? decisionMetrics?.premiumIntent}
            rangeDays={rangeDays}
          />

          <CrmInsightStrip
            executiveSummary={executiveSummary}
            aiOpen={aiOpen}
            onToggleAi={() => setAiOpen((v) => !v)}
            onRunAi={onRunAi}
            aiLoading={aiLoading}
            aiError={aiError}
            aiResult={aiResult}
            aiGeneratedAt={aiGeneratedAt}
            aiDisabled={aiDisabled || Boolean(error)}
          />

          {channelFilter ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500">Filter:</span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 font-medium text-gray-800 dark:text-gray-200">
                {channelLabel}
                <button type="button" className="text-gray-500 hover:text-gray-800 dark:hover:text-white" onClick={() => setChannelFilter(null)}>
                  ×
                </button>
              </span>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1.5 border-b border-gray-200 dark:border-gray-800 pb-2">
            {SUB_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={subTabBtn(subTab === tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {subTab === 'overview' ? (
            <CrmOverviewPanel
              decisionMetrics={decisionMetrics}
              acquisitionSummary={acquisitionSummary}
              analysis={analysis}
              rangeDays={rangeDays}
              onSelectChannel={selectChannel}
            />
          ) : null}

          {subTab === 'channels' ? (
            <CrmChannelsPanel
              trafficChannels={trafficChannels}
              signupChannels={signupChannels}
              channelQuality={analysis?.channelQuality}
              channelFilter={channelFilter}
              onSelectChannel={selectChannel}
              minN={analysis?.minN}
            />
          ) : null}

          {subTab === 'audience' ? (
            <CrmAudiencePanel
              audience={audience}
              loading={audienceLoading}
              error={audienceError}
              rangeDays={rangeDays}
            />
          ) : null}

          {subTab === 'customers' ? (
            <CrmCustomersPanel
              signups={customerSignups}
              channelFilter={channelFilter}
              channelLabel={channelLabel}
              onClearChannel={() => setChannelFilter(null)}
            />
          ) : null}

          {subTab === 'sessions' ? (
            <CrmSessionsPanel
              sessions={trafficSessions}
              channelFilter={channelFilter}
              channelLabel={channelLabel}
              onClearChannel={() => setChannelFilter(null)}
              rangeDays={rangeDays}
              userCreatedAtById={userCreatedAtById}
            />
          ) : null}

          {subTab === 'attribution' ? (
            <CrmAttributionPanel
              salesSummary={salesSummary}
              acquisitionSummary={acquisitionSummary}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
