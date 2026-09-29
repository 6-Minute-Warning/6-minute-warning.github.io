<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { RouterLink } from 'vue-router'
import wordmark from '@/assets/wordmark.png'
import { initials } from '@/lib/call'
import { roleLabels } from '@/lib/access'
import { viewLabel } from '@/lib/viewAs'
import { useAuth } from '@/stores/auth'
import ViewAsPicker from './ViewAsPicker.vue'

const auth = useAuth()
const menu = useTemplateRef<HTMLDetailsElement>('menu')
const open = ref(false)

function close() {
  if (menu.value) menu.value.open = false
}
</script>

<template>
  <Teleport to="#chrome" defer>
    <header class="bar">
      <div class="inner">
        <RouterLink to="/" class="brand" aria-label="6 Minute Warning Backstage, home">
          <img :src="wordmark" alt="" width="131" height="32" />
          <span class="tag">Backstage</span>
        </RouterLink>
        <nav aria-label="Main">
          <RouterLink to="/">Home</RouterLink>
          <RouterLink to="/gigs">Gigs</RouterLink>
          <RouterLink to="/rehearsals">Rehearsals</RouterLink>
          <RouterLink to="/roster">Roster</RouterLink>
          <RouterLink v-if="auth.isAdmin" to="/access">Access</RouterLink>
        </nav>
        <details ref="menu" class="me" @toggle="open = menu?.open ?? false">
          <summary :aria-label="`${auth.realAccess?.name ?? 'Account'} menu`">{{ initials(auth.realAccess?.name ?? '?') }}</summary>
          <div class="menu">
            <strong>{{ auth.realAccess?.name }}</strong>
            <span class="muted">{{ auth.realAccess ? roleLabels[auth.realAccess.role] : '' }} · {{ auth.realEmail }}</span>
            <RouterLink v-if="auth.isManager" to="/activity" class="btn btn--ghost" @click="close">Assistant activity</RouterLink>
            <ViewAsPicker v-if="auth.canViewAs && open" @picked="close" />
            <button type="button" class="btn btn--ghost" @click="auth.signOut()">Sign out</button>
          </div>
        </details>
      </div>
      <div v-if="auth.viewing" class="viewing" role="status">
        <p>Viewing as <strong>{{ viewLabel(auth.viewing) }}</strong><span class="muted"> · read only</span></p>
        <button type="button" class="btn btn--ghost" @click="auth.viewAs(null)">Stop</button>
      </div>
    </header>
  </Teleport>
</template>

<style scoped>
.bar {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--color-scrim);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--color-border);
}

.inner {
  max-width: 1080px;
  margin: 0 auto;
  padding: 10px 16px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px 24px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.brand img {
  height: 32px;
  width: auto;
}

.tag {
  padding-left: 10px;
  border-left: 1px solid var(--color-border);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

nav {
  display: flex;
  gap: 20px;
}

nav a {
  position: relative;
  padding: 8px 0;
  color: var(--color-text-muted);
  text-decoration: none;
  font-weight: 700;
}

nav a::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 2px;
  height: 2px;
  background: var(--color-accent);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

nav a:hover,
nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a:hover::after,
nav a.router-link-exact-active::after {
  transform: scaleX(1);
}

.me {
  position: relative;
}

.me summary {
  list-style: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  font-weight: 800;
  font-size: 0.85rem;
  cursor: pointer;
}

.me summary::-webkit-details-marker {
  display: none;
}

.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 260px;
  display: grid;
  gap: 6px;
  padding: 16px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: 0 12px 32px var(--color-scrim);
}

.menu .muted {
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}

.menu .btn {
  margin-top: 8px;
}

.viewing {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 4px 12px;
  padding: 8px 16px;
  border-top: 1px solid var(--color-accent);
  background: var(--color-surface);
}

.viewing p {
  margin: 0;
  text-align: center;
}

.viewing strong {
  color: var(--color-accent-strong);
}

.viewing .btn {
  padding: 4px 14px;
}

@media (max-width: 640px) {
  .inner {
    grid-template-columns: 1fr auto;
  }

  nav {
    grid-column: 1 / -1;
    grid-row: 2;
    gap: 18px;
  }

  .tag {
    display: none;
  }
}
</style>
