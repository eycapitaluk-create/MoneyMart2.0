import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import {
  CAMPAIGN_CP2026_SNS_SEP_HASHTAG,
  CAMPAIGN_CP2026_SNS_SEP_SURVEY_INTRO,
  CAMPAIGN_CP2026_SNS_SEP_SURVEY_QUESTIONS,
} from '../../constants/campaignCp2026SnsSep.js'
import {
  defaultCampaignSurveyState,
  surveyQuestionVisible,
  toggleMultiselectValue,
} from '../../lib/campaignSurveyUtils.js'
import {
  applyCampaignCp2026SnsSep,
  fetchCampaignCp2026SnsSepStatus,
  submitCampaignCp2026SnsSepSns,
  submitCampaignCp2026SnsSepSurvey,
} from '../../lib/campaignApi.js'
import { trackAnalyticsEvent } from '../../lib/analytics.js'

function StepRow({ done, label, hint }) {
  return (
    <li className="flex gap-3 items-start">
      {done ? (
        <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} aria-hidden />
      ) : (
        <Circle className="text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" size={18} aria-hidden />
      )}
      <div className="min-w-0">
        <p className={`text-sm font-bold leading-snug ${done ? 'text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
          {label}
        </p>
        {hint ? <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-0.5 leading-relaxed">{hint}</p> : null}
      </div>
    </li>
  )
}

const defaultSurveyState = () => defaultCampaignSurveyState(CAMPAIGN_CP2026_SNS_SEP_SURVEY_QUESTIONS)

function mergeSavedSurveyAnswers(saved = {}) {
  const base = defaultSurveyState()
  if (!saved || typeof saved !== 'object') return base
  for (const q of CAMPAIGN_CP2026_SNS_SEP_SURVEY_QUESTIONS) {
    if (q.type === 'section') continue
    const v = saved[q.id]
    if (q.type === 'multiselect') {
      base[q.id] = Array.isArray(v) ? v : (v ? [v] : [])
    } else if (v != null && v !== '') {
      base[q.id] = String(v)
    }
    if (q.otherFieldId && saved[q.otherFieldId]) {
      base[q.otherFieldId] = String(saved[q.otherFieldId])
    }
  }
  return base
}

export default function CampaignCp2026SnsSepPanel({
  onSwitchPortfolioTab,
  onUiMessage,
}) {
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState('')
  const [status, setStatus] = useState(null)
  const [survey, setSurvey] = useState(defaultSurveyState)
  const [snsUrl, setSnsUrl] = useState('')
  const [snsPlatform, setSnsPlatform] = useState('twitter')
  const onUiMessageRef = useRef(onUiMessage)
  onUiMessageRef.current = onUiMessage

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCampaignCp2026SnsSepStatus()
      setLoadFailed(false)
      setStatus(data)
      if (data?.entry?.sns_url) setSnsUrl(data.entry.sns_url)
      if (data?.entry?.sns_platform) setSnsPlatform(data.entry.sns_platform)
      if (data?.entry?.survey_answers && !data?.steps?.surveyDone) {
        setSurvey(mergeSavedSurveyAnswers(data.entry.survey_answers))
      }
    } catch (err) {
      setLoadFailed(true)
      onUiMessageRef.current?.(err.message || 'キャンペーン情報の取得に失敗しました', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const steps = status?.steps || {}
  const applied = Boolean(steps.applied)
  const canApply = Boolean(
    steps.signedUp
    && steps.hasAsset
    && steps.surveyDone
    && steps.snsDone
    && !applied,
  )

  const surveyOpen = useMemo(
    () => !steps.surveyDone && steps.hasAsset,
    [steps.surveyDone, steps.hasAsset],
  )

  const visibleSurveyQuestions = useMemo(
    () => CAMPAIGN_CP2026_SNS_SEP_SURVEY_QUESTIONS.filter((q) => surveyQuestionVisible(q, survey)),
    [survey],
  )

  const handleSurveySubmit = async (e) => {
    e.preventDefault()
    for (const q of CAMPAIGN_CP2026_SNS_SEP_SURVEY_QUESTIONS) {
      if (q.type === 'section' || !surveyQuestionVisible(q, survey)) continue
      if (!q.required) continue
      if (q.type === 'multiselect') {
        const arr = Array.isArray(survey[q.id]) ? survey[q.id] : []
        if (arr.length === 0) {
          onUiMessageRef.current?.(`「${q.label}」にご回答ください`, 'error')
          return
        }
      } else if (q.type === 'text' || q.type === 'select') {
        if (!String(survey[q.id] || '').trim()) {
          onUiMessageRef.current?.(`「${q.label}」にご回答ください`, 'error')
          return
        }
      }
    }
    setBusy('survey')
    try {
      const data = await submitCampaignCp2026SnsSepSurvey(survey)
      setStatus(data)
      trackAnalyticsEvent('campaign_survey_submit', { campaign_id: 'cp2026_sns_sep' })
      onUiMessageRef.current?.('アンケートを送信しました', 'success')
    } catch (err) {
      onUiMessageRef.current?.(err.message || '送信に失敗しました', 'error')
    } finally {
      setBusy('')
    }
  }

  const handleSnsSubmit = async (e) => {
    e.preventDefault()
    setBusy('sns')
    try {
      const data = await submitCampaignCp2026SnsSepSns({ sns_url: snsUrl, sns_platform: snsPlatform })
      setStatus(data)
      trackAnalyticsEvent('campaign_sns_submit', { campaign_id: 'cp2026_sns_sep', platform: snsPlatform })
      onUiMessageRef.current?.('投稿URLを保存しました', 'success')
    } catch (err) {
      onUiMessageRef.current?.(err.message || '保存に失敗しました', 'error')
    } finally {
      setBusy('')
    }
  }

  const handleApply = async () => {
    setBusy('apply')
    try {
      const data = await applyCampaignCp2026SnsSep()
      setStatus(data)
      trackAnalyticsEvent('campaign_apply', { campaign_id: 'cp2026_sns_sep' })
      onUiMessageRef.current?.(data.message || '応募を受け付けました', 'success')
    } catch (err) {
      onUiMessageRef.current?.(err.message || '応募に失敗しました', 'error')
    } finally {
      setBusy('')
    }
  }

  if (loading && !status) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-8 flex items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="animate-spin text-orange-500 shrink-0" size={20} />
        進捗を読み込み中…
      </div>
    )
  }

  if (loadFailed && !status) {
    return (
      <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/80 dark:bg-rose-950/20 px-5 py-6 text-sm text-rose-800 dark:text-rose-200">
        キャンペーン情報を取得できませんでした。しばらくしてから再度お試しください。
      </div>
    )
  }

  const inactive = status?.window && !status.window.active
  const staffTest = Boolean(status?.window?.staffTest && !status?.window?.inWindow)

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30">
        <p className="text-sm font-black text-slate-900 dark:text-white">応募の流れ</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          すべて完了したら「応募する」を押してください。
        </p>
      </div>

      <div className="p-5">
        {inactive ? (
          <p className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 px-3 py-2.5">
            応募受付は2026年10月1日から開始します。プレビュー表示中の場合は、期間開始後に応募できます。
          </p>
        ) : staffTest ? (
          <p className="text-sm font-bold text-sky-700 dark:text-sky-300 mb-4 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-900/40 px-3 py-2.5">
            社内テストモード（期間前の動作確認用）。justin / kelly アカウントのみ表示・応募できます。
          </p>
        ) : null}

        <ol className="space-y-3 mb-5">
          <StepRow done={steps.signedUp} label="会員登録（ログイン済み）" />
          <StepRow
            done={steps.hasAsset}
            label="関心または投資資産を1件以上登録"
            hint="ウォッチリスト、保有株式・ファンドのいずれか"
          />
          <StepRow done={steps.surveyDone} label="アンケート（1〜2分）" />
          <StepRow
            done={steps.snsDone}
            label={`X または Note に ${CAMPAIGN_CP2026_SNS_SEP_HASHTAG} 付きで投稿`}
            hint="MoneyMart画面のスクリーンショット付き・公開投稿"
          />
          <StepRow done={applied} label="応募完了" />
        </ol>

        {!steps.hasAsset ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 mb-4">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">資産を登録してください</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
              マイページで株式・ファンド、またはウォッチリストを1件以上登録すると次のステップに進めます。
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onSwitchPortfolioTab?.('stock')}
                className="text-xs font-black px-4 py-2 rounded-xl bg-slate-900 dark:bg-orange-500 text-white"
              >
                株式を登録する
              </button>
              <button
                type="button"
                onClick={() => onSwitchPortfolioTab?.('fund')}
                className="text-xs font-black px-4 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200"
              >
                ファンドを登録する
              </button>
            </div>
          </div>
        ) : null}

        {surveyOpen ? (
          <form onSubmit={handleSurveySubmit} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-4 mb-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-slate-100">MoneyMart アンケート</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 leading-relaxed whitespace-pre-line">
                {CAMPAIGN_CP2026_SNS_SEP_SURVEY_INTRO}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">所要時間 約1〜2分</p>
            </div>
            {visibleSurveyQuestions.map((q) => {
              if (q.type === 'section') {
                return (
                  <div key={q.id} className="pt-2 border-t border-slate-200/80 dark:border-slate-700">
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200">{q.label}</p>
                    {q.hint ? <p className="text-[11px] text-slate-500 mt-0.5">{q.hint}</p> : null}
                  </div>
                )
              }
              const multi = Array.isArray(survey[q.id]) ? survey[q.id] : []
              return (
                <div key={q.id} className="block">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {q.label}
                    {q.required ? <span className="text-red-500"> *</span> : null}
                  </span>
                  {q.hint ? <p className="text-[10px] text-slate-400 mt-0.5">{q.hint}</p> : null}
                  {q.type === 'select' ? (
                    <select
                      className="mt-1.5 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                      value={survey[q.id]}
                      onChange={(e) => setSurvey((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      required={q.required}
                    >
                      <option value="">選択してください</option>
                      {q.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : null}
                  {q.type === 'multiselect' ? (
                    <fieldset className="mt-2 space-y-1.5">
                      {q.options.map((o) => (
                        <label key={o.value} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-0.5 shrink-0"
                            checked={multi.includes(o.value)}
                            onChange={() => setSurvey((prev) => ({
                              ...prev,
                              [q.id]: toggleMultiselectValue(prev[q.id], o.value),
                            }))}
                          />
                          <span>{o.label}</span>
                        </label>
                      ))}
                    </fieldset>
                  ) : null}
                  {q.otherFieldId && multi.includes('other') ? (
                    <input
                      type="text"
                      className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                      placeholder={q.otherPlaceholder || 'その他'}
                      value={survey[q.otherFieldId] || ''}
                      maxLength={300}
                      onChange={(e) => setSurvey((prev) => ({ ...prev, [q.otherFieldId]: e.target.value }))}
                    />
                  ) : null}
                  {q.type === 'text' ? (
                    <textarea
                      className="mt-1.5 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-h-[88px]"
                      value={survey[q.id]}
                      maxLength={q.maxLength || 500}
                      required={q.required}
                      onChange={(e) => setSurvey((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    />
                  ) : null}
                </div>
              )
            })}
            <button
              type="submit"
              disabled={busy === 'survey' || inactive}
              className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black disabled:opacity-50 sticky bottom-0"
            >
              {busy === 'survey' ? '送信中…' : 'アンケートを送信'}
            </button>
          </form>
        ) : null}

        {steps.hasAsset && !steps.snsDone ? (
          <form onSubmit={handleSnsSubmit} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-4 mb-4 space-y-3">
            <p className="text-sm font-black text-slate-800 dark:text-slate-100">SNS投稿URL</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              {CAMPAIGN_CP2026_SNS_SEP_HASHTAG} とアプリ画面のスクリーンショットを付けた
              <strong className="font-bold">公開投稿</strong>のURLを貼り付けてください。
            </p>
            <div className="flex gap-2">
              {[
                { id: 'twitter', label: 'X' },
                { id: 'note', label: 'Note' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSnsPlatform(p.id)}
                  className={`flex-1 py-2 rounded-lg text-xs font-black border-2 ${
                    snsPlatform === p.id
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-200'
                      : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="url"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              placeholder="https://x.com/... または https://note.com/..."
              value={snsUrl}
              onChange={(e) => setSnsUrl(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={busy === 'sns' || inactive}
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-orange-500 text-white text-sm font-black disabled:opacity-50"
            >
              {busy === 'sns' ? '保存中…' : '投稿URLを保存'}
            </button>
          </form>
        ) : null}

        {applied ? (
          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 text-center py-2">
            応募済みです。審査・特典付与までお待ちください。
          </p>
        ) : (
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply || busy === 'apply' || inactive}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy === 'apply' ? '送信中…' : '応募する'}
          </button>
        )}
      </div>
    </div>
  )
}
