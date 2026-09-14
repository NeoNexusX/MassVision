import { t } from '@/i18n'

/**
 * 用户身份的显示文字。identity 是后端取值（'admin' / 'user'），原样用于判断与提交；
 * 这里只负责界面显示，未知取值原样返回。在 computed / 模板里调用才会随语言切换刷新。
 */
export function identityLabel(identity: string | null | undefined): string {
  if (identity === 'admin') return t('users.identity.admin')
  if (identity === 'user') return t('users.identity.user')
  return identity ?? ''
}
