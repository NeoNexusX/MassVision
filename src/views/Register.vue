<template>
  <div class="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
    <!-- Login box card -->
    <div class="card w-full max-w-sm items-center justify-center">
      <!-- Inner card for placing the login form -->
      <div class="card w-full h-full items-center justify-center p-8">
        <!-- Username input -->
        <AuthInput v-model="username" icon-type="user" type="text" required placeholder="username"
          pattern="[A-Za-z0-9\-]*" :min-length="3" :max-length="30" title="Only letters, numbers or dash" />
        <p class="validator-hint">
          Must be 3 to 30 characters.
        </p>
        <!-- Email input -->
        <AuthInput v-model="email" icon-type="email" type="text" required placeholder="email" pattern="[A-Za-z0-9\-]*"
          :min-length="3" :max-length="30" />
        <p class="validator-hint">
          Must be a valid email address.
        </p>
        <!-- Password input -->
        <!-- TODO: Global font setting -->
        <AuthInput v-model="password" icon-type="password" type="password" pattern="[A-Za-z0-9\-]*" :min-length="6"
          :max-length="30" />
        <p class="validator-hint">
          Must be 6 to 30 characters.
        </p>
        <!-- Password confirmation -->
        <AuthInput v-model="confirmpassword" icon-type="password" type="password" pattern="[A-Za-z0-9\-]*"
          :min-length="6" :max-length="30" />
        <p class="validator-hint">
          Must be 6 to 30 characters.
        </p>
        <!-- Verification code and button -->
        <div class="flex gap-2 mt-4">
          <AuthInput v-model="vericode" icon-type="vericode" type="text" pattern="[0-9]*" :min-length="6"
            :max-length="6" class="flex-1" />
          <div class="form-control">
            <button @click="sendemail" class="btn btn-secondary ">Send verification code</button>
          </div>
        </div>
        <p class="validator-hint">
          Must be 6 characters.
        </p>

        <!-- Sign Up -->
        <div class="form-control flex-1 w-full">
          <button class="btn btn-primary w-full" @click="register">Sign Up</button>
        </div>

        <div class="text-center mt-4">
          <span class="text-sm opacity-75">Already have an account?</span>
          <router-link to="/login" class="link link-hover text-primary text-sm font-semibold">
            Sign in
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AuthInput from '../components/AuthInput.vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import http from '../utils/http';

const router = useRouter();
const username = ref('');
const email = ref('');
const password = ref('');
const confirmpassword = ref('');
const vericode = ref('');

const sendemail = async () => {
  // TODO: Implement send email logic
  alert('Verification code sent (simulated)');
};

// const sendemail = async () => {

// try {
// const response = await http.post('/signup', ({
// username: username.value,
// email: email.value
// }), {
// headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
// });
// console.log('response:', response.status)
// if (response.status !== 200) {
// console.log('response:', response.data)
// throw new Error(response.data?.message || 'Unable to connect the server.');
// }

// }
// catch (error) {
// console.error('Fail:', error);
// alert(error.response?.data?.message || 'Email already exists.');
// }
// };

const register = async () => {
  if (password.value !== confirmpassword.value) {
    alert('The passwords entered do not match.');
    return;
  }

  try {
    const response = await http.post('/signup', ({
      username: username.value,
      email: email.value,
      password: password.value
      // vericode: vericode.value
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('password:', password.value);
    console.log('email:', email.value);
    console.log('username:', username.value);

    console.log('response:', response.status)
    if (response.status !== 200) {
      console.log('response:', response.data)
      throw new Error(response.data?.message || 'Unable to connect the server.');
    }

    // Route redirection logic
    const redirectPath = router.currentRoute.value.query.redirect || '/login';
    await router.replace(redirectPath);
  }
  catch (error) {
    console.error('Fail:', error);
    alert(error.response?.data?.message || 'Account already exists.');
  }
};
</script>