<template>
  <div class="markdown-editor">
    <div id="vditor" ref="vditorRef"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import Vditor from "vditor";
import "vditor/dist/index.css";

import type { Note } from "../typings";

// BlockEditor 需要包含 content 的笔记
interface NoteWithContent extends Note {
  content: string;
}

const props = defineProps<{
  note: NoteWithContent;
  isSidebarCollapsed?: boolean;
}>();

const emit = defineEmits<{
  (e: "update", content: string, title: string): void;
  (e: "toggle-sidebar"): void;
}>();

const vditorRef = ref<HTMLDivElement>();
let vditor: Vditor | null = null;
let saveTimer: NodeJS.Timeout | null = null;
let isSettingValue = false; // 标记是否正在设置初始值
let resizeObserver: ResizeObserver | null = null;
let resizeTimer: NodeJS.Timeout | null = null;

// 创建自定义侧边栏切换按钮
function createSidebarToggleButton() {
  return {
    name: "sidebar-toggle",
    tipPosition: "s",
    tip: "切换侧边栏",
    className: "sidebar-toggle-btn",
    icon: props.isSidebarCollapsed
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
           <rect x="3" y="3" width="7" height="18" rx="1" stroke-width="2" />
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12h5m-2-2l2 2-2 2" />
         </svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
           <rect x="3" y="3" width="7" height="18" rx="1" stroke-width="2" />
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12h-5m2-2l-2 2 2 2" />
         </svg>`,
    click() {
      emit("toggle-sidebar");
    },
  };
}

// 更新侧边栏切换按钮的图标和提示文本
function updateSidebarToggleButton() {
  if (!vditor || !vditorRef.value) return;

  // 找到工具栏中的侧边栏切换按钮
  const toolbarElement = vditorRef.value.querySelector(".vditor-toolbar");
  if (!toolbarElement) return;

  const sidebarToggleBtn = toolbarElement.querySelector(
    ".sidebar-toggle-btn button"
  );
  if (!sidebarToggleBtn) return;

  // 更新图标
  const newIcon = props.isSidebarCollapsed
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
         <rect x="3" y="3" width="7" height="18" rx="1" stroke-width="2" />
         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12h5m-2-2l2 2-2 2" />
       </svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
         <rect x="3" y="3" width="7" height="18" rx="1" stroke-width="2" />
         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12h-5m2-2l-2 2 2 2" />
       </svg>`;

  sidebarToggleBtn.innerHTML = newIcon;

  // 更新提示文本（aria-label）
  const newTip = "切换侧边栏";
  const parentItem = sidebarToggleBtn.closest(".vditor-toolbar__item");
  if (parentItem) {
    parentItem.setAttribute("aria-label", newTip);
    parentItem.setAttribute("data-tip", newTip);
  }
}

// 工具栏配置
const toolbarConfig = [
  "emoji",
  "headings",
  "bold",
  "italic",
  "strike",
  "|",
  "line",
  "quote",
  "list",
  "ordered-list",
  "check",
  "|",
  "code",
  "inline-code",
  "link",
  "table",
  "|",
  "undo",
  "redo",
  "|",
  "edit-mode",
  "outline",
  createSidebarToggleButton(),
];

// 不同宽度下显示的按钮（data-type）
const toolbarVisibilityByWidth = {
  minimal: ["bold", "italic", "list", "link", "undo", "redo"], // < 400px
  compact: [
    "headings",
    "bold",
    "italic",
    "list",
    "ordered-list",
    "code",
    "link",
    "undo",
    "redo",
  ], // 400-600px
  medium: [
    "headings",
    "bold",
    "italic",
    "strike",
    "list",
    "ordered-list",
    "check",
    "code",
    "link",
    "table",
    "undo",
    "redo",
  ], // 600-800px
  full: [
    "emoji",
    "headings",
    "bold",
    "italic",
    "strike",
    "line",
    "quote",
    "list",
    "ordered-list",
    "check",
    "code",
    "inline-code",
    "link",
    "table",
    "undo",
    "redo",
    "edit-mode",
    "outline",
  ], // >= 800px
};

// 根据宽度获取工具栏模式
function getToolbarMode(width: number): keyof typeof toolbarVisibilityByWidth {
  if (width >= 800) return "full";
  if (width >= 600) return "medium";
  if (width >= 400) return "compact";
  return "minimal";
}

// 动态更新工具栏按钮显示/隐藏
function updateToolbarVisibility(mode: keyof typeof toolbarVisibilityByWidth) {
  if (!vditorRef.value) return;

  const toolbar = vditorRef.value.querySelector(".vditor-toolbar");
  if (!toolbar) return;

  const visibleButtons = new Set(toolbarVisibilityByWidth[mode]);

  // 遍历所有工具栏按钮
  const items = toolbar.querySelectorAll(".vditor-toolbar__item");
  items.forEach((item) => {
    const button = item.querySelector("button[data-type]");
    if (button) {
      const dataType = button.getAttribute("data-type");

      // sidebar-toggle 按钮始终显示
      if (dataType === "sidebar-toggle") {
        (item as HTMLElement).style.display = "";
        return;
      }

      // 根据模式显示或隐藏
      if (dataType && visibleButtons.has(dataType)) {
        (item as HTMLElement).style.display = "";
      } else {
        (item as HTMLElement).style.display = "none";
      }
    }
  });

  // 处理分隔符 - 隐藏相邻的或开头/结尾的分隔符
  const dividers = toolbar.querySelectorAll(".vditor-toolbar__divider");
  dividers.forEach((divider, index) => {
    // 简单策略：在较小宽度时隐藏部分分隔符
    if (mode === "minimal" || mode === "compact") {
      if (index > 1) {
        (divider as HTMLElement).style.display = "none";
      } else {
        (divider as HTMLElement).style.display = "";
      }
    } else {
      (divider as HTMLElement).style.display = "";
    }
  });
}

// 将文件转为 base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 全局存储上传的路径映射（临时使用）
declare global {
  interface Window {
    __uploadPathMap?: { [key: string]: string };
  }
}

// 转换本地图片路径为 base64 显示
async function convertLocalImagesToBase64() {
  if (!vditor) {
    console.log("convertLocalImagesToBase64: vditor 未初始化");
    return;
  }

  const editorElement = vditorRef.value?.querySelector(".vditor-ir");
  if (!editorElement) {
    console.log("convertLocalImagesToBase64: 未找到编辑器元素");
    return;
  }

  // await new Promise((resolve) => setTimeout(resolve, 10000));

  // 查找所有图片元素
  const images = editorElement.querySelectorAll("img");
  console.log("convertLocalImagesToBase64: 找到", images.length, "个图片元素");

  for (const img of Array.from(images)) {
    const src = img.getAttribute("src");

    // 只处理本地路径（包含 images 或 notebook 的路径）且还没有转换过的图片
    if (
      src &&
      (src.includes("\\images\\") ||
        src.includes("/images/") ||
        src.includes("notebook")) &&
      !src.startsWith("data:")
    ) {
      // 检查是否已经有转换后的 base64（通过 data-original-path 判断）
      const originalPath = img.getAttribute("data-original-path");
      if (originalPath === src) {
        // 已经转换过了，跳过
        console.log("图片已转换，跳过:", src);
        continue;
      }

      try {
        console.log("开始转换本地图片:", src);
        // 使用 naimo API 获取本地图片的 base64（注意：返回的 base64 没有前缀）
        const base64WithoutPrefix = await (
          window as any
        ).naimo.system.getLocalImage(src);
        if (base64WithoutPrefix) {
          // 添加 data URI 前缀（根据文件扩展名判断 MIME 类型）
          const ext = src.split(".").pop()?.toLowerCase();
          let mimeType = "image/png";
          if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
          else if (ext === "gif") mimeType = "image/gif";
          else if (ext === "webp") mimeType = "image/webp";

          const fullBase64 = `data:${mimeType};base64,${base64WithoutPrefix}`;

          console.log("图片转换成功，更新显示");
          // 只更新显示，不修改编辑器内容
          img.src = fullBase64;
          // 添加已加载标记，CSS会根据这个class显示正常状态
          img.classList.add("local-image-loaded");
          // 添加标记，表示这是转换后的图片，避免重复转换
          img.setAttribute("data-original-path", src);
        } else {
          console.log("图片转换失败，返回空:", src);
          // 转换失败，显示错误状态
          img.classList.add("local-image-error");
        }
      } catch (error) {
        console.error("转换本地图片失败:", src, error);
        // 转换失败，显示错误状态
        img.classList.add("local-image-error");
      }
    }
  }
}

// 使用 MutationObserver 监听 DOM 变化，自动转换新出现的图片
function setupImageObserver(): MutationObserver | null {
  if (!vditorRef.value) return null;

  const editorElement = vditorRef.value.querySelector(".vditor-ir");
  if (!editorElement) return null;

  // 创建 MutationObserver 监听图片变化
  const observer = new MutationObserver((mutations) => {
    // 检查 vditor 和编辑器元素是否还存在
    if (!vditor || !vditorRef.value) {
      return;
    }

    let hasNewImages = false;

    for (const mutation of mutations) {
      // 检查是否有新增的图片节点
      if (mutation.addedNodes.length > 0) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeName === "IMG") {
            hasNewImages = true;
            break;
          }
          // 检查子节点中是否有图片
          if ((node as Element).querySelectorAll?.("img").length > 0) {
            hasNewImages = true;
            break;
          }
        }
      }

      // 检查 img 标签的 src 属性变化
      if (mutation.type === "attributes" && mutation.attributeName === "src") {
        const target = mutation.target as HTMLImageElement;
        if (target.tagName === "IMG") {
          const src = target.getAttribute("src");
          // 如果 src 被改回本地路径，需要重新转换
          if (
            src &&
            (src.includes("\\images\\") ||
              src.includes("/images/") ||
              src.includes("notebook")) &&
            !src.startsWith("data:")
          ) {
            hasNewImages = true;
          }
        }
      }
    }

    if (hasNewImages) {
      // 发现新图片，延迟转换
      setTimeout(() => {
        // 再次检查组件是否还存在
        if (vditor && vditorRef.value) {
          convertLocalImagesToBase64();
        }
      }, 100);
    }
  });

  // 开始监听
  observer.observe(editorElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],
  });

  return observer;
}

let imageObserver: MutationObserver | null = null;

// 从 markdown 内容提取标题
function extractTitle(markdown: string): string {
  if (!markdown || markdown.trim() === "") {
    return "无标题";
  }

  // 尝试匹配第一行的一级或二级标题
  const lines = markdown.split("\n");
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine) {
      // 匹配 # 标题
      const headingMatch = trimmedLine.match(/^#{1,6}\s+(.+)$/);
      if (headingMatch) {
        return headingMatch[1].slice(0, 50);
      }
      // 如果不是标题，使用第一行非空内容
      return trimmedLine.slice(0, 50);
    }
  }

  return "无标题";
}

// 保存内容（防抖）
function saveContent(content: string) {
  if (isSettingValue) {
    return; // 如果是初始化设置值，不触发保存
  }

  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    const title = extractTitle(content);
    emit("update", content, title);
  }, 500);
}

// 初始化 Vditor
function initVditor() {
  if (!vditorRef.value) return;

  // 如果已经初始化过，不重复初始化
  if (vditor) return;

  vditor = new Vditor(vditorRef.value, {
    height: "100%",
    mode: "ir", // 即时渲染模式
    placeholder: "开始编写你的笔记...",
    theme: "classic",
    icon: "material",
    toolbarConfig: {
      pin: true, // 固定工具栏
      hide: false,
    },
    hint: {
      emojiPath: "https://cdn.jsdelivr.net/npm/vditor@3.10.7/dist/images/emoji",
    },
    toolbar: toolbarConfig,
    counter: {
      enable: true,
      type: "markdown",
    },
    cache: {
      enable: false, // 禁用缓存，使用我们自己的存储
    },
    upload: {
      handler: async (files: File[]) => {
        console.log("上传处理开始，文件数量:", files.length);

        for (const file of files) {
          try {
            // 将文件转为 base64
            const base64 = await fileToBase64(file);
            // 保存到本地并获取路径
            const filePath = await (
              window as any
            ).myPluginAPI.saveImageFromBase64(base64);

            console.log("图片上传成功:", file.name, "路径:", filePath);

            // 直接插入本地路径到 Markdown（不插入 base64，避免保存时卡顿）
            const markdownImage = `![${file.name}](${filePath})\n`;
            vditor?.insertValue(markdownImage);

            console.log("已插入图片路径到编辑器，准备转换显示");

            // 立即转换显示（将 img 标签的 src 改为 base64）
            setTimeout(() => {
              convertLocalImagesToBase64();
            }, 300);
          } catch (error) {
            console.error("图片上传失败:", error);
          }
        }

        // 返回 null 表示我们已经手动处理了插入
        return null;
      },
    },
    after: () => {
      // 编辑器初始化完成后设置内容
      isSettingValue = true;
      vditor?.setValue(props.note.content || "");
      // 延迟重置标记，确保初始值设置完成
      setTimeout(() => {
        isSettingValue = false;
        // 初始化完成后，转换所有本地图片
        setTimeout(() => {
          convertLocalImagesToBase64();
        }, 500);
      }, 100);
    },
    input: (value: string) => {
      saveContent(value);
      // 不要在每次输入时都转换图片，避免干扰编辑
    },
    blur: (value: string) => {
      // 失焦时立即保存
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
      const title = extractTitle(value);
      emit("update", value, title);
    },
  });
}

// 设置 ResizeObserver 监听容器宽度变化
function setupResizeObserver() {
  if (!vditorRef.value) return;

  resizeObserver = new ResizeObserver((entries) => {
    // 防抖处理
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }

    resizeTimer = setTimeout(() => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const mode = getToolbarMode(width);
        updateToolbarVisibility(mode);
      }
    }, 100); // 100ms 防抖
  });

  resizeObserver.observe(vditorRef.value);
}

// 监听笔记变化
watch(
  () => props.note.id,
  () => {
    // 先断开旧的 observer，避免在切换时访问旧 DOM
    if (imageObserver) {
      imageObserver.disconnect();
      imageObserver = null;
    }

    if (vditor) {
      isSettingValue = true;
      vditor.setValue(props.note.content || "");
      setTimeout(() => {
        isSettingValue = false;
        // 切换笔记后，转换所有本地图片（延迟更长以确保渲染完成）
        setTimeout(() => {
          convertLocalImagesToBase64();
          // 重新设置 observer
          imageObserver = setupImageObserver();
        }, 500);
      }, 100);
    } else {
      initVditor();
    }
  }
);

// 监听侧边栏状态变化，更新工具栏按钮
watch(
  () => props.isSidebarCollapsed,
  () => {
    // 侧边栏状态改变时，只更新工具栏按钮
    updateSidebarToggleButton();
  }
);

onMounted(() => {
  initVditor();
  // 设置 ResizeObserver
  setupResizeObserver();
  // 设置图片监听器，延迟以确保 Vditor 已初始化
  setTimeout(() => {
    imageObserver = setupImageObserver();
    // 初始化后立即更新一次工具栏
    if (vditorRef.value) {
      const width = vditorRef.value.offsetWidth;
      const mode = getToolbarMode(width);
      updateToolbarVisibility(mode);
    }
  }, 1000);
});

onBeforeUnmount(() => {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  if (resizeTimer) {
    clearTimeout(resizeTimer);
  }
  if (imageObserver) {
    imageObserver.disconnect();
    imageObserver = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (vditor) {
    vditor.destroy();
    vditor = null;
  }
});
</script>

<style scoped>
.markdown-editor {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

#vditor {
  flex: 1;
  overflow: hidden;
}

/* 自定义 Vditor 样式 */
:deep(.vditor) {
  border: none;
}

:deep(.vditor-toolbar) {
  background-color: #fafafa;
  border-bottom: 1px solid #e5e7eb;
  padding: 4px 8px;
  flex-wrap: nowrap; /* 不换行，通过隐藏按钮实现响应式 */
  min-height: auto;
}

:deep(.vditor-toolbar__item) {
  border-radius: 4px;
  width: 26px;
  height: 26px;
  padding: 3px;
  margin: 2px;
}

:deep(.vditor-toolbar__item button) {
  width: 100%;
  height: 100%;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.vditor-toolbar__item svg) {
  width: 12px;
  height: 12px;
}

/* 确保图标路径也缩放 */
:deep(.vditor-toolbar__item svg path) {
  transform-origin: center;
}

:deep(.vditor-toolbar__item:hover) {
  background-color: #f3f4f6;
}

/* 工具栏分隔符 */
:deep(.vditor-toolbar__divider) {
  height: 20px;
  margin: 4px 4px;
}

:deep(.vditor-ir) {
  padding: 10px 20px;
  background: #ffffff !important; /* 移除灰色背景，使用纯白背景 */
}

:deep(.vditor-ir pre.vditor-reset) {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    sans-serif;
  font-size: 16px;
  line-height: 1.75;
  color: #1f2937;
  background: transparent !important; /* 移除 pre 标签的灰色背景 */
}

/* 标题样式 */
:deep(.vditor-ir pre.vditor-reset h1) {
  font-size: 32px;
  font-weight: 700;
  margin: 24px 0 16px;
  color: #111827;
}

:deep(.vditor-ir pre.vditor-reset h2) {
  font-size: 24px;
  font-weight: 700;
  margin: 20px 0 12px;
  color: #111827;
}

:deep(.vditor-ir pre.vditor-reset h3) {
  font-size: 20px;
  font-weight: 700;
  margin: 16px 0 8px;
  color: #111827;
}

/* 移除内容区域所有可能的灰色背景 */
:deep(.vditor-reset) {
  background: transparent !important;
}

:deep(.vditor-ir__preview) {
  background: transparent !important;
}

/* 预览模式下的列表样式 */
:deep(.vditor-ir__preview ul) {
  padding-left: 28px;
  list-style-type: disc;
  list-style-position: outside;
}

:deep(.vditor-ir__preview ol) {
  padding-left: 28px;
  list-style-type: decimal;
  list-style-position: outside;
}

:deep(.vditor-ir__preview li) {
  margin: 4px 0;
  display: list-item;
}

:deep(.vditor-ir__preview ul ul) {
  list-style-type: circle;
}

:deep(.vditor-ir__preview ul ul ul) {
  list-style-type: square;
}

/* 代码块样式 - 只增强背景色，保留原始的 padding 和其他样式 */
:deep(.vditor-ir__marker--pre) {
  background: #f6f8fa !important;
  border: 1px solid #d0d7de !important;
  border-radius: 6px;
  margin: 8px 0;
}

/* 预览模式下的代码块样式 */
:deep(.vditor-ir__preview pre) {
  background: #f6f8fa !important;
  border: 1px solid #d0d7de !important;
  border-radius: 6px;
}

/* 行内代码样式 - 小的背景高亮 */
:deep(.vditor-ir__marker--inline-code) {
  background: #f6f8fa !important;
  border: 1px solid #e1e4e8 !important;
  border-radius: 3px;
  padding: 0.2em 0.4em !important;
}

/* 引用样式 */
:deep(.vditor-ir pre.vditor-reset blockquote) {
  border-left: 4px solid #d1d5db;
  padding-left: 16px;
  color: #6b7280;
  font-style: italic;
}

/* 列表样式 */
:deep(.vditor-ir pre.vditor-reset ul) {
  padding-left: 28px;
  list-style-type: disc;
  list-style-position: outside;
}

:deep(.vditor-ir pre.vditor-reset ol) {
  padding-left: 28px;
  list-style-type: decimal;
  list-style-position: outside;
}

:deep(.vditor-ir pre.vditor-reset li) {
  margin: 4px 0;
  display: list-item;
}

/* 嵌套列表样式 */
:deep(.vditor-ir pre.vditor-reset ul ul) {
  list-style-type: circle;
}

:deep(.vditor-ir pre.vditor-reset ul ul ul) {
  list-style-type: square;
}

/* 任务列表样式（checkbox） */
:deep(.vditor-ir pre.vditor-reset li[data-type="task-list-item"]) {
  list-style-type: none;
}

:deep(
    .vditor-ir
      pre.vditor-reset
      li[data-type="task-list-item"]
      input[type="checkbox"]
  ) {
  margin-right: 8px;
}

/* 滚动条样式 */
:deep(.vditor-ir)::-webkit-scrollbar {
  width: 10px;
}

:deep(.vditor-ir)::-webkit-scrollbar-track {
  background: transparent;
}

:deep(.vditor-ir)::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 5px;
  border: 2px solid #ffffff;
  background-clip: padding-box;
}

:deep(.vditor-ir)::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
  background-clip: padding-box;
}

/* 字数统计样式 */
:deep(.vditor-counter) {
  color: #9ca3af;
  font-size: 11px;
  padding: 2px 8px;
  border-top: 1px solid #e5e7eb;
  background: #fafafa;
  min-height: auto;
  line-height: 1.5;
}

/* 修复工具栏提示信息位置 - 显示在按钮下方而不是上方 */
:deep(.vditor-tooltipped::after) {
  top: 100% !important;
  bottom: auto !important;
  margin-top: 8px !important;
}

:deep(.vditor-tooltipped::before) {
  top: 100% !important;
  bottom: auto !important;
  margin-top: 2px !important;
  border-bottom-color: rgba(0, 0, 0, 0.8) !important;
  border-top-color: transparent !important;
}

/* 确保提示框在可见范围内 */
:deep(.vditor-hint) {
  max-height: 200px;
  overflow-y: auto;
}

/* 确保提示框在可见范围内 */
:deep(.vditor-hint.vditor-panel--arrow) {
  padding: 5px 8px;
}

/* 自定义侧边栏切换按钮样式 */
:deep(.vditor-toolbar__item.sidebar-toggle-btn) {
  margin-left: auto; /* 推到最右侧 */
}

:deep(.vditor-toolbar__item.sidebar-toggle-btn button) {
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.vditor-toolbar__item.sidebar-toggle-btn:hover) {
  background-color: #e0e7ff;
}

:deep(.vditor-toolbar__item.sidebar-toggle-btn svg) {
  width: 14px;
  height: 14px;
}

/* 本地图片默认加载状态 */
:deep(.vditor-ir img) {
  width: 100%;
  height: 50px;
  object-fit: cover;
  position: relative;
}

/* 加载完成后的图片正常显示 */
:deep(.vditor-ir img.local-image-loaded) {
  width: auto;
  height: auto;
  max-width: 100%;
  opacity: 1;
  animation: fade-in 0.3s ease-in;
}

/* 加载失败状态 */
:deep(.vditor-ir img.local-image-error) {
  width: 100%;
  height: 50px;
  background: #fee;
  border: 2px dashed #f88;
  border-radius: 4px;
  opacity: 1;
}

:deep(.vditor-ir img:not(.local-image-loaded):not(.local-image-error)::after) {
  content: "图片加载中...";
  position: absolute;
  left: -5px;
  top: -5px;
  right: -5px;
  bottom: -5px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #999;
}

@keyframes loading-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
