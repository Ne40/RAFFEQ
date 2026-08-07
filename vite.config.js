import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const pages = [
  'index', 'login', 'register', 'forgot-password', 'reset-password', 'auth-callback',
  'dashboard', 'designer-dashboard', 'company-dashboard', 'engineering-dashboard',
  'profession', 'new-project', 'project-type', 'room-details', 'room-area', 'choose-style', 'choose-colors',
  'budget', 'requirements', 'project-payment', 'upload-images',
  'ai-processing', 'ai-result', 'execution-offices',
  'marketplace', 'product-details', 'cart', 'checkout', 'order-success',
  'projects', 'saved-designs', 'service-request', 'provider-requests', 'chat',
  'profile', 'settings', 'contact', 'about'
];

export default defineConfig(({ command }) => ({
  // Local development stays on http://localhost:5173/.
  // Production is deployed as a GitHub project site under /RAFFEQ/.
  base: command === 'build' ? '/RAFFEQ/' : '/',
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        pages.map((page) => [page, resolve(__dirname, `${page}.html`)])
      )
    }
  }
}));
