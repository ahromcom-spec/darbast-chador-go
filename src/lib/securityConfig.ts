// تنظیمات امنیتی برای محافظت از سایت

export const securityConfig = {
  // غیرفعال کردن دسترسی به اطلاعات فنی
  hideFramework: true,
  
  // محافظت از کد منبع
  protectSourceCode: true,
  
  // غیرفعال کردن DevTools
  disableDevTools: true,
  
  // محافظت از محتوا
  disableRightClick: true,
  disableCopy: true,
  disableTextSelection: true,
  
  // پاک کردن console در production
  clearConsoleInProduction: true,
  
  // Security Headers
  securityHeaders: {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  }
};

// تابع برای اعمال محافظت‌های اضافی
export const applySecurityMeasures = () => {
  // حذف اطلاعات فنی از DOM
  if (import.meta.env.PROD) {
    // حذف کامنت‌ها
    const removeComments = (node: Node) => {
      for (let i = node.childNodes.length - 1; i >= 0; i--) {
        const child = node.childNodes[i];
        if (child.nodeType === 8) {
          node.removeChild(child);
        } else if (child.nodeType === 1) {
          removeComments(child);
        }
      }
    };
    
    removeComments(document.body);
    
    // حذف data attributes که اطلاعات فنی دارند
    document.querySelectorAll('[data-testid], [data-component], [data-framework]').forEach(el => {
      el.removeAttribute('data-testid');
      el.removeAttribute('data-component');
      el.removeAttribute('data-framework');
    });
  }
};

// اضافه کردن محافظت به window object
export const protectGlobalScope = () => {
  if (import.meta.env.PROD) {
    // مخفی کردن اطلاعات React/Vite
    Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
      get() {
        throw new Error('Access denied');
      },
      set() {
        throw new Error('Access denied');
      }
    });
  }
};
