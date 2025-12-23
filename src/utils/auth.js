import CryptoJS from 'crypto-js';

export const secureStorage = {
  hashPassword(password) {
    return CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex);
  },

  storeAuthData(token, user) {
    window.localStorage.setItem('jwtToken', token);
    window.localStorage.setItem('user', JSON.stringify(user));
  },

  clearAuthData() {
    window.localStorage.removeItem('jwtToken');
    window.localStorage.removeItem('user');
  },
  // 存储完整用户信息 
  storeUserInfo(userInfo) {
    localStorage.setItem('user_details', JSON.stringify(userInfo));
  },

  // 获取 Token 
  getToken() {
    return localStorage.getItem('auth_token');
  }

};