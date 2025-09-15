<template>
    <el-layout style="height: calc(100vh - 80px);">
        <el-row>
            <el-col :span="3">
                <!-- 左侧侧边栏 -->
                <el-aside width="100%" class="sidebar-container">
                    <!-- 上传文件按钮 -->

                    <!-- 折叠菜单 -->
                    <el-menu class="side-menu" background-color="#e6f7ee" text-color="#000000"
                        active-text-color="#409EFF" :collapse="false" :default-active="$route.path" router>
                        <!-- 校正设置 -->
                        <el-sub-menu index="1">
                            <template #title>
                                <span>校正功能</span>
                            </template>
                            <el-menu-item index="/work/proof">
                                <span>校正页面</span>
                            </el-menu-item>
                            <el-menu-item index="/work/set">
                                <span>校正参数</span>
                            </el-menu-item>
                        </el-sub-menu>

                        <!-- API设置 -->
                        <el-sub-menu index="2">
                            <template #title>
                                <span>API 设置</span>
                            </template>
                            <el-menu-item index="/work/api">
                                <span>API配置</span>
                            </el-menu-item>
                            <el-menu-item index="/api/auth">
                                <span>认证管理</span>
                            </el-menu-item>
                            <el-menu-item index="/api/logs">
                                <span>日志查看</span>
                            </el-menu-item>
                        </el-sub-menu>

                        <!-- 其他 -->
                        <el-sub-menu index="3">
                            <template #title>
                                <span>其他</span>
                            </template>
                            <el-menu-item index="/other/settings">
                                <span>常规设置</span>
                            </el-menu-item>
                            <el-menu-item index="/other/about">
                                <span>关于系统</span>
                            </el-menu-item>
                        </el-sub-menu>
                    </el-menu>
                </el-aside>
            </el-col>
            <el-col :span="18">
                <main id="main-area">
                    <!-- 主内容区域 -->

                    <router-view />
                </main>



            </el-col>


        </el-row>



    </el-layout>
</template>

<script setup>



</script>

<style scoped>
.sidebar-container {
    background-color: #000000;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;

}

.upload-section {
    padding: 15px;
    flex-shrink: 0;
}

.side-menu {
    flex: 1;
    overflow-y: auto;
    border-right: none;
}

/* 隐藏Element Plus默认的折叠图标 */
:deep(.el-sub-menu__icon-arrow) {
    display: display-inside;
}

#main-area {
    flex: 1;
    overflow-y: auto;
    margin: 20px
}
</style>