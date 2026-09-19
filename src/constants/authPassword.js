/** メール登録・パスワード再設定の最小長（Supabase Auth の minimum length と揃える） */
export const MIN_PASSWORD_LENGTH = 6

export const PASSWORD_MIN_LENGTH_MESSAGE = `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。`

export const isPasswordLongEnough = (password) =>
  String(password || '').length >= MIN_PASSWORD_LENGTH
