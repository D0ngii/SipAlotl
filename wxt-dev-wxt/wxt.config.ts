import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html

  // # apply-onion/wxt.config.ts

export default defineConfig({
  manifest: {
    name: 'SipAlotl',
    version: '0.1.0',
    version_name: '0.1.0',

    options_ui: {
      page: 'popup/index.html',
      open_in_tab: false
    },

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
    modules: ['@wxt-dev/auto-icons'],

    // icons: {
    //   16:  'icon/icon-16.png',
    //   24:  'icon/icon-24.png',
    //   32:  'icon/icon-32.png',
    //   48:  'icon/icon-48.png',
    //   96:  'icon/icon-96.png',
    //   128: 'icon/icon-128.png'
    // }
  }
});
