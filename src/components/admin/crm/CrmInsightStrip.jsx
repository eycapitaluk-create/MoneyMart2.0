import { Sparkles } from 'lucide-react'
import Button from '../../ui/Button'
import CrmAiInsightsBody from './CrmAiInsightsBody'
import { labelClass, panelClass, panelPad, titleClass } from './crmUi'

export default function CrmInsightStrip({
  executiveSummary,
  aiOpen = false,
  onToggleAi,
  onRunAi,
  aiLoading = false,
  aiError = '',
  aiResult = null,
  aiGeneratedAt = null,
  aiDisabled = false,
}) {
  const severity = executiveSummary?.severity === 'warn'
  const action = Array.isArray(executiveSummary?.actions) && executiveSummary.actions[0]
    ? executiveSummary.actions[0]
    : null

  return (
    <div className={`${panelClass} ${panelPad} space-y-3`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={labelClass}>Insight</p>
          <p className={`mt-1 text-sm font-semibold leading-snug ${severity ? 'text-amber-800 dark:text-amber-200' : 'text-gray-900 dark:text-white'}`}>
            {executiveSummary?.headline || 'No summary yet'}
          </p>
          {action ? (
            <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              <span className="font-medium text-gray-700 dark:text-gray-300">Next: </span>
              {action}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleAi}
            disabled={aiDisabled}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 inline-block align-middle" aria-hidden />
            {aiOpen ? 'Hide AI' : 'AI analysis'}
          </Button>
        </div>
      </div>

      {aiOpen ? (
        <div className="border-t border-gray-200 dark:border-gray-800 pt-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className={titleClass}>AI executive analysis</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Aggregate metrics only — no raw emails.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={onRunAi}
              disabled={aiLoading || aiDisabled}
            >
              {aiLoading ? 'Analyzing…' : 'Generate'}
            </Button>
          </div>
          {aiError ? (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">{aiError}</p>
          ) : null}
          <CrmAiInsightsBody aiResult={aiResult} aiGeneratedAt={aiGeneratedAt} />
        </div>
      ) : null}
    </div>
  )
}
