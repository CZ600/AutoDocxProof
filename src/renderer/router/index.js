import { createRouter, createWebHistory } from 'vue-router'
import About from '../views/About.vue'
import Work from '../views/Work.vue'
import APISet from '../views/APISet.vue'
import Proof from '../views/Proof.vue'
import ProofSet from '../views/ProofSet.vue'
import History from '../views/history.vue'
import Knowledge from '../views/Dictionary.vue'
const routes = [
  {
    path: '/',
    name: 'Home',
    redirect:"/work/proof"
  },
  {
    path: '/about',
    name: 'About',
    component: About
  },
  {
    path: '/work',
    name: 'Work',
    component: Work,
    children: [
      {
        path: 'api',
        name: 'APISet',
        component: APISet
      },
      {
        path: 'proof',
        name: 'Proof',
        component: Proof
      },
      {
        path: 'set',
        name: 'Set',
        component: ProofSet
      },
      {
        path: 'history',
        name: 'History',
        component: History
      },
      {
        path: 'dictionary',
        name: 'Knowledge',
        component: Knowledge
      }
    ]
  }

  // 动态路由示例
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
