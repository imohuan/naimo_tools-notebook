<template>
  <div class="file-tree-container" @dragover="handleDragOver">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <button
          @click="$emit('create-note', folders[0]?.id)"
          class="tool-btn"
          title="新建笔记"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path
              d="M14 3H2a1 1 0 00-1 1v8a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1zm-1 8H3V5h10v6z"
            />
            <path d="M8 6v4M6 8h4" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>
        <button
          @click="$emit('create-folder')"
          class="tool-btn"
          title="新建文件夹"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path
              d="M7 3H2a1 1 0 00-1 1v8a1 1 0 001 1h12a1 1 0 001-1V5a1 1 0 00-1-1H8.5L7 3z"
            />
          </svg>
        </button>
      </div>

      <!-- 切换展开按钮 -->
      <button
        class="tool-btn toggle-sidebar-btn"
        @click="$emit('toggle-collapse')"
        title="收起侧边栏"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
          />
        </svg>
      </button>
    </div>

    <!-- 文件树 -->
    <div class="tree-content">
      <FolderItem
        v-for="(folder, folderIndex) in folders"
        :key="folder.id"
        :folder="folder"
        :currentNoteId="currentNoteId"
        :level="0"
        :draggingItem="draggingItem"
        :dropTarget="dropTarget"
        :dropPosition="dropPosition"
        :renamingItem="renamingItem"
        :isLastChild="folderIndex === folders.length - 1"
        @select-note="$emit('select-note', $event)"
        @delete-note="$emit('delete-note', $event)"
        @delete-folder="$emit('delete-folder', $event)"
        @rename-folder="handleRenameFolder"
        @rename-note="handleRenameNote"
        @start-rename="startRename"
        @create-note="$emit('create-note', $event)"
        @toggle-folder="toggleFolder"
        @drag-start="handleDragStart"
        @drag-enter="handleDragEnter"
        @drag-leave="handleDragLeave"
        @drop="handleDrop"
      />
    </div>

    <!-- 拖拽幽灵元素 - 固定在工具栏区域 -->
    <div v-if="draggingItem" class="drag-ghost">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="currentColor"
        class="ghost-icon"
      >
        <path
          v-if="draggingItem.type === 'folder'"
          d="M7 3H2a1 1 0 00-1 1v8a1 1 0 001 1h12a1 1 0 001-1V5a1 1 0 00-1-1H8.5L7 3z"
        />
        <path
          v-else
          d="M4 2a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V6.414A2 2 0 0013.414 5L11 2.586A2 2 0 009.586 2H4zm5 2v3h3l-3-3z"
        />
      </svg>
      {{ draggingItem.name }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, ref } from "vue";
import FolderItem from "./FolderItem.vue";

interface Note {
  id: string;
  title: string;
  content: string;
  folderId?: string;
  createdAt: number;
  updatedAt: number;
}

interface Folder {
  id: string;
  name: string;
  expanded: boolean;
  notes: Note[];
  subfolders?: Folder[];
}

interface DragItem {
  type: "folder" | "note";
  id: string;
  name: string;
  data: any;
}

// Props used in template
defineProps<{
  folders: Folder[];
  currentNoteId: string | null;
}>();

const emit = defineEmits<{
  (e: "create-note", folderId: string): void;
  (e: "create-folder", parentId?: string): void;
  (e: "select-note", noteId: string): void;
  (e: "delete-note", noteId: string): void;
  (e: "delete-folder", folderId: string): void;
  (e: "rename-folder", folderId: string, newName: string): void;
  (e: "rename-note", noteId: string, newTitle: string): void;
  (e: "toggle-collapse"): void;
  (
    e: "move-item",
    dragItem: any,
    dropTarget: any,
    position: "before" | "after" | "inside"
  ): void;
}>();

const draggingItem = ref<DragItem | null>(null);
const dropTarget = ref<any>(null);
const dropPosition = ref<"before" | "after" | "inside" | null>(null);
const expandTimer = ref<NodeJS.Timeout | null>(null);

// 重命名状态管理
const renamingItem = ref<{ type: "folder" | "note"; id: string } | null>(null);

function toggleFolder(folder: Folder) {
  folder.expanded = !folder.expanded;
}

// 重命名管理
function startRename(type: "folder" | "note", id: string) {
  renamingItem.value = { type, id };
}

function stopRename() {
  renamingItem.value = null;
}

function handleRenameFolder(folderId: string, newName: string) {
  emit("rename-folder", folderId, newName);
  stopRename();
}

function handleRenameNote(noteId: string, newTitle: string) {
  emit("rename-note", noteId, newTitle);
  stopRename();
}

function handleDragStart(item: DragItem, event: DragEvent) {
  draggingItem.value = item;

  // 创建透明的拖拽图像
  const ghost = document.createElement("div");
  ghost.style.opacity = "0";
  document.body.appendChild(ghost);
  event.dataTransfer?.setDragImage(ghost, 0, 0);
  setTimeout(() => document.body.removeChild(ghost), 0);

  const handleDragEnd = () => {
    draggingItem.value = null;
    dropTarget.value = null;
    dropPosition.value = null;
    document.removeEventListener("dragend", handleDragEnd);
    if (expandTimer.value) {
      clearTimeout(expandTimer.value);
      expandTimer.value = null;
    }
  };

  document.addEventListener("dragend", handleDragEnd);
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
}

function handleDragEnter(
  target: any,
  position: "before" | "after" | "inside",
  _event: DragEvent
) {
  if (!draggingItem.value) return;

  // 不能拖到自己上
  if (draggingItem.value.id === target.id) {
    dropTarget.value = null;
    dropPosition.value = null;
    return;
  }

  // 如果是笔记拖到文件夹上，强制使用 inside（移入文件夹）
  let finalPosition = position;
  if (draggingItem.value.type === "note" && target.type === "folder") {
    finalPosition = "inside";
  }

  // 如果是文件夹拖到笔记上，强制使用 inside（移入笔记所在的文件夹）
  if (draggingItem.value.type === "folder" && target.type === "note") {
    finalPosition = "inside";
  }

  dropTarget.value = target;
  dropPosition.value = finalPosition;

  // 如果是文件夹且拖拽到内部，延迟展开
  if (finalPosition === "inside" && target.type === "folder") {
    if (expandTimer.value) clearTimeout(expandTimer.value);
    expandTimer.value = setTimeout(() => {
      if (!target.data.expanded) {
        target.data.expanded = true;
      }
    }, 800);
  } else {
    if (expandTimer.value) {
      clearTimeout(expandTimer.value);
      expandTimer.value = null;
    }
  }
}

function handleDragLeave() {
  if (expandTimer.value) {
    clearTimeout(expandTimer.value);
    expandTimer.value = null;
  }
}

function handleDrop(target: any, position: "before" | "after" | "inside") {
  if (!draggingItem.value) return;

  // 触发移动事件
  emit("move-item", draggingItem.value, target, position);

  draggingItem.value = null;
  dropTarget.value = null;
  dropPosition.value = null;

  if (expandTimer.value) {
    clearTimeout(expandTimer.value);
    expandTimer.value = null;
  }
}
</script>

<style scoped>
.file-tree-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f3f4f6;
  position: relative;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px;
  border-bottom: 1px solid #e5e7eb;
}

.toolbar-left {
  display: flex;
  gap: 4px;
}

.tool-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: #6b7280;
  transition: all 0.15s;
  background: transparent;
  border: none;
  cursor: pointer;
}

.tool-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;
  min-height: 0;
}

.tree-content::-webkit-scrollbar {
  width: 10px;
}

.tree-content::-webkit-scrollbar-track {
  background: transparent;
}

.tree-content::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 5px;
  border: 2px solid #f3f4f6;
  background-clip: padding-box;
}

.tree-content::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
  background-clip: padding-box;
}

/* 拖拽幽灵元素 - 固定在工具栏左侧 */
.drag-ghost {
  position: absolute;
  top: 6px;
  left: 6px;
  display: flex;
  align-items: center;
  padding: 5px 10px;
  background: rgba(59, 130, 246, 0.95);
  color: white;
  border-radius: 4px;
  font-size: 13px;
  pointer-events: none !important;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
  user-select: none;
  max-width: calc(100% - 12px);
  overflow: hidden;
  text-overflow: ellipsis;
}

.drag-ghost * {
  pointer-events: none !important;
}

.ghost-icon {
  margin-right: 6px;
  flex-shrink: 0;
}
</style>
