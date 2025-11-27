import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext";

// ✅ Import Leaflet CSS globally for all maps
import 'leaflet/dist/leaflet.css';

// ثبت Service Worker برای PWA - موقتاً غیرفعال برای رفع مشکل
// if ('serviceWorker' in navigator) {
//   navigator.serviceWorker
//     .register('/sw.js')
//     .then((registration) => {
//       console.log('✅ Service Worker registered:', registration.scope);
//     })
//     .catch((error) => {
//       console.error('❌ Service Worker registration failed:', error);
//     });
// }

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
