// Installed web app (PWA): files opened from the operating system, files shared
// from other apps, and the "Install app" button. None of this runs in the desktop
// app (Tauri), which has its own installer.
//
// public/sw.js is registered only to receive shared files (see the comment there):
// it caches nothing and makes no requests, so files still never leave the device.
import { useEffect, useState } from 'react';
import { isDesktop } from './desktop';

const enabled = !isDesktop && typeof window !== 'undefined' && 'serviceWorker' in navigator && window.isSecureContext;

/** Registers the service worker once the page has loaded (web build only). */
export function registerServiceWorker() {
  if (!enabled || !import.meta.env.PROD) return;
  const register = () => void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

interface LaunchParams {
  files: readonly { kind: string; getFile?: () => Promise<File> }[];
}
interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => void): void;
}

/**
 * Calls `onFiles` with the files the app was opened with: from the OS ("Open with",
 * double-click; manifest file_handlers) or shared from another app (share_target).
 * `onError` gets a message if shared files could not be picked up.
 */
export function receiveLaunchedFiles(onFiles: (files: File[]) => void, onError: (message: string) => void) {
  if (isDesktop) return;
  const queue = (window as { launchQueue?: LaunchQueue }).launchQueue;
  queue?.setConsumer((params) => {
    const handles = (params.files ?? []).filter((h) => h.kind === 'file' && h.getFile);
    if (!handles.length) return;
    void Promise.all(handles.map((h) => h.getFile!())).then(onFiles, () => onError('Could not read the opened file.'));
  });

  const url = new URL(window.location.href);
  const id = url.searchParams.get('share-target');
  if (id === null) return;
  url.searchParams.delete('share-target');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  if (!enabled) return;
  void sharedFiles(id).then(
    (files) => (files.length ? onFiles(files) : onError('The shared files are no longer available. Please share them again.')),
    () => onError('The shared files are no longer available. Please share them again.'),
  );
}

/** Asks the service worker for the files shared under `id`. */
async function sharedFiles(id: string): Promise<File[]> {
  const reg = await navigator.serviceWorker.ready;
  const worker = navigator.serviceWorker.controller ?? reg.active;
  if (!worker) return [];
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => reject(new Error('timeout')), 10_000);
    channel.port1.onmessage = (e: MessageEvent<{ files?: File[] }>) => {
      clearTimeout(timer);
      resolve(e.data.files ?? []);
    };
    worker.postMessage({ type: 'share-target-files', id }, [channel.port2]);
  });
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (!isDesktop && typeof window !== 'undefined') {
  // Chrome and Edge fire this when the app can be installed. Keep it for the button
  // instead of the browser's own mini-infobar.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

/** The browser's install prompt, or null when the app can't be installed from here (or is already). */
export function useInstallPrompt(): (() => void) | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  if (!deferred) return null;
  const event = deferred;
  return () => {
    void event.prompt().catch(() => undefined);
    // The prompt can be shown only once per event.
    deferred = null;
    notify();
  };
}

/** Images opened or shared with the app, waiting for the Images to PDF tool to pick them up. */
let launchedImages: File[] = [];
export const setLaunchedImages = (files: File[]) => void (launchedImages = files);
/** Takes the waiting images (once). */
export function takeLaunchedImages(): File[] {
  const files = launchedImages;
  launchedImages = [];
  return files;
}
