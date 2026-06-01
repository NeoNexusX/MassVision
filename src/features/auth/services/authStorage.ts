import CryptoJS from 'crypto-js'
import { STORAGE_KEYS } from '@/shared/config'

export const secureStorage = {
  hashPassword(password: string): string {
    return CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex)
  },

  clearAuthData() {
    window.localStorage.removeItem(STORAGE_KEYS.accessToken)
    window.localStorage.removeItem(STORAGE_KEYS.userDetails)
  },

  // Store user details
  storeUserInfo(userInfo: any) {
    localStorage.setItem(STORAGE_KEYS.userDetails, JSON.stringify(userInfo))
  },

  // Retrieve Token
  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.accessToken)
  },
}
