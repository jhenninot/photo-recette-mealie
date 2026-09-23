<script setup>
import { ref } from 'vue'
import { session, setSession } from './api.js'
import LoginView from './views/LoginView.vue'
import CaptureView from './views/CaptureView.vue'
import AccountView from './views/AccountView.vue'

const page = ref('capture')

function logout() {
  setSession(null, null)
  page.value = 'capture'
}
</script>

<template>
  <LoginView v-if="!session.token" />
  <template v-else>
    <header class="topbar">
      <button class="brand" @click="page = 'capture'">
        <img src="/icon.svg" alt="" width="28" height="28" />
        <span>Photo Recette</span>
      </button>
      <nav>
        <button class="ghost" :class="{ active: page === 'account' }" @click="page = page === 'account' ? 'capture' : 'account'">
          {{ session.user?.username }}
        </button>
      </nav>
    </header>
    <main class="container">
      <KeepAlive>
        <CaptureView v-if="page === 'capture'" />
      </KeepAlive>
      <AccountView v-if="page === 'account'" @logout="logout" />
    </main>
  </template>
</template>
