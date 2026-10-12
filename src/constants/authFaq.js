/** Google ログイン / Supabase 認証 — FAQ・チャットボット共通 */

export const GOOGLE_LOGIN_FAQ = {
  q: 'Googleログインで「supabase.co」と表示されます。安全ですか？',
  a:
    'ウェブブラウザから「Googleでログイン／登録」を選ぶと、Google の公式画面でアカウントを選びます。その際、'
    + '「○○.supabase.co に続行」のように **Supabase（スーパーベース）** のドメイン名が一瞬表示されることがあります。\n\n'
    + 'これは MoneyMart が会員認証（ログイン・新規登録）の基盤として **Supabase Auth** という業界標準の認証サービスを利用しているためです。'
    + 'パスワードや Google のログイン情報は MoneyMart のサーバーに平文で保存されるのではなく、Supabase 経由で安全に処理されます。'
    + '通信は SSL/TLS で暗号化されています。\n\n'
    + 'Google 画面の次のステップでは、**MoneyMart** のアプリ名・ロゴが表示される場合があります。'
    + 'ログイン完了後は **www.moneymart.co.jp** に戻ります。\n\n'
    + '心当たりのない Google アカウントでログインした場合は、Google アカウント設定から MoneyMart との連携を解除できます。'
    + '不審な画面（Google 以外の見慣れないドメインのみ、など）が表示された場合はログインを中止し、お問い合わせください。',
}

export const GOOGLE_LOGIN_CHATBOT_CONTEXT = [
  'Web signup/login: Google OAuth is offered alongside email/password.',
  'Google account picker may briefly show "continue to <project>.supabase.co" — this is normal because MoneyMart uses Supabase Auth (industry-standard hosted authentication), not because credentials are sent to an unknown site.',
  'After Google auth, users return to moneymart.co.jp. Passwords are not stored in plain text on MoneyMart servers.',
  'The next Google consent screen may show the MoneyMart app name/logo if configured in Google Cloud branding.',
  'If users ask if supabase.co is safe/phishing: explain Supabase Auth is a known BaaS auth provider used by many apps; they should only proceed on official Google sign-in pages and land back on moneymart.co.jp.',
].join(' ')
