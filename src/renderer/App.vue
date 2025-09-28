<template>
  <div class="navbar-container">
    <!-- 导航栏 -->
    <div class="navbar" style="display: flex; align-items: center;">
      <!-- Logo区域 -->
      <div class="logo">
        <img src="./assets/logo.png" alt="Logo" class="logo-img" />
        <span class="logo-text">智能校对</span>
      </div>

      <!-- 导航菜单 -->
      <el-menu mode="horizontal" :default-active="currentPath" @select="handleSelect" class="nav-menu"
        background-color="#FFFFFF" text-color="#333" active-text-color="#2e7d32" :ellipsis="false">
        <el-menu-item index="/work/proof" class="navbutton">
          <el-icon>
            <HomeFilled />
          </el-icon>
          <span>工作区</span>
        </el-menu-item>

        <el-menu-item index="/about" class="navbutton">
          <el-icon>
            <InfoFilled />
          </el-icon>
          <span>关于应用</span>
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
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { HomeFilled, Monitor, InfoFilled } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()

// 获取当前路由路径
const currentPath = computed(() => route.path)

// 路由跳转处理
const handleSelect = (key) => {
  router.push(key)
}
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

.logo {
  display: flex;
  align-items: center;
  padding: 0 20px;
  min-width: 200px;
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
</style>