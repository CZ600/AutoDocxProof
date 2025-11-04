<template>
  <div class="navbar-container" :class="{ dark: isDark }">
    <!-- 导航栏 -->
    <div class="navbar" style="display: flex; align-items: center;">
      <!-- Logo区域 -->
      <div class="logo">
        <img src="./assets/logo.png" alt="Logo" class="logo-img" />
        <span class="logo-text">智能校对</span>
      </div>

      <!-- 导航菜单 -->
      <el-menu mode="horizontal" :default-active="currentPath" @select="handleSelect" class="nav-menu"
        :background-color="isDark ? '#1d1e1f' : '#FFFFFF'" :text-color="isDark ? '#ffffff' : '#333'"
        :active-text-color="isDark ? '#75c777' : '#2e7d32'" :ellipsis="false">
        <el-menu-item index="/work/proof" class="navbutton">
          <el-icon>
            <HomeFilled />
          </el-icon>
          <span>文档校对</span>
        </el-menu-item>
        <el-menu-item index="/work/history" class="navbutton">
          <el-icon>
            <Clock />
          </el-icon>
          <span>历史记录</span>
        </el-menu-item>
        <el-menu-item index="/work/dictionary" class="navbutton">
          <el-icon>
            <Collection />
          </el-icon>
          <span>本地知识库</span>
        </el-menu-item>
        <el-menu-item index="/work/api" class="navbutton">
          <el-icon>
            <Setting />
          </el-icon>
          <span>功能设置</span>
        </el-menu-item>



        <el-menu-item index="/about" class="navbutton">
          <el-icon>
            <InfoFilled />
          </el-icon>
          <span>关于应用</span>
        </el-menu-item>
        <el-menu-item class="navbutton">
          <el-button @click="toggleDark()"
            :style="{ backgroundColor: isDark ? '#1d1e1f' : '#FFFFFF', color: isDark ? '#ffffff' : '#333' }">
            {{ isDark ? '切换到浅色' : '切换到深色' }}
          </el-button>

        </el-menu-item>
      </el-menu>
    </div>

    <!-- 预留的路由区域 -->
    <div class="router-view-container">
      <router-view />
    </div>
  </div>

</template>

<script setup>
import "./assets/css/common.css";
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { HomeFilled, Monitor, InfoFilled, Setting, Clock, Collection } from '@element-plus/icons-vue'
const electronAPI = window.electronAPI
const router = useRouter()
const route = useRoute()
import { useDark, useToggle } from '@vueuse/core'
import 'element-plus/theme-chalk/dark/css-vars.css'
// 使用 useDark 创建响应式状态
const isDark = useDark()
// 使用 useToggle 创建切换函数
const toggleDark = useToggle(isDark)

// 获取当前路由路径
const currentPath = computed(() => route.path)

// 路由跳转处理
const handleSelect = (key) => {
  router.push(key)
}

const getEnv = async () => {
  const envPath = await electronAPI.getEnvPath()
  console.log('envPath:', envPath)
}

getEnv()

</script>

<style scoped>
.navbar-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.navbar {
  height: 60px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 100;
  -webkit-app-region: drag;
}

.navbar.dark {
  background-color: #1d1e1f;
}

.logo {
  display: flex;
  align-items: center;
  padding: 0 20px;
  min-width: 150px;
}

.logo-img {
  height: 40px;
  margin-right: 10px;
}

.logo-text {
  font-size: 1.2rem;
  font-weight: bold;
  color: #2e7d32;
}

.nav-menu {
  flex: 1;
  border-bottom: none !important;
}

.navbutton {
  -webkit-app-region: no-drag;
}

:deep(.el-menu--horizontal > .el-menu-item) {
  height: 60px;
  line-height: 60px;
  font-weight: 500;
}

:deep(.el-menu--horizontal > .el-menu-item.is-active) {
  border-bottom: 3px solid #2e7d32;
}

.router-view-container {
  flex: 1;
  padding: 15px;
  background-color: #f9f9f9;
  overflow-y: auto;
}

/* 暗黑模式样式 */
.dark .router-view-container {
  background-color: #121212;
  color: #ffffff;
}

/* 隐藏滚动条 */
::-webkit-scrollbar {
  display: none;
}

/* 适用于所有浏览器 */
body {
  overflow: -moz-scrollbars-none;
  -ms-overflow-style: none;
}
</style>