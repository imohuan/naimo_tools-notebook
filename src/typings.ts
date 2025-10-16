/**
 * 笔记应用通用类型定义
 */

export interface Note {
  id: string;
  title: string;
  filePath: string; // 笔记文件路径
  folderId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  expanded: boolean;
  notes: Note[];
  subfolders?: Folder[];
}

export interface DragItem {
  type: "folder" | "note";
  id: string;
  name: string;
  data: any;
}

