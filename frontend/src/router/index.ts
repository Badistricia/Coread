import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'reader',
      component: () => import('@/views/ReaderView.vue'),
    },
    {
      path: '/companions',
      name: 'companions',
      component: () => import('@/views/MyCompanionsView.vue'),
    },
  ],
})

export default router
