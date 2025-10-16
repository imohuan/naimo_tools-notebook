<template>
  <div class="app-container">
    <SplitPane
      ref="splitPaneRef"
      :defaultWidth="210"
      :minWidth="180"
      :maxWidth="500"
    >
      <!-- 左侧文件树 -->
      <template #left>
        <FileTree
          :folders="folders"
          :currentNoteId="currentNoteId"
          @create-note="createNote"
          @create-folder="createFolder"
          @select-note="selectNote"
          @delete-note="deleteNote"
          @delete-folder="confirmDeleteFolder"
          @rename-folder="renameFolder"
          @rename-note="renameNote"
          @move-item="handleMoveItem"
          @toggle-collapse="handleToggleCollapse"
        />
      </template>

      <!-- 右侧编辑器 -->
      <template #right>
        <div class="editor-container">
          <BlockEditor
            v-if="currentNote"
            :note="currentNote"
            :isSidebarCollapsed="isSidebarCollapsed"
            @update="updateNote"
            @toggle-sidebar="handleToggleCollapse"
          />
          <div v-else class="empty-state">
            <div class="empty-icon">📝</div>
            <div class="empty-text">选择或创建一个笔记</div>
          </div>
        </div>
      </template>
    </SplitPane>

    <!-- 确认对话框 -->
    <ConfirmDialog
      :show="confirmDialog.show"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :details="confirmDialog.details"
      @confirm="handleConfirmDelete"
      @cancel="handleCancelDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, toRaw } from "vue";
import FileTree from "./components/FileTree.vue";
import BlockEditor from "./components/BlockEditor.vue";
import ConfirmDialog from "./components/ConfirmDialog.vue";
import SplitPane from "./components/SplitPane.vue";

// SplitPane组件引用
const splitPaneRef = ref<InstanceType<typeof SplitPane> | null>(null);

// 侧边栏是否收起
const isSidebarCollapsed = computed(() => {
  return splitPaneRef.value?.isCollapsed || false;
});

import type { Note, Folder } from "./typings";

// 用于显示的笔记（包含从文件加载的内容）
interface NoteWithContent extends Note {
  content: string; // 从文件加载的内容
}

const folders = ref<Folder[]>([]);
const currentNoteId = ref<string | null>(null);

// 确认对话框状态
const confirmDialog = ref({
  show: false,
  title: "",
  message: "",
  details: "",
  folderId: "",
});

const currentNote = computed<NoteWithContent | null>(() => {
  for (const folder of folders.value) {
    const note = findNoteInFolder(folder, currentNoteId.value);
    if (note) {
      if (!(window as any).myPluginAPI) {
        console.warn("myPluginAPI 不可用");
        return { ...note, content: "" };
      }
      // 从文件加载笔记内容
      const content = (window as any).myPluginAPI.loadNoteFromFile(
        note.filePath
      );
      return { ...note, content };
    }
  }
  return null;
});

function findNoteInFolder(folder: Folder, noteId: string | null): Note | null {
  if (!noteId) return null;

  const note = folder.notes.find((n) => n.id === noteId);
  if (note) return note;

  if (folder.subfolders) {
    for (const subfolder of folder.subfolders) {
      const found = findNoteInFolder(subfolder, noteId);
      if (found) return found;
    }
  }

  return null;
}

async function loadData() {
  try {
    const data = await window.naimo.db.get("notebook_data");
    if (data && data.folders) {
      folders.value = data.folders;
    } else {
      // 创建默认结构
      const welcomeNoteId = Date.now().toString();
      const welcomeContent = `# 欢迎使用笔记本

这是一个现代化的块级编辑器，支持即时转换 Markdown 语法。

## ✨ 核心特性

- 📝 块级编辑 - 每个内容块独立编辑
- ⚡ 即时转换 - 输入语法后按回车立即渲染
- 🎨 语法高亮 - 支持多种编程语言
- 🗂️ 文件管理 - VSCode 风格的树形结构

## 🚀 快速开始

### 创建标题
输入 # 后跟空格，按回车创建标题
### 代码块
输入 \`\`\`语言名 按回车创建代码块

\`\`\`javascript
// 这是一个代码块示例
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

### 列表
输入 - 或 * 后跟空格创建无序列表
输入 1. 后跟空格创建有序列表

- 无序列表项 1
- 无序列表项 2

### 引用
输入 > 后跟空格创建引用

> 这是一条引用内容

### 分割线
输入 --- 按回车创建分割线

---

## 💡 使用技巧

- 按 Enter 创建新块
- 按 Backspace 删除空块  
- 点击左侧图标切换块类型
- 支持上下箭头键在块间导航

开始创作你的笔记吧！`;

      // 保存欢迎笔记到文件
      const welcomeFilePath = await (window as any).myPluginAPI.saveNoteToFile(
        welcomeNoteId,
        welcomeContent
      );

      folders.value = [
        {
          id: "root",
          name: "我的笔记",
          expanded: true,
          notes: [
            {
              id: welcomeNoteId,
              title: "欢迎使用笔记本",
              filePath: welcomeFilePath,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
          subfolders: [],
        },
      ];
      await saveData();
    }
  } catch (error) {
    console.error("加载数据失败:", error);
  }
}

async function saveData() {
  try {
    // 使用 toRaw 移除响应式代理，然后通过 JSON 深拷贝确保数据可以被序列化
    const rawData = JSON.parse(JSON.stringify(toRaw(folders.value)));

    await window.naimo.db.put({
      _id: "notebook_data",
      folders: rawData,
    });
  } catch (error) {
    console.error("保存数据失败:", error);
  }
}

async function createNote(folderId: string) {
  const folder = findFolder(folders.value, folderId);
  if (!folder) return;

  // 确保文件夹展开
  folder.expanded = true;

  const noteId = Date.now().toString();

  // 保存空内容到文件
  const filePath = await (window as any).myPluginAPI.saveNoteToFile(noteId, "");

  const newNote: Note = {
    id: noteId,
    title: "新笔记",
    filePath: filePath,
    folderId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  folder.notes.unshift(newNote);
  currentNoteId.value = newNote.id;
  await saveData();
}

function createFolder(parentId?: string) {
  const newFolder: Folder = {
    id: Date.now().toString(),
    name: "新文件夹",
    expanded: true,
    notes: [],
    subfolders: [],
  };

  if (parentId) {
    const parent = findFolder(folders.value, parentId);
    if (parent) {
      if (!parent.subfolders) parent.subfolders = [];
      parent.subfolders.push(newFolder);
    }
  } else {
    folders.value.push(newFolder);
  }

  saveData();
}

function selectNote(noteId: string) {
  currentNoteId.value = noteId;
}

async function updateNote(content: string, title: string) {
  if (!currentNote.value) return;

  // 查找原始的 Note 对象
  let originalNote: Note | null = null;
  for (const folder of folders.value) {
    const note = findNoteInFolder(folder, currentNote.value.id);
    if (note) {
      originalNote = note;
      break;
    }
  }

  if (!originalNote) return;

  // 更新现有文件的内容（不创建新文件）
  (window as any).myPluginAPI.updateNoteFile(originalNote.filePath, content);

  originalNote.title = title;
  originalNote.updatedAt = Date.now();
  await saveData();
}

// 删除笔记前确认
async function deleteNote(noteId: string) {
  // 查找笔记
  let noteToDelete: Note | null = null;
  for (const folder of folders.value) {
    const note = findNoteInFolder(folder, noteId);
    if (note) {
      noteToDelete = note;
      break;
    }
  }

  if (!noteToDelete) return;

  // 从文件加载内容以检查是否包含图片
  const content =
    (window as any).myPluginAPI?.loadNoteFromFile(noteToDelete.filePath) || "";

  // 检查是否包含图片
  const hasImagesResult = await (window as any).myPluginAPI?.hasImages(content);

  if (hasImagesResult) {
    // 提取图片路径
    const imagePaths =
      (await (window as any).myPluginAPI?.extractImagePaths(content)) || [];

    confirmDialog.value = {
      show: true,
      title: "删除笔记",
      message: `确定要删除笔记"${noteToDelete.title}"吗？`,
      details: `此笔记包含 ${imagePaths.length} 张图片，删除笔记时将同时删除这些图片文件。`,
      folderId: noteId, // 这里复用 folderId 来存储 noteId
    };
  } else {
    // 没有图片，直接删除
    performDeleteNote(noteId);
  }
}

// 执行删除笔记操作
async function performDeleteNote(noteId: string) {
  // 查找笔记以删除关联的图片和文件
  let noteToDelete: Note | null = null;
  for (const folder of folders.value) {
    const note = findNoteInFolder(folder, noteId);
    if (note) {
      noteToDelete = note;
      break;
    }
  }

  if (noteToDelete && (window as any).myPluginAPI) {
    // 从文件加载内容以检查是否有图片
    const content = (window as any).myPluginAPI.loadNoteFromFile(
      noteToDelete.filePath
    );

    // 删除关联的图片文件
    if (content) {
      const imagePaths = await (window as any).myPluginAPI.extractImagePaths(
        content
      );
      for (const imagePath of imagePaths) {
        try {
          (window as any).myPluginAPI.deleteImage(imagePath);
        } catch (error) {
          console.error("删除图片文件失败:", imagePath, error);
        }
      }
    }

    // 删除笔记文件
    try {
      (window as any).myPluginAPI.deleteNoteFile(noteToDelete.filePath);
    } catch (error) {
      console.error("删除笔记文件失败:", error);
    }
  }

  // 从文件夹中删除笔记
  for (const folder of folders.value) {
    if (deleteNoteFromFolder(folder, noteId)) {
      if (currentNoteId.value === noteId) {
        currentNoteId.value = null;
      }
      await saveData();
      break;
    }
  }
}

function deleteNoteFromFolder(folder: Folder, noteId: string): boolean {
  const index = folder.notes.findIndex((n) => n.id === noteId);
  if (index > -1) {
    folder.notes.splice(index, 1);
    return true;
  }

  if (folder.subfolders) {
    for (const subfolder of folder.subfolders) {
      if (deleteNoteFromFolder(subfolder, noteId)) {
        return true;
      }
    }
  }

  return false;
}

// 确认删除文件夹
function confirmDeleteFolder(folderId: string) {
  const folder = findFolder(folders.value, folderId);
  if (!folder) return;

  // 统计文件夹内容
  const { noteCount, subfolderCount } = countFolderContent(folder);

  if (noteCount > 0 || subfolderCount > 0) {
    // 有内容，显示确认对话框
    const details = [];
    if (noteCount > 0) details.push(`${noteCount} 个笔记`);
    if (subfolderCount > 0) details.push(`${subfolderCount} 个子文件夹`);

    confirmDialog.value = {
      show: true,
      title: "删除文件夹",
      message: `确定要删除文件夹"${folder.name}"吗？`,
      details: `此操作将同时删除：${details.join("、")}`,
      folderId,
    };
  } else {
    // 空文件夹，直接删除
    deleteFolder(folderId);
  }
}

// 统计文件夹内容
function countFolderContent(folder: Folder): {
  noteCount: number;
  subfolderCount: number;
} {
  let noteCount = folder.notes.length;
  let subfolderCount = folder.subfolders?.length || 0;

  // 递归统计子文件夹
  if (folder.subfolders) {
    for (const subfolder of folder.subfolders) {
      const subCount = countFolderContent(subfolder);
      noteCount += subCount.noteCount;
      subfolderCount += subCount.subfolderCount;
    }
  }

  return { noteCount, subfolderCount };
}

// 递归删除文件夹中所有笔记的文件和图片
async function deleteFolderFiles(folder: Folder) {
  if (!folder || !(window as any).myPluginAPI) return;

  // 删除文件夹中的所有笔记文件和图片
  for (const note of folder.notes) {
    try {
      // 从文件加载内容以检查是否有图片
      const content = (window as any).myPluginAPI.loadNoteFromFile(
        note.filePath
      );

      // 删除关联的图片文件
      if (content) {
        const imagePaths = await (window as any).myPluginAPI.extractImagePaths(
          content
        );
        for (const imagePath of imagePaths) {
          try {
            (window as any).myPluginAPI.deleteImage(imagePath);
            console.log("删除图片文件:", imagePath);
          } catch (error) {
            console.error("删除图片文件失败:", imagePath, error);
          }
        }
      }

      // 删除笔记文件
      (window as any).myPluginAPI.deleteNoteFile(note.filePath);
      console.log("删除笔记文件:", note.filePath);
    } catch (error) {
      console.error("删除笔记文件失败:", note.filePath, error);
    }
  }

  // 递归删除子文件夹
  if (folder.subfolders) {
    for (const subfolder of folder.subfolders) {
      await deleteFolderFiles(subfolder);
    }
  }
}

// 检查文件夹中是否包含指定笔记（递归）
function folderContainsNote(folder: Folder, noteId: string): boolean {
  if (folder.notes.some((n) => n.id === noteId)) {
    return true;
  }
  if (folder.subfolders) {
    for (const subfolder of folder.subfolders) {
      if (folderContainsNote(subfolder, noteId)) {
        return true;
      }
    }
  }
  return false;
}

// 执行删除
async function deleteFolder(folderId: string) {
  // 先查找文件夹
  const folder = findFolder(folders.value, folderId);

  // 如果当前选中的笔记在被删除的文件夹中，清除选中状态
  if (
    currentNoteId.value &&
    folder &&
    folderContainsNote(folder, currentNoteId.value)
  ) {
    currentNoteId.value = null;
  }

  // 删除文件夹中所有的笔记文件和图片
  if (folder) {
    await deleteFolderFiles(folder);
  }

  // 从数据结构中删除文件夹
  removeFolderFromAllFolders(folderId);

  await saveData();
}

// 确认删除
function handleConfirmDelete() {
  const id = confirmDialog.value.folderId;

  // 判断是删除文件夹还是笔记（根据 title 判断）
  if (confirmDialog.value.title === "删除笔记") {
    performDeleteNote(id);
  } else {
    deleteFolder(id);
  }

  confirmDialog.value.show = false;
}

// 取消删除
function handleCancelDelete() {
  confirmDialog.value.show = false;
  confirmDialog.value.folderId = "";
}

function renameFolder(folderId: string, newName: string) {
  const folder = findFolder(folders.value, folderId);
  if (folder && newName.trim()) {
    folder.name = newName.trim();
    saveData();
  }
}

function renameNote(noteId: string, newTitle: string) {
  for (const folder of folders.value) {
    const note = findNoteInFolder(folder, noteId);
    if (note && newTitle.trim()) {
      note.title = newTitle.trim();
      note.updatedAt = Date.now();
      saveData();
      break;
    }
  }
}

// 切换侧边栏展开/收起
function handleToggleCollapse() {
  splitPaneRef.value?.toggleCollapse();
}

function findFolder(folderList: Folder[], folderId: string): Folder | null {
  for (const folder of folderList) {
    if (folder.id === folderId) return folder;

    if (folder.subfolders) {
      const found = findFolder(folder.subfolders, folderId);
      if (found) return found;
    }
  }
  return null;
}

// 拖拽移动项目
function handleMoveItem(
  dragItem: any,
  dropTarget: any,
  position: "before" | "after" | "inside"
) {
  console.log("移动项目:", {
    dragType: dragItem.type,
    dragId: dragItem.id,
    targetType: dropTarget.type,
    targetId: dropTarget.id,
    position,
  });

  if (dragItem.type === "note") {
    moveNoteById(dragItem.id, dropTarget.type, dropTarget.id, position);
  } else if (dragItem.type === "folder") {
    moveFolderById(dragItem.id, dropTarget.type, dropTarget.id, position);
  }

  saveData();
}

// 基于ID移动笔记
function moveNoteById(
  noteId: string,
  targetType: string,
  targetId: string,
  position: "before" | "after" | "inside"
) {
  // 1. 查找笔记
  const sourceFolder = findFolderByNoteId(noteId);
  if (!sourceFolder) return;
  const note = sourceFolder.notes.find((n) => n.id === noteId);
  if (!note) return;

  // 2. 从原位置删除
  removeNoteFromAllFolders(noteId);

  // 3. 根据位置插入到新位置
  if (targetType === "folder") {
    const targetFolder = findFolderById(targetId);
    if (!targetFolder) return;

    // 笔记拖到文件夹：只支持 inside，移入文件夹
    targetFolder.notes.unshift(note);
    note.folderId = targetId;
  } else if (targetType === "note") {
    // 移动到另一个笔记的前后
    const targetNoteFolder = findFolderByNoteId(targetId);
    if (!targetNoteFolder) return;

    const targetIndex = targetNoteFolder.notes.findIndex(
      (n) => n.id === targetId
    );
    const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
    targetNoteFolder.notes.splice(insertIndex, 0, note);
    note.folderId = targetNoteFolder.id;
  }
}

// 基于ID移动文件夹
function moveFolderById(
  folderId: string,
  targetType: string,
  targetId: string,
  position: "before" | "after" | "inside"
) {
  // 防止循环嵌套：不能将父文件夹移动到子文件夹
  if (isChildFolder(folderId, targetId)) {
    console.warn("不能将父文件夹移动到子文件夹");
    return;
  }

  // 1. 查找要移动的文件夹
  const folder = findFolderById(folderId);
  if (!folder) return;

  // 2. 先查找目标位置（在删除之前！）
  let targetFolder: Folder | null = null;
  let parentFolder: Folder | null = null;
  let targetNoteFolder: Folder | null = null;

  if (targetType === "folder") {
    targetFolder = findFolderById(targetId);
    if (position !== "inside") {
      parentFolder = findParentFolder(targetId);
    }
    // 验证目标位置是否有效
    if (!targetFolder) {
      console.error("无法找到目标文件夹");
      return;
    }
  } else if (targetType === "note") {
    // 文件夹拖到文件上，找到文件所在的文件夹
    targetNoteFolder = findFolderByNoteId(targetId);
    if (!targetNoteFolder) {
      console.error("无法找到目标文件所在的文件夹");
      return;
    }
  }

  // 3. 从原位置删除
  removeFolderFromAllFolders(folderId);

  // 4. 根据位置插入到新位置
  if (targetType === "folder") {
    if (position === "inside") {
      // 移动到文件夹内部
      if (!targetFolder!.subfolders) targetFolder!.subfolders = [];
      targetFolder!.subfolders.unshift(folder);
    } else {
      // 移动到文件夹前后（同级）
      if (parentFolder) {
        if (!parentFolder.subfolders) parentFolder.subfolders = [];
        const folderIndex = parentFolder.subfolders.findIndex(
          (f) => f.id === targetId
        );
        const insertIndex =
          position === "before" ? folderIndex : folderIndex + 1;
        parentFolder.subfolders.splice(insertIndex, 0, folder);
      } else {
        // 顶级文件夹
        const folderIndex = folders.value.findIndex((f) => f.id === targetId);
        const insertIndex =
          position === "before" ? folderIndex : folderIndex + 1;
        folders.value.splice(insertIndex, 0, folder);
      }
    }
  } else if (targetType === "note" && targetNoteFolder) {
    // 文件夹拖到笔记上（position 强制为 inside），将文件夹移入笔记所在的文件夹
    // 确保文件夹有 subfolders 数组
    if (!targetNoteFolder.subfolders) {
      targetNoteFolder.subfolders = [];
    }

    // 将文件夹插入到文件所在文件夹的子文件夹列表的开头
    targetNoteFolder.subfolders.unshift(folder);

    // 展开目标文件夹以显示新添加的子文件夹
    targetNoteFolder.expanded = true;
  }
}

// 辅助函数：从所有文件夹中删除笔记
function removeNoteFromAllFolders(noteId: string) {
  function removeFromFolder(folder: Folder): boolean {
    const index = folder.notes.findIndex((n) => n.id === noteId);
    if (index > -1) {
      folder.notes.splice(index, 1);
      return true;
    }
    if (folder.subfolders) {
      for (const subfolder of folder.subfolders) {
        if (removeFromFolder(subfolder)) return true;
      }
    }
    return false;
  }

  for (const folder of folders.value) {
    removeFromFolder(folder);
  }
}

// 辅助函数：从所有文件夹中删除文件夹
function removeFolderFromAllFolders(folderId: string) {
  // 从根目录删除
  const rootIndex = folders.value.findIndex((f) => f.id === folderId);
  if (rootIndex > -1) {
    folders.value.splice(rootIndex, 1);
    return;
  }

  // 从子文件夹中删除
  function removeFromFolder(folder: Folder): boolean {
    if (!folder.subfolders) return false;
    const index = folder.subfolders.findIndex((f) => f.id === folderId);
    if (index > -1) {
      folder.subfolders.splice(index, 1);
      return true;
    }
    for (const subfolder of folder.subfolders) {
      if (removeFromFolder(subfolder)) return true;
    }
    return false;
  }

  for (const folder of folders.value) {
    removeFromFolder(folder);
  }
}

// 辅助函数：根据ID查找文件夹
function findFolderById(folderId: string): Folder | null {
  return findFolder(folders.value, folderId);
}

// 辅助函数：查找文件夹的父文件夹
function findParentFolder(folderId: string): Folder | null {
  function findParent(folderList: Folder[]): Folder | null {
    for (const folder of folderList) {
      if (
        folder.subfolders &&
        folder.subfolders.some((f) => f.id === folderId)
      ) {
        return folder;
      }
      if (folder.subfolders) {
        const found = findParent(folder.subfolders);
        if (found) return found;
      }
    }
    return null;
  }

  return findParent(folders.value);
}

// 辅助函数：根据笔记ID查找所在文件夹
function findFolderByNoteId(noteId: string): Folder | null {
  function findInFolder(folder: Folder): Folder | null {
    if (folder.notes.some((n) => n.id === noteId)) {
      return folder;
    }
    if (folder.subfolders) {
      for (const subfolder of folder.subfolders) {
        const found = findInFolder(subfolder);
        if (found) return found;
      }
    }
    return null;
  }

  for (const folder of folders.value) {
    const found = findInFolder(folder);
    if (found) return found;
  }
  return null;
}

// 辅助函数：检查是否是子文件夹（防止循环嵌套）
function isChildFolder(parentId: string, childId: string): boolean {
  const parentFolder = findFolderById(parentId);
  if (!parentFolder) return false;

  function checkChild(folder: Folder): boolean {
    if (folder.id === childId) return true;
    if (folder.subfolders) {
      for (const subfolder of folder.subfolders) {
        if (checkChild(subfolder)) return true;
      }
    }
    return false;
  }

  return checkChild(parentFolder);
}

// 键盘事件处理函数
function handleKeyDown(event: KeyboardEvent) {
  // Ctrl + Tab: 切换侧边栏
  if (event.ctrlKey && event.key === "Tab") {
    event.preventDefault();
    event.stopPropagation();
    handleToggleCollapse();
    return;
  }

  // Escape: 阻止默认行为
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
  }
}

// 生成时间戳标题（年月日时分秒）
function generateTimeTitle(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}${hour}${minute}${second}`;
}

// 查找或创建"小记"文件夹
function findOrCreateQuickNotesFolder(): Folder {
  // 查找是否已存在"小记"文件夹
  let quickNotesFolder = folders.value.find((f) => f.name === "小记");

  if (!quickNotesFolder) {
    // 如果不存在，创建新文件夹
    quickNotesFolder = {
      id: "quick-notes-" + Date.now().toString(),
      name: "小记",
      expanded: true,
      notes: [],
      subfolders: [],
    };
    folders.value.push(quickNotesFolder);
  }

  return quickNotesFolder;
}

// 设置 onEnter 处理器
function setupOnEnterHandler() {
  if (!window.naimo || !window.naimo.onEnter) {
    console.warn("naimo.onEnter 不可用");
    return;
  }

  window.naimo.onEnter(async (params: any) => {
    try {
      console.log("功能被触发:", params);

      // 判断是否是小记功能
      if (params.fullPath && params.fullPath.endsWith("quick-note")) {
        let content = "";

        // 1. 优先从 files 中获取内容
        if (params.files && params.files.length > 0) {
          const file = params.files[0];
          try {
            // 使用 preload 中的 API 读取文件内容
            content = (window as any).myPluginAPI.readLocalTextFile(file.path);
          } catch (error) {
            console.error("读取文件失败:", error);
            await window.naimo.system.notify("读取文件失败", "错误");
            return;
          }
        }
        // 2. 如果没有文件，则从 searchText 获取
        else if (params.searchText) {
          content = params.searchText;
        }

        // 3. 如果都没有内容，提示用户
        if (!content || content.trim() === "") {
          await window.naimo.system.notify("请输入内容或拖入文件", "提示");
          return;
        }

        // 4. 保存到"小记"文件夹
        try {
          // 查找或创建"小记"文件夹
          const quickNotesFolder = findOrCreateQuickNotesFolder();

          // 生成时间戳标题
          const title = generateTimeTitle();
          const noteId = Date.now().toString();

          // 保存内容到文件
          const filePath = await (window as any).myPluginAPI.saveNoteToFile(
            noteId,
            content
          );

          // 创建新笔记
          const newNote: Note = {
            id: noteId,
            title: title,
            filePath: filePath,
            folderId: quickNotesFolder.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          // 添加到文件夹（添加到开头）
          quickNotesFolder.notes.unshift(newNote);

          // 展开"小记"文件夹
          quickNotesFolder.expanded = true;

          // 保存数据到数据库
          await saveData();

          // 选中新创建的笔记
          currentNoteId.value = newNote.id;

          // 提示用户
          await window.naimo.system.notify(`小记已保存：${title}`, "成功");
          console.log("小记保存成功:", title);
        } catch (error) {
          console.error("保存小记失败:", error);
          await window.naimo.system.notify("保存小记失败", "错误");
        }
      }
    } catch (error) {
      console.error("处理 onEnter 事件失败:", error);
    }
  });
}

onMounted(() => {
  loadData();
  document.addEventListener("keydown", handleKeyDown);
  setupOnEnterHandler();
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeyDown);
});
</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  background: #ffffff;
  overflow: hidden;
}

.editor-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fafafa;
  color: #9ca3af;
  width: 100%;
  height: 100%;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
}
</style>
