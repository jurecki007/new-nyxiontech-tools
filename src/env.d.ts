/** package.json version, injected by vite.config.ts. */
declare const __APP_VERSION__: string;

/** The connect-src directive of the web (nginx) and desktop (Tauri) Content-Security-Policy, injected by vite.config.ts. */
declare const __CSP_CONNECT_SRC__: { web: string; desktop: string };
