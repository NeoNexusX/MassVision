import { STORAGE_KEYS } from '@/shared/config'

/**
 * 鉴权相关的本地存储出入口（token / 用户信息）。
 *
 * 这是 token 读写的**唯一抽象层**：authStore、路由守卫等都应通过它存取，
 * 不要再各自直接 `localStorage.getItem/setItem(STORAGE_KEYS.accessToken)`。
 * 如此将来要换成 cookie / sessionStorage / 内存态，只需改本文件一处。
 *
 * 注意：token 与用户信息是**明文**存放，并非加密存储——
 * 故不要据此假定 token 在本地是安全的。
 */
export const authStorage = {
  /** 写入 access token —— 登录成功后唯一的写入入口 */
  setToken(token: string) {
    localStorage.setItem(STORAGE_KEYS.accessToken, token)
  },

  /** 读取 access token */
  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.accessToken)
  },

  /** 存储用户信息 */
  storeUserInfo(userInfo: unknown) {
    localStorage.setItem(STORAGE_KEYS.userDetails, JSON.stringify(userInfo))
  },

  /** 清除全部鉴权数据（登出 / token 失效时调用） */
  clearAuthData() {
    localStorage.removeItem(STORAGE_KEYS.accessToken)
    localStorage.removeItem(STORAGE_KEYS.userDetails)
  },
}
