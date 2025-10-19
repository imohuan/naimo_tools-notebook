"use strict";
const electron = require("electron");
const fs = require("fs");
const path = require("path");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
function getCurrentTime() {
  return (/* @__PURE__ */ new Date()).toLocaleString("zh-CN");
}
function formatText(text) {
  return text.toUpperCase();
}
async function fetchData(url) {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error("数据获取失败:", error);
    throw error;
  }
}
async function getNotebookRootDir() {
  const userDataPath = await window.naimo?.system?.getPath("userData") || "./userData";
  const notebookDir = path__namespace.join(userDataPath, "notebook");
  if (!fs__namespace.existsSync(notebookDir)) {
    fs__namespace.mkdirSync(notebookDir, { recursive: true });
  }
  return notebookDir;
}
async function getClipboardImagesDir() {
  const notebookDir = await getNotebookRootDir();
  const imagesDir = path__namespace.join(notebookDir, "images");
  if (!fs__namespace.existsSync(imagesDir)) {
    fs__namespace.mkdirSync(imagesDir, { recursive: true });
  }
  return imagesDir;
}
function generateImageFileName() {
  const now = /* @__PURE__ */ new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day}-${hour}-${minute}-${second}-${ms}.png`;
}
async function saveImageFromBase64(base64Data) {
  try {
    const imagesDir = await getClipboardImagesDir();
    const fileName = generateImageFileName();
    const filePath = path__namespace.join(imagesDir, fileName);
    const base64WithoutPrefix = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64WithoutPrefix, "base64");
    fs__namespace.writeFileSync(filePath, buffer);
    return filePath;
  } catch (error) {
    console.error("保存图片失败:", error);
    throw error;
  }
}
async function extractImagePaths(content) {
  const imagePaths = [];
  const imagesDir = await getClipboardImagesDir();
  const regex = /!\[.*?\]\((.*?)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const imagePath = match[1];
    if (imagePath.includes("\\images\\") || imagePath.includes("/images/") || imagePath.includes("notebook") || imagePath.startsWith(imagesDir)) {
      imagePaths.push(imagePath);
    }
  }
  return imagePaths;
}
function deleteImage(imagePath) {
  try {
    if (fs__namespace.existsSync(imagePath)) {
      fs__namespace.unlinkSync(imagePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error("删除图片失败:", error);
    return false;
  }
}
async function hasImages(content) {
  const paths = await extractImagePaths(content);
  return paths.length > 0;
}
async function getNotesStorageDir() {
  const notebookDir = await getNotebookRootDir();
  const notesDir = path__namespace.join(notebookDir, "notes");
  if (!fs__namespace.existsSync(notesDir)) {
    fs__namespace.mkdirSync(notesDir, { recursive: true });
  }
  return notesDir;
}
function generateNoteFileName() {
  const now = /* @__PURE__ */ new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day}-${hour}-${minute}-${second}-${ms}.md`;
}
async function saveNoteToFile(noteId, content) {
  try {
    const notesDir = await getNotesStorageDir();
    const fileName = generateNoteFileName();
    const filePath = path__namespace.join(notesDir, fileName);
    fs__namespace.writeFileSync(filePath, content, "utf-8");
    return filePath;
  } catch (error) {
    console.error("保存笔记文件失败:", error);
    throw error;
  }
}
function updateNoteFile(filePath, content) {
  try {
    fs__namespace.writeFileSync(filePath, content, "utf-8");
  } catch (error) {
    console.error("更新笔记文件失败:", error);
    throw error;
  }
}
function loadNoteFromFile(filePath) {
  try {
    if (!fs__namespace.existsSync(filePath)) {
      console.warn("笔记文件不存在:", filePath);
      return "";
    }
    return fs__namespace.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error("读取笔记文件失败:", error);
    return "";
  }
}
function deleteNoteFile(filePath) {
  try {
    if (fs__namespace.existsSync(filePath)) {
      fs__namespace.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error("删除笔记文件失败:", error);
    return false;
  }
}
function readLocalTextFile(filePath) {
  try {
    if (!fs__namespace.existsSync(filePath)) {
      throw new Error("文件不存在");
    }
    return fs__namespace.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error("读取文件失败:", error);
    throw error;
  }
}
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
electron.contextBridge.exposeInMainWorld("myPluginAPI", myPluginAPI);
const handlers = {
  hello: {
    onEnter: async (params) => {
      console.log("Hello World 功能被触发");
      console.log("参数:", params);
      if (typeof window !== "undefined" && window.naimo) {
        window.naimo.log.info("插件已加载", { params });
      }
    }
  }
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = handlers;
}
window.addEventListener("DOMContentLoaded", () => {
  console.log("Preload 脚本已初始化");
  console.log("当前时间:", getCurrentTime());
});
