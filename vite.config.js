import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createClient } from '@supabase/supabase-js'
import portfolioDiagnosisHandler from './api/portfolio-diagnosis.js'
import aiNewsCronHandler from './api/cron/ai-news.js'
import contactHandler from './api/contact.js'
import appleVerifySubscriptionHandler from './api/apple/verify-subscription.js'
import payjpCreateSubscriptionHandler from './api/billing/payjp/create-subscription.js'
import payjpCancelSubscriptionHandler from './api/billing/payjp/cancel-subscription.js'
import payjpWebhookHandler from './api/billing/payjp/webhook.js'
import payjpPublicConfigHandler from './api/billing/payjp/public-config.js'
import payjpPlanConfigHandler from './api/billing/payjp/plan-config.js'
import campaignCp2026SnsSepHandler from './api/campaign/cp2026-sns-sep.js'
import chatbotHandler from './api/chatbot.js'
import loungeDigestHandler from './api/cron/lounge-digest.js'
import fxHandler from './api/fx.js'
import fearGreedHandler from './api/fear-greed.js'
import newsTranslateJaHandler from './api/news-translate-ja.js'
import storagePublicImageHandler from './api/proxy/storage-public-image.js'

const CHAT_SYSTEM_PROMPT = 'You are MoneyMart AI assistant. Respond in Japanese by default. Keep answers concise and practical for personal finance users. Do not provide legal/tax guarantees. Suggest users verify latest official sources. If asked about unavailable account-specific data, state limitation clearly.'

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

/** Parse query string for Vite dev middleware (no Express req.query). */
function queryFromNodeReq(req) {
  const raw = String(req.url || '').split('?')[1] || ''
  return Object.fromEntries(new URLSearchParams(raw))
}

function makeExpressStyleResponse(nodeRes) {
  return {
    status(code) {
      this._code = code
      return this
    },
    json(body) {
      sendJson(nodeRes, this._code ?? 200, body)
    },
  }
}

/** Inject Microsoft Clarity in index.html so setup verification + first paint both see the tag. */
function clarityIndexHtmlPlugin(runtimeEnv) {
  const projectId = String(runtimeEnv.VITE_CLARITY_PROJECT_ID || '').trim()
  const excludedPrefixes = ['/mypage', '/admin', '/reset-password', '/forgot-password']
  const guard = excludedPrefixes
    .map((p) => `p==='${p}'||p.indexOf('${p}/')===0`)
    .join('||')

  return {
    name: 'clarity-index-html',
    transformIndexHtml(html) {
      if (!projectId) return html
      const snippet = `<script type="text/javascript">(function(){var p=(location.pathname||'/').toLowerCase();if(${guard})return;(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;t.setAttribute("data-mm-clarity","1");y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${projectId}");})();</script>`
      return html.replace('</head>', `    ${snippet}\n  </head>`)
    },
  }
}

function localChatApiPlugin(runtimeEnv) {
  return {
    name: 'local-chat-api',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res, next) => {
        if (req.method !== 'POST') return next()

        try {
          const body = await parseJsonBody(req)
          const message = String(body?.message || '').trim()
          if (!message) return sendJson(res, 400, { error: 'message is required' })
          const messages = Array.isArray(body?.messages) ? body.messages : []

          const ollamaBase = String(runtimeEnv.OLLAMA_BASE_URL || runtimeEnv.VITE_OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL || process.env.VITE_OLLAMA_BASE_URL || '').trim()
          if (!ollamaBase) {
            return sendJson(res, 503, { error: 'OLLAMA_BASE_URL を設定してください。チャットは自社AI（Ollama）のみ利用可能です。' })
          }
          const ollamaModel = String(runtimeEnv.OLLAMA_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct').trim()
          const recent = messages.slice(-10)
          const ollamaMessages = [
            { role: 'system', content: CHAT_SYSTEM_PROMPT },
            ...recent.map((m) => ({
              role: m?.sender === 'bot' ? 'assistant' : 'user',
              content: String(m?.text || '').trim(),
            })),
            { role: 'user', content: message },
          ].filter((m) => m.content !== '')
          const url = `${ollamaBase.replace(/\/$/, '')}/v1/chat/completions`
          const ollamaRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: ollamaModel,
              messages: ollamaMessages,
              stream: false,
              max_tokens: 420,
              temperature: 0.4,
            }),
          })
          if (ollamaRes.ok) {
            const ollamaData = await ollamaRes.json()
            const reply = String(ollamaData?.choices?.[0]?.message?.content || '').trim()
            if (reply) return sendJson(res, 200, { reply })
          }
          return sendJson(res, 503, { error: 'AIが一時的に利用できません。Ollamaが起動しているか確認してください。' })
        } catch (error) {
          return sendJson(res, 500, { error: error?.message || 'Unexpected error' })
        }
      })

      server.middlewares.use('/api/fx', async (req, res, next) => {
        if (req.method !== 'GET') return next()
        ;['SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'FX_READ_USDJPY_FROM_DB'].forEach((k) => {
          if (!process.env[k] && runtimeEnv[k]) process.env[k] = runtimeEnv[k]
        })
        if (!process.env.FX_TWELVEDATA_API_KEY && runtimeEnv.FX_TWELVEDATA_API_KEY) {
          process.env.FX_TWELVEDATA_API_KEY = runtimeEnv.FX_TWELVEDATA_API_KEY
        }
        if (!process.env.FX_FALLBACK_USDJPY && runtimeEnv.FX_FALLBACK_USDJPY) {
          process.env.FX_FALLBACK_USDJPY = runtimeEnv.FX_FALLBACK_USDJPY
        }
        const mockReq = { method: 'GET', query: queryFromNodeReq(req) }
        return fxHandler(mockReq, makeExpressStyleResponse(res))
      })

      server.middlewares.use('/api/fear-greed', async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'OPTIONS') return next()
        ;['SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'VITE_SUPABASE_ANON_KEY'].forEach((k) => {
          if (!process.env[k] && runtimeEnv[k]) process.env[k] = runtimeEnv[k]
        })
        const mockReq = { method: req.method || 'GET', query: queryFromNodeReq(req) }
        return fearGreedHandler(mockReq, makeExpressStyleResponse(res))
      })

      server.middlewares.use('/api/portfolio-diagnosis', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        const copy = (k) => {
          if (!process.env[k] && runtimeEnv[k]) process.env[k] = runtimeEnv[k]
        }
        copy('SUPABASE_URL')
        copy('VITE_SUPABASE_URL')
        copy('SUPABASE_SERVICE_ROLE_KEY')
        copy('SUPABASE_SECRET_KEY')
        if (!process.env.ANTHROPIC_API_KEY && runtimeEnv.ANTHROPIC_API_KEY) {
          process.env.ANTHROPIC_API_KEY = runtimeEnv.ANTHROPIC_API_KEY
        }
        if (!process.env.CLAUDE_API_KEY && runtimeEnv.CLAUDE_API_KEY) {
          process.env.CLAUDE_API_KEY = runtimeEnv.CLAUDE_API_KEY
        }
        return portfolioDiagnosisHandler(req, res)
      })

      server.middlewares.use('/api/cron/ai-news', async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'POST') return next()
        if (!process.env.ANTHROPIC_API_KEY && runtimeEnv.ANTHROPIC_API_KEY) {
          process.env.ANTHROPIC_API_KEY = runtimeEnv.ANTHROPIC_API_KEY
        }
        if (!process.env.CLAUDE_API_KEY && runtimeEnv.CLAUDE_API_KEY) {
          process.env.CLAUDE_API_KEY = runtimeEnv.CLAUDE_API_KEY
        }
        if (!process.env.SUPABASE_URL && runtimeEnv.SUPABASE_URL) process.env.SUPABASE_URL = runtimeEnv.SUPABASE_URL
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY && runtimeEnv.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = runtimeEnv.SUPABASE_SERVICE_ROLE_KEY
        if (!process.env.SUPABASE_SECRET_KEY && runtimeEnv.SUPABASE_SECRET_KEY) process.env.SUPABASE_SECRET_KEY = runtimeEnv.SUPABASE_SECRET_KEY
        if (!process.env.THENEWSAPI_API_TOKEN && runtimeEnv.THENEWSAPI_API_TOKEN) process.env.THENEWSAPI_API_TOKEN = runtimeEnv.THENEWSAPI_API_TOKEN
        if (!process.env.THE_NEWS_API_TOKEN && runtimeEnv.THE_NEWS_API_TOKEN) process.env.THE_NEWS_API_TOKEN = runtimeEnv.THE_NEWS_API_TOKEN
        if (!process.env.CRON_SECRET && runtimeEnv.CRON_SECRET) process.env.CRON_SECRET = runtimeEnv.CRON_SECRET
        return aiNewsCronHandler(req, res)
      })

      server.middlewares.use('/api/contact', async (req, res, next) => {
        if (req.method !== 'POST' && req.method !== 'OPTIONS') return next()
        if (!process.env.RESEND_API_KEY && runtimeEnv.RESEND_API_KEY) process.env.RESEND_API_KEY = runtimeEnv.RESEND_API_KEY
        if (!process.env.RESEND_FROM && runtimeEnv.RESEND_FROM) process.env.RESEND_FROM = runtimeEnv.RESEND_FROM
        return contactHandler(req, res)
      })

      server.middlewares.use('/api/chatbot', async (req, res, next) => {
        if (req.method !== 'POST' && req.method !== 'OPTIONS') return next()
        if (!process.env.ANTHROPIC_API_KEY && runtimeEnv.ANTHROPIC_API_KEY) {
          process.env.ANTHROPIC_API_KEY = runtimeEnv.ANTHROPIC_API_KEY
        }
        return chatbotHandler(req, res)
      })

      server.middlewares.use('/api/news-translate-ja', async (req, res, next) => {
        if (req.method !== 'POST' && req.method !== 'OPTIONS') return next()
        const copy = (k) => {
          if (!process.env[k] && runtimeEnv[k]) process.env[k] = runtimeEnv[k]
        }
        copy('GEMINI_API_KEY')
        copy('GOOGLE_AI_API_KEY')
        copy('GOOGLE_API_KEY')
        copy('AI_NEWS_GEMINI_MODEL')
        copy('GEMINI_MODEL')
        copy('ANTHROPIC_API_KEY')
        copy('CLAUDE_API_KEY')
        copy('ANTHROPIC_MODEL')
        copy('ANTHROPIC_CHATBOT_MODEL')
        return newsTranslateJaHandler(req, res)
      })

      server.middlewares.use('/api/proxy/storage-public-image', async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        const copy = (k) => {
          if (!process.env[k] && runtimeEnv[k]) process.env[k] = runtimeEnv[k]
        }
        copy('SUPABASE_URL')
        copy('VITE_SUPABASE_URL')
        return storagePublicImageHandler(req, res)
      })

      server.middlewares.use('/api/apple/verify-subscription', async (req, res, next) => {
        if (req.method !== 'POST' && req.method !== 'OPTIONS') return next()
        const copy = (k) => {
          if (!process.env[k] && runtimeEnv[k]) process.env[k] = runtimeEnv[k]
        }
        copy('SUPABASE_URL')
        copy('VITE_SUPABASE_URL')
        copy('SUPABASE_ANON_KEY')
        copy('VITE_SUPABASE_ANON_KEY')
        copy('SUPABASE_SERVICE_ROLE_KEY')
        copy('SUPABASE_SECRET_KEY')
        copy('APPLE_ISSUER_ID')
        copy('APPLE_KEY_ID')
        copy('APPLE_PRIVATE_KEY')
        copy('APPLE_BUNDLE_ID')
        copy('APPLE_APP_STORE_SERVER_ENV')
        copy('APPLE_IAP_PRODUCT_IDS')
        copy('APPLE_APP_STORE_AUDIENCE')
        return appleVerifySubscriptionHandler(req, res)
      })

      const copyPayjpEnv = (k) => {
        if (!process.env[k] && runtimeEnv[k]) process.env[k] = runtimeEnv[k]
      }
      const copyPayjpBillingEnv = () => {
        ;[
          'SUPABASE_URL',
          'VITE_SUPABASE_URL',
          'SUPABASE_ANON_KEY',
          'VITE_SUPABASE_ANON_KEY',
          'SUPABASE_SERVICE_ROLE_KEY',
          'SUPABASE_SECRET_KEY',
          'PAYJP_SECRET_KEY',
          'PAYJP_PUBLIC_KEY',
          'VITE_PAYJP_PUBLIC_KEY',
          'PAYJP_PLAN_ID_MONTHLY',
          'PAYJP_PLAN_ID_ANNUAL',
          'PAYJP_WEBHOOK_TOKEN',
        ].forEach(copyPayjpEnv)
      }

      server.middlewares.use('/api/billing/payjp/public-config', async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        copyPayjpBillingEnv()
        return payjpPublicConfigHandler(req, res)
      })

      server.middlewares.use('/api/billing/payjp/plan-config', async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        copyPayjpBillingEnv()
        return payjpPlanConfigHandler(req, res)
      })

      server.middlewares.use('/api/billing/payjp/create-subscription', async (req, res, next) => {
        if (req.method !== 'POST' && req.method !== 'OPTIONS') return next()
        copyPayjpBillingEnv()
        return payjpCreateSubscriptionHandler(req, res)
      })

      server.middlewares.use('/api/billing/payjp/cancel-subscription', async (req, res, next) => {
        if (req.method !== 'POST' && req.method !== 'OPTIONS') return next()
        copyPayjpBillingEnv()
        return payjpCancelSubscriptionHandler(req, res)
      })

      server.middlewares.use('/api/campaign/cp2026-sns-sep', async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'OPTIONS') return next()
        copyPayjpBillingEnv()
        if (!process.env.CAMPAIGN_CP2026_SNS_PREVIEW && runtimeEnv.CAMPAIGN_CP2026_SNS_PREVIEW) {
          process.env.CAMPAIGN_CP2026_SNS_PREVIEW = runtimeEnv.CAMPAIGN_CP2026_SNS_PREVIEW
        }
        return campaignCp2026SnsSepHandler(req, res)
      })

      server.middlewares.use('/api/billing/payjp/webhook', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        copyPayjpBillingEnv()
        return payjpWebhookHandler(req, res)
      })

      server.middlewares.use('/api/account/delete', async (req, res, next) => {
        if (req.method !== 'POST') return next()

        const supabaseUrl = runtimeEnv.SUPABASE_URL || process.env.SUPABASE_URL || runtimeEnv.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
        const serviceRole = runtimeEnv.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        if (!supabaseUrl || !serviceRole) {
          return sendJson(res, 500, { ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env' })
        }

        const authHeader = req.headers.authorization || ''
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
        if (!token) return sendJson(res, 401, { ok: false, error: 'Unauthorized' })

        try {
          const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } })
          const { data: userData, error: userErr } = await admin.auth.getUser(token)
          if (userErr || !userData?.user?.id) return sendJson(res, 401, { ok: false, error: 'Invalid token' })

          const userId = userData.user.id
          const cleanupTables = [
            'user_expenses',
            'user_insurances',
            'user_asset_positions',
            'user_point_accounts',
            'user_finance_profiles',
            'user_owned_stocks',
            'user_owned_funds',
            'user_revolving_profiles',
            'user_revolving_debts',
            'refinance_simulations',
            'user_tax_shield_profiles',
            'tax_shield_simulations',
            'user_cashflow_optimizer_profiles',
            'cashflow_optimizer_simulations',
            'user_watchlists',
            'user_premium_entitlements',
            'lounge_posts',
            'lounge_post_likes',
            'lounge_post_bookmarks',
            'lounge_post_comments',
            'community_posts',
            'post_engagements',
          ]

          for (const table of cleanupTables) {
            const { error } = await admin.from(table).delete().eq('user_id', userId)
            if (error && !String(error.message || '').toLowerCase().includes('does not exist')) {
              // best-effort cleanup
            }
          }

          const { error: deleteErr } = await admin.auth.admin.deleteUser(userId)
          if (deleteErr) return sendJson(res, 500, { ok: false, error: deleteErr.message || 'Failed to delete user' })

          return sendJson(res, 200, { ok: true })
        } catch (error) {
          return sendJson(res, 500, { ok: false, error: error?.message || 'account deletion failed' })
        }
      })

      server.middlewares.use('/api/cron/lounge-digest', async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'POST') return next()
        if (!process.env.SUPABASE_URL && runtimeEnv.SUPABASE_URL) process.env.SUPABASE_URL = runtimeEnv.SUPABASE_URL
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY && runtimeEnv.SUPABASE_SERVICE_ROLE_KEY) {
          process.env.SUPABASE_SERVICE_ROLE_KEY = runtimeEnv.SUPABASE_SERVICE_ROLE_KEY
        }
        if (!process.env.CRON_SECRET && runtimeEnv.CRON_SECRET) process.env.CRON_SECRET = runtimeEnv.CRON_SECRET
        return loungeDigestHandler(req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), clarityIndexHtmlPlugin(env), localChatApiPlugin(env)],
    server: {
      port: 5178,
      strictPort: false,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('plotly.js')) return 'plotly'
            if (id.includes('recharts')) return 'recharts'
            if (id.includes('@supabase')) return 'supabase'
          },
        },
      },
    },
  }
})
