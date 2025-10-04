import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import About from '../views/About.vue'
import Work from '../views/Work.vue'
import APISet from '../views/APISet.vue'
import Proof from '../views/Proof.vue'
import ProofSet from '../views/ProofSet.vue'
import History from '../views/history.vue'
import Logs from '../views/logs.vue'
import Dictionary from '../views/Dictionary.vue'
import OutputWord from '../views/OutputWord.vue'
import path from 'path'
const routes = [
  {
    path: '/',
    name: 'Home',
    redirect: '/work/proof'
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
        path: 'logs',
        name: 'Logs',
        component: Logs
      },
      {
        path: 'dictionary',
        name: 'Dictionary',
        component: Dictionary
      },
      {
        path: 'ouputWord',
        name: 'OutputWord',
        component: OutputWord
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
