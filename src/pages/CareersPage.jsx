import { CAREERS_B2B_JD, CAREERS_SEO_TITLE, CAREERS_SEO_DESCRIPTION } from '../data/careers.js'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Mail, Users } from 'lucide-react'
import { COMPANY_SUPPORT_EMAIL } from '../constants/companyLegal'

const CAREERS_MAILTO = `mailto:${COMPANY_SUPPORT_EMAIL}?subject=${encodeURIComponent('採用応募（通年採用）')}`
const CAREERS_B2B_MAILTO = `mailto:${COMPANY_SUPPORT_EMAIL}?subject=${encodeURIComponent('採用応募（法人営業・事業開発）')}`



export default function CareersPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-200 pb-20">
      <Helmet>
        <title>{CAREERS_SEO_TITLE}</title>
        <meta
          name="description"
          content={CAREERS_SEO_DESCRIPTION}
        />
      <link rel="canonical" href="https://www.moneymart.co.jp/careers" />
        <meta property="og:title" content={CAREERS_SEO_TITLE} />
        <meta property="og:description" content={CAREERS_SEO_DESCRIPTION} />
        <meta name="twitter:title" content={CAREERS_SEO_TITLE} />
        <meta name="twitter:description" content={CAREERS_SEO_DESCRIPTION} />
      </Helmet>

      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] bg-[size:28px_28px]" />
        <div className="relative max-w-4xl mx-auto px-6 py-16 md:py-20">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Users className="text-orange-400" size={20} />
            <span className="inline-flex items-center py-1 px-3 rounded-full text-[11px] font-black bg-orange-500 text-white">
              募集期間：2026年9月27日〜10月27日
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black leading-tight mb-3">採用情報</h1>
          <p className="text-base md:text-lg text-slate-300 leading-relaxed">
            {CAREERS_B2B_JD.title}
          </p>
          <p className="mt-3 text-sm text-slate-400">{CAREERS_B2B_JD.location}</p>
          <a
            href={CAREERS_B2B_MAILTO}
            className="mt-8 inline-flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-orange-600 transition"
          >
            <Mail size={15} /> 応募する
          </a>
        </div>
      </section>

      <section className="py-12 md:py-16 px-6 max-w-4xl mx-auto">
        <div className="space-y-8">
          {CAREERS_B2B_JD.sections.map((section) => (
            <div key={section.heading}>
              <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white mb-3">{section.heading}</h2>
              {section.paragraphs?.map((text) => (
                <p key={text} className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3 last:mb-0">
                  {text}
                </p>
              ))}
              {section.items && (
                <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800">
          <a
            href={CAREERS_B2B_MAILTO}
            className="inline-flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-orange-600 transition"
          >
            <Mail size={15} /> 応募する（{COMPANY_SUPPORT_EMAIL}）
          </a>
          <p className="mt-5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
            エンジニアリング、プロダクト、コンテンツなど他領域も通年で受け付けます。
          </p>
          <a
            href={CAREERS_MAILTO}
            className="inline-flex items-center gap-2 text-sm font-bold text-orange-600 hover:underline"
          >
            その他の職種で応募する
          </a>
          <p className="mt-6">
            <Link to="/about" className="text-sm font-bold text-slate-500 hover:text-orange-600">
              運営会社について
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
