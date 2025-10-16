<template>
  <div class="tree-item">
    <!-- 拖拽插入位置指示线 - 上方（仅在 before 时显示，inside 用背景高亮） -->
    <div
      v-if="
        dropTarget?.id === folder.id &&
        dropPosition === 'before' &&
        draggingItem?.id !== folder.id
      "
      class="drop-indicator top"
    ></div>

    <!-- 文件夹 -->
    <div
      class="tree-row folder-row"
      :class="{
        'drag-over-inside':
          dropTarget?.id === folder.id && dropPosition === 'inside',
      }"
      :style="{ paddingLeft: `${level * 12 + 4}px` }"
      :tabindex="0"
      @click="toggleExpand"
      @keydown="handleFolderKeydown"
      draggable="true"
      @dragstart="handleDragStart($event, 'folder', folder)"
      @dragenter="handleDragEnter($event, 'folder', folder)"
      @dragleave="handleDragLeave"
      @dragover="handleDragOver"
      @drop="handleDrop($event, 'folder', folder)"
    >
      <!-- 折叠图标 -->
      <div class="chevron" :class="{ expanded: folder.expanded }">
        <!-- 树形线条 - 垂直线 -->
        <div
          v-if="level > 0"
          class="vertical-line"
          :class="{ 'is-last': isLastChild }"
        ></div>

        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M6 5l4 3-4 3"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <!-- 文件夹图标 -->
      <div class="icon folder-icon" :class="{ expanded: folder.expanded }">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <!-- 文件夹背景 -->
          <path
            d="M14.5 5.5v7a1 1 0 01-1 1h-11a1 1 0 01-1-1v-8a1 1 0 011-1h4l1.5 1.5h5.5a1 1 0 011 1z"
            fill="#fbbf24"
          />
          <!-- 文件夹标签 -->
          <path
            d="M6.5 3.5h-4a1 1 0 00-1 1v1h6v-1.5a.5.5 0 00-.5-.5h-1l.5-.5z"
            fill="#f59e0b"
          />
        </svg>
      </div>

      <!-- 文件夹名称/重命名输入框 -->
      <input
        v-if="isFolderRenaming"
        v-auto-focus-select
        v-model="renameInputValue"
        class="rename-input"
        @blur="saveFolderRename"
        @keydown="handleFolderRenameKeydown"
        @click.stop
      />
      <div v-else class="label">{{ folder.name }}</div>

      <!-- 操作按钮 -->
      <div class="actions">
        <button
          @click.stop="$emit('create-note', folder.id)"
          class="action-btn"
          title="新建笔记"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path
              d="M14 3H2a1 1 0 00-1 1v8a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1zm-1 8H3V5h10v6z"
            />
          </svg>
        </button>
        <button
          @click.stop="$emit('delete-folder', folder.id)"
          class="action-btn delete"
          title="删除文件夹"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path
              d="M11 3h3v1h-1v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4H2V3h3V2a1 1 0 011-1h4a1 1 0 011 1v1zM6 6v6h1V6H6zm3 0v6h1V6H9z"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- 拖拽插入位置指示线 - 下方 -->
    <div
      v-if="
        dropTarget?.id === folder.id &&
        dropPosition === 'after' &&
        draggingItem?.id !== folder.id
      "
      class="drop-indicator bottom"
    ></div>

    <!-- 文件夹内容 -->
    <div v-if="folder.expanded" class="tree-children">
      <!-- 笔记列表 -->
      <div
        v-for="(note, noteIndex) in folder.notes"
        :key="note.id"
        class="note-item-wrapper"
      >
        <!-- 拖拽插入位置指示线 - 上方 -->
        <div
          v-if="
            dropTarget?.id === note.id &&
            dropPosition === 'before' &&
            draggingItem?.id !== note.id
          "
          class="drop-indicator top"
        ></div>

        <div
          class="tree-row note-row"
          :class="{
            active: note.id === currentNoteId,
            'drag-over':
              dropTarget?.id === note.id && dropPosition === 'inside',
          }"
          :style="{ paddingLeft: `${(level + 1) * 12 + 4}px` }"
          :tabindex="0"
          @click="!isNoteRenaming(note.id) && $emit('select-note', note.id)"
          @keydown="handleNoteKeydown($event, note)"
          draggable="true"
          @dragstart="handleDragStart($event, 'note', note)"
          @dragenter="handleDragEnter($event, 'note', note)"
          @dragleave="handleDragLeave"
          @dragover="(e) => handleNoteDragOver(e, note)"
          @drop="handleDrop($event, 'note', note)"
        >
          <!-- 空白（对齐chevron）+ 树形线条 -->
          <div class="chevron-spacer">
            <div
              class="vertical-line-note"
              :class="{
                'is-last':
                  noteIndex === folder.notes.length - 1 &&
                  (!folder.subfolders || folder.subfolders.length === 0),
              }"
            ></div>
            <div class="horizontal-line-note"></div>
          </div>

          <!-- 文件图标 -->
          <div class="icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path
                d="M4 2a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V6.414A2 2 0 0013.414 5L11 2.586A2 2 0 009.586 2H4zm5 2v3h3l-3-3z"
              />
            </svg>
          </div>

          <!-- 笔记标题/重命名输入框 -->
          <input
            v-if="isNoteRenaming(note.id)"
            v-auto-focus-select
            v-model="renameInputValue"
            class="rename-input"
            @blur="saveNoteRename(note.id, note.title)"
            @keydown="handleNoteRenameKeydown($event, note.id, note.title)"
            @click.stop
          />
          <div v-else class="label">{{ note.title || "无标题" }}</div>

          <!-- 删除按钮 -->
          <div class="actions">
            <button
              @click.stop="$emit('delete-note', note.id)"
              class="action-btn delete"
              title="删除"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path
                  d="M11 3h3v1h-1v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4H2V3h3V2a1 1 0 011-1h4a1 1 0 011 1v1zM6 6v6h1V6H6zm3 0v6h1V6H9z"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- 拖拽插入位置指示线 - 下方 -->
        <div
          v-if="
            dropTarget?.id === note.id &&
            dropPosition === 'after' &&
            draggingItem?.id !== note.id
          "
          class="drop-indicator bottom"
        ></div>
      </div>

      <!-- 子文件夹 -->
      <FolderItem
        v-for="(subfolder, subfolderIndex) in folder.subfolders"
        :key="subfolder.id"
        :folder="subfolder"
        :currentNoteId="currentNoteId"
        :level="level + 1"
        :draggingItem="draggingItem"
        :dropTarget="dropTarget"
        :dropPosition="dropPosition"
        :renamingItem="renamingItem"
        :isLastChild="subfolderIndex === (folder.subfolders?.length || 0) - 1"
        @select-note="$emit('select-note', $event)"
        @delete-note="$emit('delete-note', $event)"
        @delete-folder="$emit('delete-folder', $event)"
        @rename-folder="
          (folderId, newName) => $emit('rename-folder', folderId, newName)
        "
        @rename-note="
          (noteId, newTitle) => $emit('rename-note', noteId, newTitle)
        "
        @start-rename="(type, id) => $emit('start-rename', type, id)"
        @create-note="$emit('create-note', $event)"
        @toggle-folder="$emit('toggle-folder', $event)"
        @drag-start="(data, event) => $emit('drag-start', data, event)"
        @drag-enter="
          (data, position, event) => $emit('drag-enter', data, position, event)
        "
        @drag-leave="$emit('drag-leave')"
        @drop="(data, position) => $emit('drop', data, position)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, ref, nextTick, computed } from "vue";

import type { Note, Folder } from "../typings";

const props = defineProps<{
  folder: Folder;
  currentNoteId: string | null;
  level: number;
  draggingItem?: any;
  dropTarget?: any;
  dropPosition?: "before" | "after" | "inside" | null;
  renamingItem?: { type: "folder" | "note"; id: string } | null;
  isLastChild?: boolean;
}>();

const emit = defineEmits<{
  (e: "select-note", noteId: string): void;
  (e: "delete-note", noteId: string): void;
  (e: "delete-folder", folderId: string): void;
  (e: "rename-folder", folderId: string, newName: string): void;
  (e: "rename-note", noteId: string, newTitle: string): void;
  (e: "start-rename", type: "folder" | "note", id: string): void;
  (e: "create-note", folderId: string): void;
  (e: "toggle-folder", folder: Folder): void;
  (e: "drag-start", data: any, event: DragEvent): void;
  (
    e: "drag-enter",
    data: any,
    position: "before" | "after" | "inside",
    event: DragEvent
  ): void;
  (e: "drag-leave"): void;
  (e: "drop", data: any, position: "before" | "after" | "inside"): void;
}>();

const renameInputValue = ref("");

// 计算属性判断是否正在重命名
const isFolderRenaming = computed(
  () =>
    props.renamingItem?.type === "folder" &&
    props.renamingItem?.id === props.folder.id
);

// 自定义指令：自动聚焦并选中文本（只执行一次）
const vAutoFocusSelect = {
  mounted(el: HTMLInputElement) {
    // 使用 nextTick 确保 DOM 完全渲染
    nextTick(() => {
      el.focus();
      el.select();
    });
  },
};

function toggleExpand() {
  if (isFolderRenaming.value) return; // 重命名时不触发折叠
  emit("toggle-folder", props.folder);
}

// 文件夹重命名
function handleFolderKeydown(e: KeyboardEvent) {
  if (e.key === "F2") {
    e.preventDefault();
    e.stopPropagation();
    renameInputValue.value = props.folder.name;
    emit("start-rename", "folder", props.folder.id);
  }
}

function saveFolderRename() {
  if (
    renameInputValue.value.trim() &&
    renameInputValue.value !== props.folder.name
  ) {
    emit("rename-folder", props.folder.id, renameInputValue.value);
  } else {
    // 取消重命名
    emit("rename-folder", props.folder.id, props.folder.name);
  }
}

function handleFolderRenameKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    saveFolderRename();
  } else if (e.key === "Escape") {
    e.preventDefault();
    emit("rename-folder", props.folder.id, props.folder.name);
  }
}

// 笔记重命名
function isNoteRenaming(noteId: string) {
  return (
    props.renamingItem?.type === "note" && props.renamingItem?.id === noteId
  );
}

function handleNoteKeydown(e: KeyboardEvent, note: Note) {
  if (e.key === "F2") {
    e.preventDefault();
    e.stopPropagation();
    renameInputValue.value = note.title || "无标题";
    emit("start-rename", "note", note.id);
  }
}

function saveNoteRename(noteId: string, originalTitle: string) {
  if (renameInputValue.value.trim()) {
    emit("rename-note", noteId, renameInputValue.value);
  } else {
    // 取消重命名
    emit("rename-note", noteId, originalTitle || "无标题");
  }
}

function handleNoteRenameKeydown(
  e: KeyboardEvent,
  noteId: string,
  originalTitle: string
) {
  if (e.key === "Enter") {
    e.preventDefault();
    saveNoteRename(noteId, originalTitle);
  } else if (e.key === "Escape") {
    e.preventDefault();
    emit("rename-note", noteId, originalTitle || "无标题");
  }
}

function handleDragStart(event: DragEvent, type: "folder" | "note", data: any) {
  const item = {
    type,
    id: data.id,
    name: type === "folder" ? data.name : data.title || "无标题",
    data,
  };
  emit("drag-start", item, event);
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();

  // 在 dragover 中持续更新文件夹位置判断
  handleDragEnter(e, "folder", props.folder);
}

function handleNoteDragOver(e: DragEvent, note: Note) {
  e.preventDefault();
  e.stopPropagation();

  // 在 dragover 中持续更新笔记位置判断
  handleDragEnter(e, "note", note);
}

function handleDragEnter(event: DragEvent, type: "folder" | "note", data: any) {
  event.stopPropagation();

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const y = event.clientY - rect.top;
  const height = rect.height;

  let position: "before" | "after" | "inside";

  if (type === "folder") {
    // 文件夹被拖入时：上1/4为before，下1/4为after，中间1/2为inside
    if (y < height * 0.25) {
      position = "before";
    } else if (y > height * 0.75) {
      position = "after";
    } else {
      position = "inside";
    }
  } else {
    // 笔记被拖入时：上半部分为before（上方指示线），下半部分为after（下方指示线）
    position = y <= height / 2 ? "before" : "after";
  }

  emit("drag-enter", { type, id: data.id, data }, position, event);
}

function handleDragLeave() {
  // emit("drag-leave");
}

function handleDrop(event: DragEvent, _type: "folder" | "note", _data: any) {
  event.preventDefault();
  event.stopPropagation();

  // 使用已经计算好的 dropTarget 和 dropPosition
  if (props.dropTarget && props.dropPosition) {
    emit("drop", props.dropTarget, props.dropPosition);
  }
}
</script>

<style scoped>
.tree-item {
  user-select: none;
  position: relative;
}

.note-item-wrapper {
  position: relative;
}

.tree-row {
  display: flex;
  align-items: center;
  height: 22px;
  cursor: pointer;
  position: relative;
  color: #374151;
  font-size: 13px;
  transition: background 0.1s;
}

.tree-row:hover {
  background: rgba(0, 0, 0, 0.04);
}

.tree-row.active {
  background: #dbeafe;
  color: #1d4ed8;
}

/* 拖拽悬停高亮 - 文件夹内部（中间区域） */
.folder-row.drag-over-inside {
  background: rgba(59, 130, 246, 0.15) !important;
  outline: 1px solid #3b82f6;
  outline-offset: -1px;
}

/* 拖拽插入位置指示线 */
.drop-indicator {
  position: absolute;
  left: 20px;
  right: 4px;
  height: 2px;
  background: #3b82f6;
  pointer-events: none;
  z-index: 10;
}

.drop-indicator.top {
  top: -1px;
}

.drop-indicator.bottom {
  bottom: -1px;
}

.drop-indicator::before {
  content: "";
  position: absolute;
  left: -4px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #3b82f6;
}

/* 文件夹行的折叠箭头 */
.chevron {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  position: relative;
  flex-shrink: 0;
  transition: transform 0.15s;
}

.chevron.expanded {
  transform: rotate(90deg);
}

/* 文件夹的垂直线（从父级箭头中心向下延伸，贯穿子项） */
.chevron .vertical-line {
  position: absolute;
  left: 6px; /* 向左移动，对齐箭头中心偏左位置 */
  top: -3px; /* 从行顶部开始（考虑 chevron 在行中的位置） */
  bottom: 3px; /* 到行底部（与下一行连接） */
  width: 1px;
  background: #d1d5db;
  pointer-events: none;
}

/* 最后一项的垂直线：只延伸到中间位置，形成 L 形拐角 */
.chevron .vertical-line.is-last {
  bottom: auto; /* 取消底部延伸 */
  height: 11px; /* 只到当前行中心位置 */
}

/* 笔记行的占位符 + 树形线条 */
.chevron-spacer {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  position: relative;
}

/* 笔记的垂直线（从上方父级箭头中心延伸下来，贯穿到下方） */
.vertical-line-note {
  position: absolute;
  left: -3px; /* 向左移动，对齐父级箭头中心偏左位置 */
  top: -3px; /* 从行顶部开始 */
  bottom: -3px; /* 到行底部（与下一行连接） */
  width: 1px;
  background: #d1d5db;
  pointer-events: none;
}

/* 最后一项笔记的垂直线：只延伸到中间位置，形成 L 形拐角 */
.vertical-line-note.is-last {
  bottom: auto; /* 取消底部延伸 */
  height: 11px; /* 只到当前行中心位置 */
}

/* 笔记的水平线（从垂直线连接到图标） */
.horizontal-line-note {
  position: absolute;
  left: -3px; /* 从垂直线位置开始 */
  top: 8px; /* 当前行的中心位置（chevron-spacer内的中心） */
  width: 15px; /* 连接到图标 */
  height: 1px;
  background: #d1d5db;
  pointer-events: none;
}

.icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 4px;
  color: #9ca3af;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

/* 文件夹图标样式 */
.folder-icon {
  color: #64748b;
}

.tree-row.active .icon {
  color: #3b82f6;
}

.label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
  padding-right: 4px;
}

.tree-row:hover .actions {
  opacity: 1;
}

.action-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  border: none;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #374151;
}

.action-btn.delete:hover {
  background: #fee2e2;
  color: #dc2626;
}

.tree-children {
  position: relative;
}

/* 重命名输入框 */
.rename-input {
  flex: 1;
  min-width: 60px;
  height: 20px;
  line-height: 18px;
  padding: 0 4px;
  border: 1px solid #3b82f6;
  border-radius: 2px;
  outline: none;
  font-size: 13px;
  background: white;
  color: #374151;
  box-sizing: border-box;
}

.rename-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}
</style>
