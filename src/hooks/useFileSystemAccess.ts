import { useState, useCallback, useEffect } from 'react';

// Extend Window interface for File System Access API
declare global {
  interface Window {
    showOpenFilePicker?: (options?: {
      multiple?: boolean;
      excludeAcceptAllOption?: boolean;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<FileSystemFileHandle[]>;
  }
}

interface StoredDirectoryHandle {
  handle: FileSystemDirectoryHandle;
  name: string;
}

const STORAGE_KEY = 'last_excel_directory_handle';

export function useFileSystemAccess() {
  const [isSupported, setIsSupported] = useState(false);
  const [lastDirectoryHandle, setLastDirectoryHandle] = useState<StoredDirectoryHandle | null>(null);

  // Check if File System Access API is supported
  useEffect(() => {
    const supported = 'showOpenFilePicker' in window;
    setIsSupported(supported);
    console.log('[useFileSystemAccess] File System Access API supported:', supported);
  }, []);

  // Open file picker using File System Access API
  const openFilePicker = useCallback(async (): Promise<{ name: string; size: number; buffer: ArrayBuffer } | null> => {
    if (!isSupported || !window.showOpenFilePicker) {
      console.log('[useFileSystemAccess] API not supported, falling back');
      return null;
    }

    try {
      const [fileHandle] = await window.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: 'Excel Files',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
              'application/vnd.ms-excel': ['.xls']
            }
          }
        ]
      });

      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();

      // Try to get the parent directory handle for future use
      // Note: This requires the user to have granted permission
      // We can't directly get parent from file handle, but we can remember this worked
      console.log('[useFileSystemAccess] File selected:', file.name);

      return {
        name: file.name,
        size: file.size,
        buffer
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled the picker
        console.log('[useFileSystemAccess] User cancelled file picker');
        return null;
      }
      console.error('[useFileSystemAccess] Error opening file picker:', error);
      return null;
    }
  }, [isSupported]);

  // Open directory picker and let user select a file from it
  const openDirectoryPicker = useCallback(async (): Promise<{ name: string; size: number; buffer: ArrayBuffer } | null> => {
    if (!isSupported) {
      return null;
    }

    try {
      // @ts-ignore - showDirectoryPicker might not be in types
      if (!window.showDirectoryPicker) {
        return null;
      }

      // @ts-ignore
      const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
        mode: 'read'
      });

      setLastDirectoryHandle({ handle: dirHandle, name: dirHandle.name });
      
      // After getting directory access, use file picker to select file
      return await openFilePicker();
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null;
      }
      console.error('[useFileSystemAccess] Error opening directory picker:', error);
      return null;
    }
  }, [isSupported, openFilePicker]);

  return {
    isSupported,
    openFilePicker,
    openDirectoryPicker,
    lastDirectoryName: lastDirectoryHandle?.name || null
  };
}
