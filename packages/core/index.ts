export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export interface FileToWrite {
  path: string;
  content: string;
}

export interface ApplyRequest {
  files: FileToWrite[];
}

export * from "./spec/index.js";
