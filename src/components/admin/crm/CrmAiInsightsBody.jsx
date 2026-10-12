export default function CrmAiInsightsBody({ aiResult, aiGeneratedAt }) {
  if (!aiResult) return null
  return (
    <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-950/40 p-3 space-y-2">
      <p className="text-[11px] text-gray-500">
        Generated: {aiGeneratedAt ? new Date(aiGeneratedAt).toLocaleString('en-GB') : '—'}
        {aiResult.model ? ` · ${aiResult.model}` : ''}
      </p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{aiResult.headline}</p>
      {Array.isArray(aiResult.segments) && aiResult.segments.length > 0 ? (
        <div>
          <p className="text-[10px] font-medium text-gray-500 mb-1 tracking-wide">SEGMENTS</p>
          <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-disc list-inside">
            {aiResult.segments.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {Array.isArray(aiResult.bullets) && aiResult.bullets.length > 0 ? (
        <div>
          <p className="text-[10px] font-medium text-gray-500 mb-1 tracking-wide">FINDINGS</p>
          <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-disc list-inside">
            {aiResult.bullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {Array.isArray(aiResult.experiments) && aiResult.experiments.length > 0 ? (
        <div>
          <p className="text-[10px] font-medium text-gray-500 mb-1 tracking-wide">7–14 DAY ACTIONS</p>
          <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
            {aiResult.experiments.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {Array.isArray(aiResult.watchouts) && aiResult.watchouts.length > 0 ? (
        <div>
          <p className="text-[10px] font-medium text-gray-500 mb-1 tracking-wide">MEASUREMENT RISKS</p>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
            {aiResult.watchouts.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {Array.isArray(aiResult.questions) && aiResult.questions.length > 0 ? (
        <div>
          <p className="text-[10px] font-medium text-gray-500 mb-1 tracking-wide">NEXT ANALYSES</p>
          <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-disc list-inside">
            {aiResult.questions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
