import { clear, createStore, del, get, set, setMany, values } from 'idb-keyval';
import type { Project, Snippet } from '../types';
import { uid } from './doc';

const STORAGE_NAME = 'nyxiontech-pdf-tools';
// Name used before the project was renamed; data saved under it is moved once.
const LEGACY_STORAGE_NAME = 'yosensi-pdf-editor';

// ---- Moving data saved by versions before the rename ------------------------

function migrateLocalStorage() {
  try {
    const legacyPrefix = `${LEGACY_STORAGE_NAME}:`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(legacyPrefix)) keys.push(key);
    }
    for (const key of keys) {
      const value = localStorage.getItem(key);
      const newKey = `${STORAGE_NAME}:${key.slice(legacyPrefix.length)}`;
      if (value !== null && localStorage.getItem(newKey) === null) localStorage.setItem(newKey, value);
      localStorage.removeItem(key);
    }
  } catch {
    // storage unavailable
  }
}

/** Reads every project from the old database and closes it, so it can be deleted. */
function readLegacyProjects(): Promise<Project[]> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(LEGACY_STORAGE_NAME);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('projects')) {
        db.close();
        resolve([]);
        return;
      }
      const req = db.transaction('projects', 'readonly').objectStore('projects').getAll();
      req.onsuccess = () => {
        db.close();
        resolve(req.result as Project[]);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    };
  });
}

async function migrateIndexedDb() {
  try {
    // Only open the old database if it exists; opening it would otherwise create it.
    // Browsers without indexedDB.databases() skip the move.
    const dbs = (await indexedDB.databases?.()) ?? [];
    if (!dbs.some((d) => d.name === LEGACY_STORAGE_NAME)) return;
    const old = await readLegacyProjects();
    if (old.length) {
      const existing = new Set((await values<Project>(projects)).map((p) => p.id));
      await setMany(
        old.filter((p) => !existing.has(p.id)).map((p) => [p.id, p]),
        projects,
      );
    }
    indexedDB.deleteDatabase(LEGACY_STORAGE_NAME);
  } catch (e) {
    console.warn('Could not move documents saved by an earlier version:', e);
  }
}

migrateLocalStorage();

// Projects (including the original PDF bytes) are kept in this browser's IndexedDB only.
const projects = createStore(STORAGE_NAME, 'projects');
const ready = migrateIndexedDb();

export async function saveProject(project: Project) {
  await ready;
  return set(project.id, project, projects);
}
export async function loadProject(id: string) {
  await ready;
  return get<Project>(id, projects);
}
export async function deleteProject(id: string) {
  await ready;
  return del(id, projects);
}
export async function clearProjects() {
  await ready;
  return clear(projects);
}

export async function listProjects(): Promise<Project[]> {
  await ready;
  const all = await values<Project>(projects);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

// ---- Snippets: reusable text stamps ---------------------------------------

const SNIPPETS_KEY = `${STORAGE_NAME}:snippets`;

export const DEFAULT_SNIPPETS: Snippet[] = [
  {
    id: 'country-of-origin',
    text: 'Country of Origin: Poland (Polska)',
    font: 'arimo',
    size: 9,
    color: '#333333',
    bold: false,
    italic: true,
  },
];

export function loadSnippets(): Snippet[] {
  try {
    const raw = localStorage.getItem(SNIPPETS_KEY);
    if (raw) return JSON.parse(raw) as Snippet[];
  } catch {
    // fall through to defaults
  }
  return DEFAULT_SNIPPETS;
}

export function saveSnippets(snippets: Snippet[]) {
  try {
    localStorage.setItem(SNIPPETS_KEY, JSON.stringify(snippets));
  } catch {
    // storage unavailable; snippets just won't persist
  }
}

export const newSnippetId = uid;

// ---- Small per-browser UI preferences (tool settings, collapsed panels) -----

const PREFS_PREFIX = `${STORAGE_NAME}:pref:`;

export function loadUiPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFS_PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function saveUiPref(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFS_PREFIX + key, JSON.stringify(value));
  } catch {
    // storage unavailable; the preference just won't persist
  }
}
