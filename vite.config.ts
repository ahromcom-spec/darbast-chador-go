import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core vendors - بارگذاری اولیه
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-core';
          }
          if (id.includes('node_modules/react-router-dom')) {
            return 'router';
          }
          
          // UI Components - بارگذاری تنبل
          if (id.includes('@radix-ui')) {
            return 'ui-components';
          }
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          
          // Backend - بارگذاری تنبل
          if (id.includes('@supabase') || id.includes('@tanstack/react-query')) {
            return 'backend';
          }
          
          // Forms - بارگذاری تنبل
          if (id.includes('react-hook-form') || id.includes('zod')) {
            return 'forms';
          }
          
          // Admin pages - جدا از بقیه
          if (id.includes('src/pages/admin')) {
            return 'admin-pages';
          }
        },
      },
    },
    cssCodeSplit: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info']
      }
    },
    chunkSizeWarningLimit: 500,
    target: 'esnext',
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
}));
