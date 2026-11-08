export interface CustomAlarmMeta {
  id: string;
  name: string;
  type: string;
  size: number;
  created: number;
}

const DB_NAME = 'sahra-alarm-audio';
const STORE = 'alarms';
const DB_VERSION = 1;
const MAX_BYTES = 25 * 1024 * 1024; 
const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|oga|m4a|flac|opus|aac|weba|wma)$/i;

function looksLikeAudio(file: File): boolean {
  if (file.type && file.type.startsWith('audio')) return true;
  if (file.type === 'video/ogg; codecs=opus') return true; 
  return AUDIO_EXTENSIONS.test(file.name || '');
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('local storage is blocked — check private/incognito mode or storage permissions'));
    req.onblocked = () => reject(new Error('local storage is busy — close other SAHRA tabs and retry'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('local storage transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('local storage transaction aborted'));
  });
}

export async function listCustomAlarms(): Promise<CustomAlarmMeta[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const req = store.getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      const rows = (req.result || []) as Array<{ id: string; name: string; type: string; size: number; created: number }>;
      resolve(rows.map(({ id, name, type, size, created }) => ({ id, name, type, size, created })).sort((a, b) => b.created - a.created));
    };
    req.onerror = () => reject(req.error ?? new Error('failed to list custom alarms'));
  });
}

export async function saveCustomAlarm(file: File): Promise<CustomAlarmMeta> {
  if (!looksLikeAudio(file)) {
    throw new Error(`not an audio file (${file.name || 'unnamed'}, type "${file.type || 'unknown'}")`);
  }
  if (file.size <= 0) throw new Error('file is empty');
  if (file.size > MAX_BYTES) {
    throw new Error(`file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 25 MB. Trim it or convert to .ogg/.m4a and retry.`);
  }
  const db = await openDb();
  const buffer = await file.arrayBuffer();
  const meta: CustomAlarmMeta = {
    id: `custom-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)}`,
    name: file.name || 'custom-alarm.ogg',
    type: file.type || 'audio/mpeg',
    size: file.size,
    created: Date.now(),
  };
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put({ ...meta, buffer });
  await txDone(tx);
  return meta;
}

export async function deleteCustomAlarm(id: string): Promise<void> {
  if (!id.startsWith('custom-')) return;
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
}

export async function loadCustomAlarmBlob(id: string): Promise<Blob | null> {
  if (!id.startsWith('custom-')) return null;
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const req = tx.objectStore(STORE).get(id);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      const row = req.result as { type: string; buffer: ArrayBuffer } | undefined;
      resolve(row ? new Blob([row.buffer], { type: row.type || 'audio/mpeg' }) : null);
    };
    req.onerror = () => reject(req.error ?? new Error('failed to load custom alarm'));
  });
}
