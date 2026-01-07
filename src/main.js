import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Home from './views/Home.vue'
import Transactions from './views/Transactions.vue'
import Statistics from './views/Statistics.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/transactions', component: Transactions },
  { path: '/statistics', component: Statistics }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.mount('#app')

