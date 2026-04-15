import { auth_api, api } from './api'
import type { UsrSignup, UsrLogin, UsrProfile, UsrProfileUpdate } from '../types/usr'


// Login endpoint - using x-www-form-urlencoded
export async function login(usr: UsrLogin) {
  const params = new URLSearchParams()
  params.append('username', usr.username)
  params.append('password', usr.password)
  params.append('grant_type', 'password')

  return api.post('/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
}


// Signup endpoint
export async function usrSignupApi(usr: UsrSignup) {
  return api.post('/user_signup', usr)
}

// Send verification code endpoint
export async function sendEmailCode(email: string, purpose: string = 'register') {
  const payload = {
    email: email,
    send_time: new Date().toISOString(),
    purpose: purpose
  }

  return api.post('/emailsmtprequest', payload)
}

// Get current user info
export async function getCurrentUser() {
  return auth_api.get<UsrProfile>('/user')
}

// Logout endpoint
export async function logoutApi() {
  return auth_api.post('/logout')
}

// Update user profile
// Backend supports modifying all fields EXCEPT username and identity via POST /user_change
// Allows password field, type-safe
export async function updateUserProfile(data: Partial<UsrProfileUpdate>) {
  return auth_api.post('/user_change', data)
}

