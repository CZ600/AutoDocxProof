<template>
    <el-layout style="height: calc(100vh - 80px);">
        <el-row>
            <el-col :span="24">
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