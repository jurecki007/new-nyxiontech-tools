/** True inside the Windows desktop app (Tauri), false in a browser. */
export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * Asks where to save (native "Save as" dialog) and writes the file.
 * Resolves false if the user cancels. Desktop app only.
 */
export async function saveWithDialog(blob: Blob, filename: string): Promise<boolean> {
  const { invoke } = await import('@tauri-apps/api/core');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return invoke<boolean>('save_file', bytes, { headers: { 'x-file-name': encodeURIComponent(filename) } });
}

/**
 * Props for links that leave the app. In a browser they open a new tab. In the
 * desktop app they navigate normally, and the app's navigation guard opens them
 * in the default browser instead (src-tauri/src/lib.rs).
 */
export const externalLink = isDesktop ? {} : { target: '_blank', rel: 'noopener noreferrer' };
