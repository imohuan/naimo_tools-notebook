<template>
  <div class="markdown-editor">
    <div id="vditor" ref="vditorRef"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import Vditor from "vditor";
import "vditor/dist/index.css";

interface Note {
  id: string;
  title: string;
  content: string; // BlockEditor 期望 content 必需（从文件加载后）
  filePath?: string;
  folderId?: string;
  createdAt: number;
  updatedAt: number;
}

const props = defineProps<{
  note: Note;
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
let currentToolbarMode = ""; // 当前工具栏模式
let resizeTimer: NodeJS.Timeout | null = null; // 防抖定时器

// 创建自定义侧边栏切换按钮
function createSidebarToggleButton() {
  return {
    name: "sidebar-toggle",
    tipPosition: "s",
    tip: props.isSidebarCollapsed ? "展开侧边栏" : "隐藏侧边栏",
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

// 定义不同宽度下的工具栏配置
const toolbarConfigs = {
  full: [
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
    "preview",
    "|",
    createSidebarToggleButton(),
  ],
  medium: [
    "headings",
    "bold",
    "italic",
    "strike",
    "|",
    "list",
    "ordered-list",
    "check",
    "|",
    "code",
    "link",
    "table",
    "|",
    "undo",
    "redo",
    "|",
    "preview",
    "|",
    createSidebarToggleButton(),
  ],
  compact: [
    "headings",
    "bold",
    "italic",
    "|",
    "list",
    "ordered-list",
    "|",
    "code",
    "link",
    "|",
    "undo",
    "redo",
    "|",
    "preview",
    "|",
    createSidebarToggleButton(),
  ],
  minimal: [
    "bold",
    "italic",
    "|",
    "list",
    "|",
    "link",
    "|",
    "undo",
    "redo",
    "|",
    createSidebarToggleButton(),
  ],
};

// 根据宽度获取工具栏配置
function getToolbarByWidth(width: number): string {
  if (width >= 800) return "full";
  if (width >= 600) return "medium";
  if (width >= 400) return "compact";
  return "minimal";
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

  // 查找所有图片元素
  const images = editorElement.querySelectorAll("img");
  console.log("convertLocalImagesToBase64: 找到", images.length, "个图片元素");

  for (const img of Array.from(images)) {
    const src = img.getAttribute("src");

    // 只处理本地路径（包含 notebook_images 的路径）且还没有转换过的图片
    if (src && src.includes("notebook_images") && !src.startsWith("data:")) {
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
          // 添加标记，表示这是转换后的图片，避免重复转换
          img.setAttribute("data-original-path", src);
        } else {
          console.log("图片转换失败，返回空:", src);
        }
      } catch (error) {
        console.error("转换本地图片失败:", src, error);
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
            src.includes("notebook_images") &&
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
function initVditor(toolbarMode?: string) {
  if (!vditorRef.value) return;

  // 获取当前内容（如果正在重新初始化）
  const currentContent = vditor?.getValue() || props.note.content || "";

  // 如果没有指定工具栏模式，根据当前宽度决定
  if (!toolbarMode) {
    const width = vditorRef.value.offsetWidth;
    toolbarMode = getToolbarByWidth(width);
  }

  // 如果工具栏模式没变，不需要重新初始化
  if (vditor && toolbarMode === currentToolbarMode) {
    return;
  }

  currentToolbarMode = toolbarMode;

  // 销毁旧的实例
  if (vditor) {
    vditor.destroy();
    vditor = null;
  }

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
    toolbar: toolbarConfigs[toolbarMode as keyof typeof toolbarConfigs],
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
      vditor?.setValue(currentContent);
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
    // 防抖处理，避免频繁重新初始化
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }

    resizeTimer = setTimeout(() => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const newToolbarMode = getToolbarByWidth(width);

        // 如果工具栏模式改变，重新初始化
        if (newToolbarMode !== currentToolbarMode) {
          initVditor(newToolbarMode);
        }
      }
    }, 300); // 300ms 防抖延迟
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
    // 侧边栏状态改变时，重新初始化编辑器以更新按钮图标和提示
    if (vditor) {
      initVditor(currentToolbarMode);
    }
  }
);

onMounted(() => {
  initVditor();
  setupResizeObserver();
  // 设置图片监听器，延迟以确保 Vditor 已初始化
  setTimeout(() => {
    imageObserver = setupImageObserver();
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
  if (vditor) {
    vditor.destroy();
    vditor = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
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
  flex-wrap: wrap;
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
:deep(.vditor-ir pre.vditor-reset ul),
:deep(.vditor-ir pre.vditor-reset ol) {
  padding-left: 24px;
}

:deep(.vditor-ir pre.vditor-reset li) {
  margin: 4px 0;
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
</style>
