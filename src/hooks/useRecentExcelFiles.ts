import { useState, useEffect, useCallback } from 'react';

interface RecentExcelFile {
  name: string;
  size: number;
  buffer: ArrayBuffer;
  addedAt: number;
}

const STORAGE_KEY = 'recent_excel_files';
const MAX_RECENT_FILES = 5;

export function useRecentExcelFiles() {
  const [recentFiles, setRecentFiles] = useState<RecentExcelFile[]>([]);

  // Load recent files from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { name: string; size: number; base64: string; addedAt: number }[];
        // Convert base64 back to ArrayBuffer
        const files: RecentExcelFile[] = parsed.map(f => ({
          name: f.name,
          size: f.size,
          buffer: base64ToArrayBuffer(f.base64),
          addedAt: f.addedAt
        }));
        setRecentFiles(files);
      }
    } catch (error) {
      console.error('[useRecentExcelFiles] Error loading recent files:', error);
    }
  }, []);

  // Convert ArrayBuffer to base64 for storage
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Convert base64 back to ArrayBuffer
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Add a file to recent files
  const addRecentFile = useCallback((file: { name: string; size: number; buffer: ArrayBuffer }) => {
    setRecentFiles(prev => {
      // Remove duplicates by name
      const filtered = prev.filter(f => f.name !== file.name);
      
      // Add new file at the beginning
      const updated: RecentExcelFile[] = [
        { ...file, addedAt: Date.now() },
        ...filtered
      ].slice(0, MAX_RECENT_FILES);

      // Save to localStorage
      try {
        const toStore = updated.map(f => ({
          name: f.name,
          size: f.size,
          base64: arrayBufferToBase64(f.buffer),
          addedAt: f.addedAt
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      } catch (error) {
        console.error('[useRecentExcelFiles] Error saving recent files:', error);
      }

      return updated;
    });
  }, []);

  // Remove a file from recent files
  const removeRecentFile = useCallback((name: string) => {
    setRecentFiles(prev => {
      const updated = prev.filter(f => f.name !== name);
      
      try {
        const toStore = updated.map(f => ({
          name: f.name,
          size: f.size,
          base64: arrayBufferToBase64(f.buffer),
          addedAt: f.addedAt
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      } catch (error) {
        console.error('[useRecentExcelFiles] Error saving recent files:', error);
      }

      return updated;
    });
  }, []);

  // Clear all recent files
  const clearRecentFiles = useCallback(() => {
    setRecentFiles([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('[useRecentExcelFiles] Error clearing recent files:', error);
    }
  }, []);

  return {
    recentFiles,
    addRecentFile,
    removeRecentFile,
    clearRecentFiles
  };
}
