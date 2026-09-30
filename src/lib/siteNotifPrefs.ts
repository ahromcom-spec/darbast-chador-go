// Per-device preferences for the site-notifications alert (sound + popup filters).
export interface SiteNotifPrefs {
  guestNotify: boolean; // show popup when a guest acts/visits
  guestSound: boolean;
  adminNotify: boolean; // show popup when site management acts/visits
  adminSound: boolean;
  adminStageSound: boolean; // sound on stage change done by management
  volume: number; // 0..1
  customSoundName: string | null;
}

const KEY = 'siteNotificationPrefs';
export const PREFS_EVENT = 'site-notif-prefs-changed';

export const defaultPrefs: SiteNotifPrefs = {
  guestNotify: true,
  guestSound: true,
  adminNotify: true,
  adminSound: true,
  adminStageSound: true,
  volume: 0.8,
  customSoundName: null,
};

export const loadPrefs = (): SiteNotifPrefs => {
  try {
    return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return defaultPrefs;
  }
};

export const savePrefs = (p: SiteNotifPrefs) => {
  localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new Event(PREFS_EVENT));
};

// ---- custom sound file stored in IndexedDB ----
const DB = 'siteNotifSound';
const STORE = 'files';
const openDb = () =>
  new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

export const saveCustomSound = async (file: Blob | null) => {
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    if (file) tx.objectStore(STORE).put(file, 'custom');
    else tx.objectStore(STORE).delete('custom');
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  window.dispatchEvent(new Event(PREFS_EVENT));
};

export const loadCustomSound = async (): Promise<Blob | null> => {
  try {
    const db = await openDb();
    return await new Promise((res) => {
      const r = db.transaction(STORE).objectStore(STORE).get('custom');
      r.onsuccess = () => res((r.result as Blob) || null);
      r.onerror = () => res(null);
    });
  } catch {
    return null;
  }
};
