import CryptoJS from 'crypto-js'

export const secureStorage = {
  hashPassword(password: string): string {
    return CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex)
  },

  clearAuthData() {
    window.localStorage.removeItem('access_token')
    window.localStorage.removeItem('user_details')
  },

  // Store user details
  storeUserInfo(userInfo: any) {
    localStorage.setItem('user_details', JSON.stringify(userInfo))
  },

  // Retrieve Token
  getToken(): string | null {
    return localStorage.getItem('access_token')
  },
}
