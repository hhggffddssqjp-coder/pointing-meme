/// <reference types="vite/client" />

/** 在 Claude Artifact 裡執行時才會有的執行環境 */
interface ClaudeDownloads {
  save(request: { filename: string; data: Blob }): Promise<{ status: 'saved' | 'delivered' }>;
}

interface Window {
  claude?: {
    use(name: 'downloads'): Promise<ClaudeDownloads | null>;
  };
}
