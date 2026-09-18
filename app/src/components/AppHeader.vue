<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { roleLabels } from '@/lib/access'

const auth = useAuth()
</script>

<template>
  <header class="bar">
    <RouterLink to="/" class="brand">6MW Backstage</RouterLink>
    <nav aria-label="Main">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink v-if="auth.isAdmin" to="/access">Access</RouterLink>
    </nav>
    <span class="who">
      {{ auth.access?.name }} · {{ auth.access ? roleLabels[auth.access.role] : '' }}
      <button type="button" class="link" @click="auth.signOut()">Sign out</button>
    </span>
  </header>
</template>

<style scoped>
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 24px;
  padding: 12px 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.brand {
  color: var(--color-text);
  font-weight: 800;
  text-decoration: none;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

nav {
  display: flex;
  gap: 16px;
}

nav a {
  color: var(--color-text-muted);
  text-decoration: none;
  font-weight: 600;
}

nav a.router-link-exact-active {
  color: var(--color-text);
  box-shadow: inset 0 -2px 0 var(--color-accent);
}

.who {
  margin-left: auto;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.link {
  margin-left: 8px;
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  color: var(--color-accent-strong);
  cursor: pointer;
  text-decoration: underline;
}
</style>
