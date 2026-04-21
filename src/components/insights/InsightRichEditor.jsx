/* eslint-disable react-hooks/refs -- toolbar onClick handlers only; ref is read inside handlers, not during render */
import { useCallback, useEffect, useRef } from 'react'
import { INSIGHT_SPLIT_HR, sanitizeInsightBodyHtml } from '../../lib/insightHtml'

function normalizeEmptyEditorHtml(html) {
  const h = String(html || '')
    .replace(/\u00a0/g, ' ')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<\/?p[^>]*>/gi, '')
    .replace(/\s+/g, '')
    .toLowerCase()
  if (!h) return ''
  return String(html || '')
}

const BTN =
  'rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-slate-700 active:bg-slate-900 disabled:opacity-40'

function exec(cmd, value = null) {
  try {
    document.execCommand(cmd, false, value)
  } catch {
    /* ignore */
  }
}

function wrapSelectionWithClass(className) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (range.collapsed) return
  const span = document.createElement('span')
  span.className = className
  try {
    range.surroundContents(span)
  } catch {
    const frag = range.extractContents()
    span.appendChild(frag)
    range.insertNode(span)
  }
  sel.removeAllRanges()
  const nr = document.createRange()
  nr.selectNodeContents(span)
  nr.collapse(false)
  sel.addRange(nr)
}

/**
 * Admin-only rich editor for insight main body (thesis + rationale).
 * Split thesis / rationale with INSIGHT_SPLIT_HR via toolbar.
 */
export default function InsightRichEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null)
  /** null = never synced from props (mount). */
  const lastSyncedRef = useRef(null)

  const emit = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const raw = el.innerHTML
    const normalized = normalizeEmptyEditorHtml(raw)
    const out = normalized === '' ? '' : raw
    lastSyncedRef.current = out
    onChange(out)
  }, [onChange])

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const unchanged = lastSyncedRef.current !== null && value === lastSyncedRef.current
    if (unchanged) return
    lastSyncedRef.current = value
    const next = String(value || '').trim()
    el.innerHTML = next || '<p><br></p>'
  }, [value])

  const onInput = () => {
    emit()
  }

  const onPaste = (e) => {
    const html = e.clipboardData?.getData('text/html') ?? ''
    const plain = e.clipboardData?.getData('text/plain') ?? ''
    if (html && /<(img|a|p|figure)\b/i.test(html)) {
      e.preventDefault()
      const clean = sanitizeInsightBodyHtml(html)
      if (clean.trim()) {
        document.execCommand('insertHTML', false, clean)
        emit()
        return
      }
    }
    e.preventDefault()
    exec('insertText', plain)
    emit()
  }

  const insertImageByUrl = () => {
    const raw = typeof window !== 'undefined' ? window.prompt('画像URL（https:// またはサイト内パス / で開始）') : ''
    const url = String(raw || '').trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url) && !(url.startsWith('/') && !url.startsWith('//'))) {
      window.alert('https:// または / から始まるURLを入力してください。')
      return
    }
    const safe = url.replace(/"/g, '&quot;').replace(/</g, '')
    exec('insertHTML', `<p><img src="${safe}" alt="" loading="lazy" decoding="async" /></p>`)
    emit()
  }

  const toolbarBtn = (label, action) => (
    <button
      key={label}
      type="button"
      className={BTN}
      onMouseDown={(e) => e.preventDefault()}
      onClick={action}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col border-0 bg-white dark:bg-gray-900">
      <div
        className="shrink-0 border-b-2 border-amber-500 bg-gradient-to-b from-amber-100 to-amber-50 dark:from-amber-950 dark:to-amber-950/80 dark:border-amber-600 px-3 py-2.5"
        data-mm-insight-toolbar
      >
        <p className="mb-2 text-[11px] font-black tracking-[0.12em] text-amber-950 dark:text-amber-200 uppercase">
          書式ツールバー
        </p>
        <p className="mb-2 text-[11px] font-medium leading-snug text-amber-900/90 dark:text-amber-100/90">
          太字・箇条書き・番号付き・文字の大きさ・フォント。テーゼと根拠を分ける線は「テーゼ/根拠の区切り」。
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
        {toolbarBtn('太字', () => {
          exec('bold')
          emit()
        })}
        {toolbarBtn('斜体', () => {
          exec('italic')
          emit()
        })}
        {toolbarBtn('箇条書き', () => {
          exec('insertUnorderedList')
          emit()
        })}
        {toolbarBtn('番号', () => {
          exec('insertOrderedList')
          emit()
        })}
        <span className="mx-1 w-px h-6 bg-amber-800/25 dark:bg-amber-400/30 shrink-0" aria-hidden />
        {toolbarBtn('小', () => {
          wrapSelectionWithClass('insight-fs-sm')
          emit()
        })}
        {toolbarBtn('大', () => {
          wrapSelectionWithClass('insight-fs-lg')
          emit()
        })}
        <span className="mx-1 w-px h-6 bg-amber-800/25 dark:bg-amber-400/30 shrink-0" aria-hidden />
        {toolbarBtn('ゴシック', () => {
          wrapSelectionWithClass('insight-ff-sans')
          emit()
        })}
        {toolbarBtn('明朝', () => {
          wrapSelectionWithClass('insight-ff-serif')
          emit()
        })}
        {toolbarBtn('等幅', () => {
          wrapSelectionWithClass('insight-ff-mono')
          emit()
        })}
        <span className="mx-1 w-px h-6 bg-amber-800/25 dark:bg-amber-400/30 shrink-0" aria-hidden />
        {toolbarBtn('テーゼ/根拠の区切り', () => {
          exec('insertHTML', INSIGHT_SPLIT_HR)
          emit()
        })}
        <span className="mx-1 w-px h-6 bg-amber-800/25 dark:bg-amber-400/30 shrink-0" aria-hidden />
        {toolbarBtn('画像(URL)', () => {
          insertImageByUrl()
        })}
        </div>
      </div>
      <div
        ref={editorRef}
        className="insight-rich-editor-html min-h-[320px] w-full max-w-none px-4 py-3 text-sm leading-relaxed text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="インサイト本文"
        data-placeholder={placeholder || ''}
        onInput={onInput}
        onBlur={onInput}
        onPaste={onPaste}
      />
      <style>{`
        .insight-rich-editor-html:empty:before {
          content: attr(data-placeholder);
          color: rgb(100 116 139);
          pointer-events: none;
        }
        .insight-rich-editor-html hr.mm-insight-split {
          border: none;
          border-top: 2px dashed rgb(245 158 11);
          margin: 14px 0;
        }
        .insight-rich-editor-html .insight-fs-sm { font-size: 0.875rem; line-height: 1.75; }
        .insight-rich-editor-html .insight-fs-lg { font-size: 1.125rem; line-height: 1.85; }
        .insight-rich-editor-html .insight-ff-serif { font-family: ui-serif, "Hiragino Mincho ProN", "Yu Mincho", serif; }
        .insight-rich-editor-html .insight-ff-mono { font-family: ui-monospace, monospace; }
        .insight-rich-editor-html .insight-ff-sans { font-family: inherit; }
        .insight-rich-editor-html ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
        .insight-rich-editor-html ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
        .insight-rich-editor-html li { margin: 0.25rem 0; }
        .insight-rich-editor-html p { margin: 0 0 0.5rem 0; min-height: 1em; }
      `}</style>
    </div>
  )
}
