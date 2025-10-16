/// <reference path="../typings/naimo.d.ts" />

import { contextBridge } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// ==================== 类型定义 ====================

/**
 * 获取当前时间
 */
function getCurrentTime(): string {
  return new Date().toLocaleString('zh-CN');
}

/**
 * 格式化文本（转大写）
 */
function formatText(text: string): string {
  return text.toUpperCase();
}

/**
 * 获取数据
 */
async function fetchData(url: string): Promise<any> {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error('数据获取失败:', error);
    throw error;
  }
}

// ==================== 目录管理 ====================

/**
 * 获取笔记应用根目录
 */
async function getNotebookRootDir(): Promise<string> {
  const userDataPath = await (window as any).naimo?.system?.getPath('userData') || './userData';
  const notebookDir = path.join(userDataPath, 'notebook');

  // 确保目录存在
  if (!fs.existsSync(notebookDir)) {
    fs.mkdirSync(notebookDir, { recursive: true });
  }

  return notebookDir;
}

// ==================== 图片管理 ====================

/**
 * 获取图片目录
 */
async function getClipboardImagesDir(): Promise<string> {
  const notebookDir = await getNotebookRootDir();
  const imagesDir = path.join(notebookDir, 'images');

  // 确保目录存在
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  return imagesDir;
}

/**
 * 生成基于时间的文件名
 */
function generateImageFileName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}-${hour}-${minute}-${second}-${ms}.png`;
}

/**
 * 保存 base64 图片到本地
 */
async function saveImageFromBase64(base64Data: string): Promise<string> {
  try {
    const imagesDir = await getClipboardImagesDir();
    const fileName = generateImageFileName();
    const filePath = path.join(imagesDir, fileName);

    // 移除 data:image/xxx;base64, 前缀
    const base64WithoutPrefix = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64WithoutPrefix, 'base64');

    fs.writeFileSync(filePath, buffer);

    return filePath;
  } catch (error) {
    console.error('保存图片失败:', error);
    throw error;
  }
}

/**
 * 从内容中提取所有图片路径
 */
async function extractImagePaths(content: string): Promise<string[]> {
  const imagePaths: string[] = [];
  const imagesDir = await getClipboardImagesDir();

  // 匹配 markdown 图片语法: ![](path)
  const regex = /!\[.*?\]\((.*?)\)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const imagePath = match[1];
    // 只处理本地图片路径（在 images 目录下的或包含 notebook 的）
    if (imagePath.includes('\\images\\') || imagePath.includes('/images/') || imagePath.includes('notebook') || imagePath.startsWith(imagesDir)) {
      imagePaths.push(imagePath);
    }
  }

  return imagePaths;
}

/**
 * 删除图片文件
 */
function deleteImage(imagePath: string): boolean {
  try {
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('删除图片失败:', error);
    return false;
  }
}

/**
 * 检查内容中是否包含图片
 */
async function hasImages(content: string): Promise<boolean> {
  const paths = await extractImagePaths(content);
  return paths.length > 0;
}

// ==================== 笔记文件管理 ====================

/**
 * 获取笔记存储目录
 */
async function getNotesStorageDir(): Promise<string> {
  const notebookDir = await getNotebookRootDir();
  const notesDir = path.join(notebookDir, 'notes');

  // 确保目录存在
  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir, { recursive: true });
  }

  return notesDir;
}

/**
 * 生成基于时间的笔记文件名
 */
function generateNoteFileName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}-${hour}-${minute}-${second}-${ms}.md`;
}

/**
 * 创建新笔记文件（生成新的文件名）
 * @param noteId 笔记ID（已废弃，保留参数以兼容现有代码）
 * @param content 笔记内容
 * @returns 文件路径
 */
async function saveNoteToFile(noteId: string, content: string): Promise<string> {
  // noteId 参数保留以兼容现有代码，但不再使用
  void noteId;

  try {
    const notesDir = await getNotesStorageDir();
    const fileName = generateNoteFileName();
    const filePath = path.join(notesDir, fileName);

    fs.writeFileSync(filePath, content, 'utf-8');

    return filePath;
  } catch (error) {
    console.error('保存笔记文件失败:', error);
    throw error;
  }
}

/**
 * 更新现有笔记文件内容（使用已有的文件路径）
 * @param filePath 文件路径
 * @param content 笔记内容
 */
function updateNoteFile(filePath: string, content: string): void {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (error) {
    console.error('更新笔记文件失败:', error);
    throw error;
  }
}

/**
 * 从文件加载笔记内容
 * @param filePath 文件路径
 * @returns 笔记内容
 */
function loadNoteFromFile(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn('笔记文件不存在:', filePath);
      return '';
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error('读取笔记文件失败:', error);
    return '';
  }
}

/**
 * 删除笔记文件
 * @param filePath 文件路径
 */
function deleteNoteFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('删除笔记文件失败:', error);
    return false;
  }
}

/**
 * 读取本地文本文件内容（用于从外部拖入的文件）
 */
function readLocalTextFile(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('文件不存在');
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error('读取文件失败:', error);
    throw error;
  }
}

// ==================== 暴露插件 API ====================

const myPluginAPI = {
  getCurrentTime,
  formatText,
  fetchData,
  // 目录管理 API
  getNotebookRootDir,
  // 图片相关 API
  saveImageFromBase64,
  extractImagePaths,
  deleteImage,
  hasImages,
  getClipboardImagesDir,
  // 笔记文件管理 API
  getNotesStorageDir,
  saveNoteToFile,
  updateNoteFile,
  loadNoteFromFile,
  deleteNoteFile,
  readLocalTextFile
};

contextBridge.exposeInMainWorld('myPluginAPI', myPluginAPI);

// ==================== 功能处理器导出 ====================

/**
 * 导出功能处理器
 * 类型定义来自 naimo.d.ts
 */
const handlers = {
  hello: {
    onEnter: async (params: any) => {
      console.log('Hello World 功能被触发');
      console.log('参数:', params);

      // 这里可以做一些初始化工作
      // 例如：加载数据、设置状态等

      // 发送日志
      if (typeof window !== 'undefined' && (window as any).naimo) {
        (window as any).naimo.log.info('插件已加载', { params });
      }
    }
  }
};

// 使用 CommonJS 导出（Electron 环境）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = handlers;
}

// ==================== 初始化 ====================

window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload 脚本已初始化');
  console.log('当前时间:', getCurrentTime());
});

// ==================== 类型扩展 ====================

declare global {
  interface Window {
    myPluginAPI: typeof myPluginAPI;
  }
}

