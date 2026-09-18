<script setup lang="ts">
import { watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { destination } from '@/lib/destination'

const auth = useAuth()
const route = useRoute()
const router = useRouter()

watch(
  () => [auth.status, auth.isAdmin],
  () => {
    if (auth.status === 'loading') return
    const name = destination(auth.status, auth.isAdmin, route.meta.access)
    if (name && name !== route.name) router.replace({ name })
  },
)
</script>

<template>
  <RouterView />
</template>
