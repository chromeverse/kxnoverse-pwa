'use strict';

(() => {
  const DB_NAME = 'kxnoverse-pwa-library-v1';
  const DB_VERSION = 2;
  const STORE_NAME = 'audio-files';
  const TRACK_STORE_NAME = 'audio-tracks';
  const audioUrls = new Map();
  let databasePromise;

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = event => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        const transaction = request.transaction;
        if (!database.objectStoreNames.contains(TRACK_STORE_NAME)) {
          database.createObjectStore(TRACK_STORE_NAME, { keyPath: 'id' });
          if (event.oldVersion > 0) {
            const cursorRequest = transaction.objectStore(STORE_NAME).openCursor();
            cursorRequest.onsuccess = () => {
              const cursor = cursorRequest.result;
              if (!cursor) return;
              if (cursor.value && cursor.value.track) {
                transaction.objectStore(TRACK_STORE_NAME).put(cursor.value.track);
              }
              cursor.continue();
            };
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open the browser audio library.'));
      request.onblocked = () => reject(new Error('The browser audio library is busy in another tab. Close other Kxnoverse tabs and try again.'));
    });
    return databasePromise;
  }

  function readDuration(file) {
    return new Promise(resolve => {
      const audio = document.createElement('audio');
      const url = URL.createObjectURL(file);
      const finish = duration => {
        audio.removeAttribute('src');
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0);
      };
      const timeout = setTimeout(() => finish(0), 4000);
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        clearTimeout(timeout);
        finish(audio.duration);
      };
      audio.onerror = () => {
        clearTimeout(timeout);
        finish(0);
      };
      audio.src = url;
    });
  }

  async function importAudioFiles() {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'audio/*,.aac,.flac,.m4a,.mp3,.oga,.ogg,.opus,.wav,.weba,.webm';
    picker.multiple = true;

    const files = await new Promise(resolve => {
      picker.addEventListener('change', () => resolve(Array.from(picker.files || [])), { once: true });
      picker.addEventListener('cancel', () => resolve([]), { once: true });
      picker.click();
    });
    if (files.length === 0) return [];

    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      await navigator.storage.persist().catch(error => {
        console.warn('Could not request persistent browser storage:', error);
        return false;
      });
    }

    const supportedFiles = files.filter(file =>
      file.type.startsWith('audio/') || /\.(aac|flac|m4a|mp3|oga|ogg|opus|wav|weba|webm)$/i.test(file.name)
    );
    const preparedTracks = await Promise.all(supportedFiles.map(async file => ({
      id: `pwa-audio-${crypto.randomUUID()}`,
      title: file.name.replace(/\.[^.]+$/, '') || file.name,
      artist: '',
      duration: await readDuration(file),
      platform: 'local',
      addedAt: Date.now(),
      fileName: file.name,
      size: file.size,
      thumbnail: '',
      blob: file
    })));

    if (files.length && preparedTracks.length === 0) {
      throw new Error('No supported audio files were selected.');
    }

    const database = await openDatabase();
    const transaction = database.transaction([STORE_NAME, TRACK_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const trackStore = transaction.objectStore(TRACK_STORE_NAME);
    for (const track of preparedTracks) {
      const { blob, ...metadata } = track;
      store.put({ id: track.id, track: metadata, blob });
      trackStore.put(metadata);
    }
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Could not save imported audio files.'));
      transaction.onabort = () => reject(transaction.error || new Error('Saving imported audio files was interrupted.'));
    });

    return preparedTracks.map(({ blob, ...track }) => track);
  }

  async function listLocalTracks() {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = database.transaction(TRACK_STORE_NAME, 'readonly').objectStore(TRACK_STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not read the browser audio library.'));
    });
  }

  async function getLocalAudioUrl(id) {
    const existing = audioUrls.get(id);
    if (existing) return existing;
    const database = await openDatabase();
    const record = await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not load the selected audio file.'));
    });
    if (!record || !(record.blob instanceof Blob)) throw new Error('This audio file is no longer available in this browser.');
    const url = URL.createObjectURL(record.blob);
    audioUrls.set(id, url);
    return url;
  }

  async function removeLocalTrack(id) {
    const url = audioUrls.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      audioUrls.delete(id);
    }
    const database = await openDatabase();
    const transaction = database.transaction([STORE_NAME, TRACK_STORE_NAME], 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.objectStore(TRACK_STORE_NAME).delete(id);
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Could not remove the audio file.'));
      transaction.onabort = () => reject(transaction.error || new Error('Removing the audio file was interrupted.'));
    });
  }

  window.kxPwa = Object.freeze({
    importAudioFiles,
    listLocalTracks,
    getLocalAudioUrl,
    removeLocalTrack
  });
})();
