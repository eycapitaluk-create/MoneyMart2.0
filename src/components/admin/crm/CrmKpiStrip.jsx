import { labelClass, monoNum, panelClass, panelPad, fmt, pctOrDash } from './crmUi'

export default function CrmKpiStrip({
  sessions = null,
  signups = null,
  visitToSignupPct = null,
  activatedPct = null,
  attributionPct = null,
  premiumIntent = null,
  rangeDays = 30,
}) {
  const items = [
    { label: 'Sessions', value: fmt(sessions), note: `${rangeDays}d` },
    { label: 'Signups', value: fmt(signups), note: 'customers' },
    { label: 'Signup / session', value: pctOrDash(visitToSignupPct), note: 'directional ratio' },
    { label: '7d activated', value: pctOrDash(activatedPct), note: 'fully observed signups' },
    { label: 'Attributed', value: pctOrDash(attributionPct), note: 'first-touch' },
    { label: 'Premium intent', value: fmt(premiumIntent), note: 'in cohort' },
  ]

  return (
    <div className={`${panelClass} ${panelPad}`}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <p className={labelClass}>{item.label}</p>
            <p className={`text-xl sm:text-2xl mt-1 ${monoNum}`}>{item.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{item.note}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
