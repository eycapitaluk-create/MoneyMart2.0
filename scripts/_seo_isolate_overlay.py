#!/usr/bin/env python3
"""Copy SEO-only files onto the clean isolate worktree. Does not touch git history."""
from __future__ import annotations

import shutil
from pathlib import Path

SRC = Path("/Users/justinnam/.cursor/worktrees/MoneyMart2.0/utn")
DEST = Path("/tmp/mm-seo-prod-a40ed48")

WHOLE = [
    "api/sitemap.js",
    "api/ssr/budget-tracker.js",
    "api/ssr/dividend-calendar.js",
    "api/ssr/funds.js",
    "api/ssr/home.js",
    "api/ssr/insights.js",
    "api/ssr/lib/etfCompareSsrHtml.js",
    "api/ssr/lib/seoHead.js",
    "api/ssr/market.js",
    "api/ssr/tools.js",
    "api/ssr/static-public.js",
    "api/ssr/lib/mmPathAllowlist.js",
    "index.html",
    "public/robots.txt",
    "public/llms.txt",
    "src/lib/seoConfig.js",
    "src/lib/seoJsonLd.js",
    "src/pages/NotFoundPage.jsx",
]

OPTIONAL_DEPS = [
    "src/lib/insightDocumentNormalize.js",
    "src/constants/companyLegal.js",
    "public/og-card.png",
]


def copy_file(rel: str) -> None:
    s = SRC / rel
    d = DEST / rel
    if not s.exists():
        print(f"SKIP missing src {rel}")
        return
    d.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(s, d)
    print(f"COPIED {rel}")


def main() -> None:
    if not (DEST / "package.json").exists():
        raise SystemExit(f"isolate missing: {DEST}")
    for rel in WHOLE:
        copy_file(rel)
    for rel in OPTIONAL_DEPS:
        if (SRC / rel).exists() and not (DEST / rel).exists():
            copy_file(rel)
        elif (SRC / rel).exists():
            # only copy if HEAD file missing; if present keep HEAD unless insights needs newer
            copy_file(rel)

    # middleware: SEO bot SSR, but do not call missing fund-detail handler
    mw = (SRC / "middleware.js").read_text()
    mw = mw.replace(
        """  if (pathname.startsWith('/funds/')) {
    const seg = pathname.slice('/funds/'.length).split('/')[0]
    if (!seg) return null
    try {
      const decoded = decodeURIComponent(seg)
      if (decoded.toLowerCase() === 'compare') return null
    } catch {
      return null
    }
    const invoke = new URL('/api/ssr/fund-detail', url.origin)
    invoke.searchParams.set('__mm_path', `${pathname}${url.search}`)
    return invoke
  }
""",
        """  if (pathname.startsWith('/funds/')) {
    return null
  }
""",
    )
    (DEST / "middleware.js").write_text(mw)
    print("WROTE middleware.js (no fund-detail)")

    # vercel.json: only X-Robots-Tag SEO headers
    v = (DEST / "vercel.json").read_text()
    v = v.replace(
        '"source": "/(login|signup|forgot-password|reset-password|complete-profile)"',
        '"source": "/(login|signup|forgot-password|reset-password|complete-profile|signup-complete)"',
    )
    needle = """      "source": "/admin(.*)",
      "headers": [
        { "key": "X-Robots-Tag", "value": "noindex, nofollow" }
      ]
    }
"""
    insert = """      "source": "/admin(.*)",
      "headers": [
        { "key": "X-Robots-Tag", "value": "noindex, nofollow" }
      ]
    },
    {
      "source": "/(community|lounge|signup-complete)",
      "headers": [
        { "key": "X-Robots-Tag", "value": "noindex, nofollow" }
      ]
    }
"""
    if "community|lounge" not in v:
        if needle not in v:
            raise SystemExit("vercel.json admin header block not found")
        v = v.replace(needle, insert, 1)
        (DEST / "vercel.json").write_text(v)
        print("PATCHED vercel.json")
    else:
        print("vercel.json already has community noindex")

    # Layout SEO (HEAD structure)
    layout = (DEST / "src/components/layout/Layout.jsx").read_text()
    layout = layout.replace(
        "import { getSeoForRoute, webApplicationJsonLd, SITE_ORIGIN } from '../../lib/seoConfig'",
        "import { getSeoForRoute, webApplicationJsonLd, getSiteOgImageUrl, SITE_OG_IMAGE_SIZE, SITE_ORIGIN, organizationJsonLd, webSiteJsonLd, softwareApplicationJsonLd } from '../../lib/seoConfig'",
    )
    layout = layout.replace(
        "  const ogImage = `${SITE_ORIGIN}/icon.png`\n  const shouldNoIndex = useMemo(() => {\n    const p = location.pathname || '/'\n    return (\n      p === '/login'\n      || p === '/signup'\n      || p === '/reset-password'\n      || p === '/forgot-password'\n      || p === '/complete-profile'\n      || p.startsWith('/mypage')\n      || p.startsWith('/admin')\n    )\n  }, [location.pathname])",
        """  const ogImage = getSiteOgImageUrl()
  const shouldNoIndex = useMemo(() => {
    const p = location.pathname || '/'
    return Boolean(seo.noindex)
      || p === '/login'
      || p === '/signup'
      || p === '/reset-password'
      || p === '/forgot-password'
      || p === '/signup-complete'
      || p === '/complete-profile'
      || p.startsWith('/mypage')
      || p.startsWith('/admin')
      || p === '/community'
      || p === '/lounge'
  }, [location.pathname, seo.noindex])
  const homeLdBlocks = useMemo(() => {
    if ((location.pathname || '/') !== '/') return []
    return [
      softwareApplicationJsonLd({
        name: 'MoneyMart',
        url: '/',
        origin: SITE_ORIGIN,
        description: seo.description,
      }),
    ]
  }, [location.pathname, seo.description])""",
    )
    old_helmet_tail = """        <meta property="og:image" content={ogImage} />
        <meta property="og:locale" content="ja_JP" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seo.title} />
        <meta name="twitter:description" content={seo.description} />
        <meta name="twitter:image" content={ogImage} />
        {shouldNoIndex ? <meta name="robots" content="noindex,nofollow" /> : null}
        {seo.isTool && seo.toolName ? (
          <script type="application/ld+json">{JSON.stringify(webApplicationJsonLd(seo.toolName, seo.canonical))}</script>
        ) : null}"""
    new_helmet_tail = """        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content={String(SITE_OG_IMAGE_SIZE.width)} />
        <meta property="og:image:height" content={String(SITE_OG_IMAGE_SIZE.height)} />
        <meta property="og:image:alt" content="MoneyMart" />
        <meta property="og:locale" content="ja_JP" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seo.title} />
        <meta name="twitter:description" content={seo.description} />
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:image:alt" content="MoneyMart" />
        {shouldNoIndex ? <meta name="robots" content="noindex,nofollow" /> : null}
        <script type="application/ld+json">{JSON.stringify(organizationJsonLd(SITE_ORIGIN))}</script>
        <script type="application/ld+json">{JSON.stringify(webSiteJsonLd(SITE_ORIGIN))}</script>
        {seo.isTool && seo.toolName ? (
          <script type="application/ld+json">{JSON.stringify(webApplicationJsonLd(seo.toolName, seo.canonical))}</script>
        ) : null}
        {homeLdBlocks.map((obj, i) => (
          <script key={`ld-home-${i}`} type="application/ld+json">{JSON.stringify(obj)}</script>
        ))}"""
    if old_helmet_tail in layout:
        layout = layout.replace(old_helmet_tail, new_helmet_tail)
        print("PATCHED Layout helmet")
    else:
        print("WARN Layout helmet block not found; import/noindex may still apply")
    (DEST / "src/components/layout/Layout.jsx").write_text(layout)

    # Footer methodology link
    footer = (DEST / "src/components/layout/Footer.jsx").read_text()
    if "legal/methodology" not in footer:
        footer = footer.replace(
            "<li><button onClick={() => navigate('/legal/disclaimer')}",
            "<li><button onClick={() => navigate('/legal/methodology')} className=\"hover:text-white transition flex items-center gap-2\"><FileText size={12} /> 編集・データ方針</button></li>\n                <li><button onClick={() => navigate('/legal/disclaimer')}",
        )
        # mobile strip if present
        if "navigate('/legal/privacy')" in footer and footer.count("legal/methodology") < 2:
            footer = footer.replace(
                "onClick={() => navigate('/legal/privacy')}",
                "onClick={() => navigate('/legal/privacy')}",
                1,
            )
        (DEST / "src/components/layout/Footer.jsx").write_text(footer)
        print("PATCHED Footer")
    else:
        print("Footer already has methodology")

    # LegalPage methodology entry
    legal = (DEST / "src/pages/LegalPage.jsx").read_text()
    if "methodology:" not in legal:
        if "COMPANY_SUPPORT_EMAIL" not in legal.split("const LEGAL_CONTENTS")[0]:
            legal = legal.replace(
                "import { useParams, useNavigate } from 'react-router-dom'",
                "import { useParams, useNavigate, Link } from 'react-router-dom'",
            )
            legal = legal.replace(
                "import { Shield, FileText, Lock, Building, ArrowLeft } from 'lucide-react'",
                "import { Shield, FileText, Lock, Building, ArrowLeft } from 'lucide-react'\nimport { COMPANY_SUPPORT_EMAIL } from '../constants/companyLegal'",
            )
        block = '''  methodology: {
    title: '編集・データ方針',
    icon: FileText,
    content: (
      <div className="space-y-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p className="text-xs text-slate-500">最終更新：2026年9月18日</p>
        <section>
          <h2 className="font-bold text-slate-900 dark:text-white mb-2 text-base">編集の立場</h2>
          <p>
            インサイト記事は MoneyMart 編集部が公開情報を整理して提供します。記事ごとの個人名がデータベースにない場合は「MoneyMart編集部」と表示します。
            一部の文章の下書きにAIを使うことがあります。公開前に編集チームが内容を確認します。本コンテンツは情報提供であり、投資助言ではありません。
          </p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 dark:text-white mb-2 text-base">一次情報の扱い</h2>
          <p>
            信託報酬、分配、制度、企業情報など取引や税務に関わる数値は、各運用会社・取引所・官公庁の公式資料を優先して確認する方針です。
            本サイトの表示と公式資料が異なる場合は、公式資料を正とします。
          </p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 dark:text-white mb-2 text-base">市場データの目安</h2>
          <p>
            価格・騰落率などは、原則として各取引所の前営業日終値（EOD）をもとに更新します。目安として、国内上場は日本時間の午後（おおむね16時頃）、米国上場は翌営業日の日本時間の朝（おおむね8時頃）です。休場や提供元の遅延で前後することがあります。欠測時に推定値で埋めません。
          </p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 dark:text-white mb-2 text-base">訂正・お問い合わせ</h2>
          <p>
            誤りを見つけた場合は、
            <a href={`mailto:${COMPANY_SUPPORT_EMAIL}`} className="font-bold text-orange-600 underline underline-offset-2">{COMPANY_SUPPORT_EMAIL}</a>
            または
            <Link to="/about#about-contact" className="font-bold text-orange-600 underline underline-offset-2">運営会社のお問い合わせ</Link>
            までご連絡ください。確認できた事実に基づき、該当ページの更新を検討します。
          </p>
          <p className="mt-2">関連：<Link to="/legal/disclaimer" className="text-orange-600 underline underline-offset-2">免責事項</Link></p>
        </section>
      </div>
    ),
  },
'''
        # insert before security key
        if "  security: {" in legal:
            legal = legal.replace("  security: {", block + "  security: {", 1)
        else:
            raise SystemExit("LegalPage security key missing")
        (DEST / "src/pages/LegalPage.jsx").write_text(legal)
        print("PATCHED LegalPage")
    else:
        print("LegalPage already has methodology")

    # HomePage H1 + bullets (HEAD guest hero)
    home = (DEST / "src/pages/HomePage.jsx").read_text()
    home = home.replace(
        """                  <span className="text-orange-600 dark:text-orange-400">金融の選択を、</span>
                  <span className="text-orange-500 dark:text-orange-300">もっと</span>
                  <span className="text-red-600 dark:text-red-400">スマートに。</span>""",
        """                  <span className="text-orange-600 dark:text-orange-400">ポートフォリオの</span>
                  <span className="text-orange-500 dark:text-orange-300">偏りを、</span>
                  <span className="text-red-600 dark:text-red-400">見える化する。</span>""",
    )
    # second line of h1 - capture from HEAD
    import re
    m = re.search(
        r'(<span className="block mt-1 sm:mt-1\.5 text-slate-900 dark:text[^>]*>)(.*?)(</span>\s*</h1>)',
        home,
        re.S,
    )
    if m:
        home = home[: m.start()] + m.group(1) + "投信とETFの重なり・集中リスク・新NISA・配当を<span className=\"text-red-500 dark:text-red-400\">ひとつの画面で</span>。" + m.group(3) + home[m.end() :]
        print("PATCHED HomePage H1 subline")
    else:
        print("WARN HomePage H1 subline not found")
    # methodology note after bullets if missing
    if "/legal/methodology" not in home:
        home = home.replace(
            "将来の運用成果を保証するものではありません。",
            "将来の運用成果を保証するものではありません。\n              <Link to=\"/legal/methodology\" className=\"ml-1 font-bold text-orange-600 dark:text-orange-400 underline underline-offset-2\">編集・データ方針</Link>",
            1,
        )
        if "Link " not in home.split("from 'react-router-dom'")[0] and "Link," not in home[:800]:
            home = home.replace(
                "import { useNavigate, useLocation } from 'react-router-dom'",
                "import { useNavigate, useLocation, Link } from 'react-router-dom'",
            )
            home = home.replace(
                "import { useNavigate, useLocation } from \"react-router-dom\"",
                "import { useNavigate, useLocation, Link } from \"react-router-dom\"",
            )
        print("PATCHED HomePage methodology link")
    # overlap bullet if old copy
    home = home.replace(
        "リスク許容度に基づいたポートフォリオ診断をご提供します。ログインして診断を開始してください。",
        "投信とETFの重なり・集中度を確認できます。ログインして診断を開始してください。",
    )
    (DEST / "src/pages/HomePage.jsx").write_text(home)

    # InsightPage: add Helmet JSON-LD + byline on article view if HEAD has no Helmet
    insight = (DEST / "src/pages/InsightPage.jsx").read_text()
    if "articleJsonLd" not in insight:
        if "from 'react-helmet-async'" not in insight and 'from "react-helmet-async"' not in insight:
            insight = insight.replace(
                "import { Link, useParams } from 'react-router-dom'",
                "import { Helmet } from 'react-helmet-async'\nimport { Link, useParams } from 'react-router-dom'",
            )
        if "articleJsonLd" not in insight.split("function")[0]:
            insight = insight.replace(
                "from '../lib/insightHtml'\n",
                "from '../lib/insightHtml'\nimport { articleJsonLd, breadcrumbListJsonLd, EDITORIAL_AUTHOR_NAME, getSiteOgImageUrl } from '../lib/seoConfig'\n",
                1,
            )
        # inject helmet+byline before article view return if we can find a stable marker
        marker = None
        for cand in [
            "return (\n    <div className={`relative",
            "return (\n    <>\n      <div className={`relative",
            'return (\n    <div className="relative bg-[#f6f4ef] dark:bg-slate-950">',
        ]:
            if cand in insight:
                marker = cand
                break
        if marker:
            helmet = """return (
    <>
      <Helmet>
        <title>{`${row.pageTitle} | MoneyMart`}</title>
        <meta name="description" content={articleDesc} />
        <link rel="canonical" href={articleCanonical} />
        <script type="application/ld+json">
          {JSON.stringify(articleJsonLd(SITE_ORIGIN, {
            headline: row.pageTitle,
            description: articleDesc,
            url: articleCanonical,
            datePublished: row.publishedAt || undefined,
            dateModified: row.updatedAt || row.publishedAt || undefined,
            image: articleOgImage,
          }))}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbListJsonLd(SITE_ORIGIN, [
            { name: 'ホーム', path: '/' },
            { name: 'インサイト', path: '/insights' },
            { name: row.pageTitle, path: `/insights/${String(row.slug || '').trim()}` },
          ]))}
        </script>
      </Helmet>
      <div className="mx-auto max-w-3xl px-5 pt-4 text-xs text-stone-500">
        <p>
          <span className="font-bold">{EDITORIAL_AUTHOR_NAME}</span>
          {' · '}公開 {formatDate(row.publishedAt)}
          {row.updatedAt ? ` · 更新 ${formatDate(row.updatedAt)}` : ''}
          {' · '}
          <Link to="/legal/methodology" className="font-bold underline underline-offset-2">編集・データ方針</Link>
        </p>
      </div>
"""
            # Keep original inner div by replacing only the opening return wrapper
            insight = insight.replace(marker, helmet + marker.split("return (\n")[-1], 1)
            # need articleDesc/canonical vars — add before return if missing
            print("PATCHED InsightPage return wrapper")
        else:
            print("WARN InsightPage return marker not found")
        # add derived SEO vars near articleTheme if present
        if "const articleTheme" in insight and "articleCanonical" not in insight:
            insight = insight.replace(
                "const articleTheme",
                """const articleCanonical = `${SITE_ORIGIN}/insights/${String(row.slug || '').trim()}`
  const articleDesc = (typeof buildPreviewText === 'function' ? buildPreviewText(row) : String(row.pageTitle || '')).slice(0, 160)
  const articleOgImage = getSiteOgImageUrl()
  const articleTheme""",
                1,
            )
        (DEST / "src/pages/InsightPage.jsx").write_text(insight)
        print("WROTE InsightPage")
    else:
        print("InsightPage already has articleJsonLd")

    # ToolLanding extra links
    tool = (DEST / "src/pages/ToolLandingPage.jsx").read_text()
    if "/legal/methodology" not in tool:
        if "Link" not in tool[:400]:
            pass
        # append links before last closing of main card
        if "MM_SIMULATION_PAST_PERFORMANCE_JA" in tool and "nisa-etf-checklist" not in tool:
            tool = tool.replace(
                "{MM_SIMULATION_PAST_PERFORMANCE_JA}</p>",
                """{MM_SIMULATION_PAST_PERFORMANCE_JA}</p>
          <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold">
            <Link to="/etf-compare" className="text-orange-600 dark:text-orange-400 hover:underline">ETF比較で重複を確認</Link>
            <Link to="/tools/nisa-etf-checklist" className="text-orange-600 dark:text-orange-400 hover:underline">NISAチェックリスト</Link>
            <Link to="/legal/methodology" className="text-slate-500 dark:text-slate-400 hover:underline">編集・データ方針</Link>
          </div>""",
                1,
            )
            (DEST / "src/pages/ToolLandingPage.jsx").write_text(tool)
            print("PATCHED ToolLandingPage")
        else:
            print("WARN ToolLanding patch skipped")
    else:
        print("ToolLanding already patched")

    # insightToolLinks NISA entries
    itl_path = DEST / "src/lib/insightToolLinks.js"
    itl = itl_path.read_text()
    if "nisa-etf-checklist" not in itl:
        itl = itl.replace(
            "  ['市場インジケーター', '/market-indicator'],",
            "  ['市場インジケーター', '/market-indicator'],\n  ['NISAチェックリスト', '/tools/nisa-etf-checklist'],\n  ['NISA・ETF', '/tools/nisa-etf-checklist'],",
        )
        itl = itl.replace(
            "  ['/tools', 'ポートフォリオ最適化'],",
            "  ['/tools', 'ポートフォリオ最適化'],\n  ['/tools/nisa-etf-checklist', 'NISA・ETFチェックリスト'],",
        )
        itl_path.write_text(itl)
        print("PATCHED insightToolLinks")
    else:
        print("insightToolLinks already has NISA")

    print("DONE overlay")


if __name__ == "__main__":
    main()
