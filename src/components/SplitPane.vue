<template>
  <div class="split-pane" ref="containerRef">
    <!-- 左侧面板 -->
    <div
      class="split-pane-left"
      :style="{ width: leftWidth + 'px' }"
      v-show="!isCollapsed"
    >
      <slot name="left"></slot>
    </div>

    <!-- 分隔条 -->
    <div class="split-divider" @mousedown="startDragging" v-show="!isCollapsed">
      <div class="divider-line"></div>
    </div>

    <!-- 右侧面板 -->
    <div class="split-pane-right" :style="{ flex: isCollapsed ? 1 : 'auto' }">
      <slot name="right"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const props = defineProps({
  defaultWidth: {
    type: Number,
    default: 240,
  },
  minWidth: {
    type: Number,
    default: 180,
  },
  maxWidth: {
    type: Number,
    default: 500,
  },
});

const containerRef = ref<HTMLElement | null>(null);
const leftWidth = ref(props.defaultWidth);
const isDragging = ref(false);
const isCollapsed = ref(false);

function startDragging(_e: MouseEvent) {
  isDragging.value = true;
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging.value || !containerRef.value) return;

    const containerRect = containerRef.value.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;

    if (newWidth >= props.minWidth && newWidth <= props.maxWidth) {
      leftWidth.value = newWidth;
    }
  };

  const onMouseUp = () => {
    isDragging.value = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}

// 暴露方法和状态给父组件
defineExpose({
  toggleCollapse,
  isCollapsed,
});

onMounted(() => {
  // 可以从localStorage读取保存的宽度
  const savedWidth = localStorage.getItem("split-pane-width");
  if (savedWidth) {
    leftWidth.value = parseInt(savedWidth);
  }
});

onUnmounted(() => {
  // 保存宽度到localStorage
  localStorage.setItem("split-pane-width", leftWidth.value.toString());
});
</script>

<style scoped>
.split-pane {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.split-pane-left {
  flex-shrink: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.split-divider {
  width: 4px;
  cursor: col-resize;
  position: relative;
  flex-shrink: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.split-divider:hover {
  background: #e5e7eb;
}

.divider-line {
  width: 1px;
  height: 100%;
  background: #e5e7eb;
  pointer-events: none;
}

.split-divider:hover .divider-line {
  background: #9ca3af;
}

.split-pane-right {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}
</style>
