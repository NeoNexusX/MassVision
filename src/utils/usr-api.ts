import { auth_api, api } from './api'
import type { UsrSignup, UsrLogin } from '../types/usr'


// 登录接口 - 使用 x-www-form-urlencoded 格式
export async function login(usr: UsrLogin) {
  const params = new URLSearchParams()
  params.append('username', usr.username)
  params.append('password', usr.password)
  params.append('grant_type', 'password')

  return api.post('/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
}


// 注册接口
export async function usrSignupApi(usr: UsrSignup) {
  return api.post('/user_signup', usr)
}

// 发送验证码接口
export async function sendEmailCode(email: string) {
  const payload = {
    email: email, // 邮箱地址
    send_time: new Date().toISOString() // 发送时间，可选，默认当前时间
  }

  return api.post('/emailsmtprequest', payload)
}

// 获取当前用户信息
export async function getCurrentUser() {
  return auth_api.get('/user')
}

// 登出接口
export async function logoutApi() {
  return auth_api.post('/logout')
}

// 更新用户信息 (Institution, Research Field etc.)
export async function updateUserProfile(data: any) {
  return auth_api.patch('/user', data)
}

// 更新账户信息 (Username, Email, Password)
export async function updateUserInfo(data: any) {
  return auth_api.post('/user_change', data)
}
