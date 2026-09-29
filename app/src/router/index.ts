import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { destination } from '@/lib/destination'

declare module 'vue-router' {
  interface RouteMeta {
    access?: 'public' | 'guest' | 'no-access' | 'member' | 'manager' | 'admin'
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/install', name: 'install', component: () => import('@/views/InstallView.vue'), meta: { access: 'public' } },
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { access: 'member' } },
    { path: '/gigs', name: 'gigs', component: () => import('@/views/GigsView.vue'), meta: { access: 'member' } },
    { path: '/gigs/new', name: 'new-gig', component: () => import('@/views/NewGigView.vue'), meta: { access: 'member' } },
    { path: '/gigs/:id', name: 'gig', component: () => import('@/views/GigView.vue'), meta: { access: 'member' } },
    { path: '/rehearsals', name: 'rehearsals', component: () => import('@/views/RehearsalsView.vue'), meta: { access: 'member' } },
    { path: '/tours/new', name: 'new-tour', component: () => import('@/views/NewTourView.vue'), meta: { access: 'member' } },
    { path: '/tours/:id', name: 'tour', component: () => import('@/views/TourView.vue'), meta: { access: 'member' } },
    { path: '/roster', name: 'roster', component: () => import('@/views/RosterView.vue'), meta: { access: 'member' } },
    { path: '/activity', name: 'activity', component: () => import('@/views/ActivityView.vue'), meta: { access: 'manager' } },
    { path: '/access', name: 'access', component: () => import('@/views/AccessView.vue'), meta: { access: 'admin' } },
    { path: '/sign-in', name: 'sign-in', component: () => import('@/views/SignInView.vue'), meta: { access: 'guest' } },
    { path: '/no-access', name: 'no-access', component: () => import('@/views/NoAccessView.vue'), meta: { access: 'no-access' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})


router.beforeEach(async (to) => {
  const auth = useAuth()
  await auth.init()
  const name = destination(auth.status, auth.isAdmin, to.meta.access, auth.isManager)
  return name && name !== to.name ? { name } : true
})

export default router
