import { createRouter, createWebHashHistory } from 'vue-router'
import About from '../views/About.vue'
import APISet from '../views/APISet.vue'
import Proof from '../views/Proof.vue'
import ProofSet from '../views/ProofSet.vue'
import History from '../views/history.vue'
import Knowledge from '../views/Dictionary.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    redirect: '/proof'
  },
  {
    path: '/about',
    name: 'About',
    component: About
  },
  {
    path: '/proof',
    name: 'Proof',
    component: Proof
  },
  {
    path: '/api',
    name: 'APISet',
    component: APISet
  },
  {
    path: '/set',
    name: 'Set',
    component: ProofSet
  },
  {
    path: '/history',
    name: 'History',
    component: History
  },
  {
    path: '/dictionary',
    name: 'Knowledge',
    component: Knowledge
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
