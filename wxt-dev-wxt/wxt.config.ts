import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html

  // # apply-onion/wxt.config.ts

export default defineConfig({
  manifest: {
    name: 'SipAlotl',
    version: '0.1.0',
    version_name: '0.1.0',


    action: {
      // default_popup: 'popup.html'
    },

    // Revert to original tight CSP
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
    },

    permissions: [
      'storage',
      'activeTab',
    ],

    host_permissions: [
      '<all_urls>',
      'https://*/*',
      'http://*/*'
    ],
    
    web_accessible_resources: [
      {
        resources: ['icon/*'],
        matches: ['<all_urls>']
      }
    ],
    
    modules: ['@wxt-dev/auto-icons'],

  }
});
