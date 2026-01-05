import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import About from '../views/About.vue'
import Work from '../views/Work.vue'
import APISet from '../views/APISet.vue'
import Proof from '../views/Proof.vue'
import ProofSet from '../views/ProofSet.vue'
const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
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
