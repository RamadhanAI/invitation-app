export type OfflineTokenSet = {
    slug: string;
    hashes: string[];
    fetchedAt: number;
  };
  
  const DB_NAME = 'aura_scanner';
  const DB_VERSION = 1;
  const STORE = 'tokenSets';
  
  function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'slug' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  
  export async function getCachedTokenSet(slug: string): Promise<OfflineTokenSet | null> {
    try {
      const db = await openDB();
      return await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const req = store.get(slug);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }
  
  export async function saveTokenSet(set: OfflineTokenSet) {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(set);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
  
  function b64url(buf: ArrayBuffer) {
    const b = new Uint8Array(buf);
    let s = '';
    for (const c of b) s += String.fromCharCode(c);
    return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  
  export async function sha256B64url(input: string) {
    const buf = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return b64url(hash);
  }
  
  export async function refreshOfflineTokenSet(slug: string) {
    const r = await fetch('/api/scanner/offline', { method: 'GET', cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok || !Array.isArray(j?.hashes)) return null;
  
    const set: OfflineTokenSet = {
      slug,
      hashes: j.hashes,
      fetchedAt: Date.now(),
    };
    await saveTokenSet(set);
    return set;
  }
  