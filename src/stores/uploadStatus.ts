import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { hasPendingUpload, loadUploadSession } from '@/utils/upload-resume';

export type UploadStatusType = 'uploading' | 'success';

interface UploadStatusEntry {
  status: UploadStatusType;
  datasetName: string;
  timestamp: number;
}

const STORAGE_KEY = 'upload_status_map';
const CANCELLED_KEY = 'upload_cancelled_map';

function loadFromStorage(): Record<string, UploadStatusEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persist(map: Record<string, UploadStatusEntry>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function loadCancelled(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CANCELLED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistCancelled(map: Record<string, boolean>) {
  localStorage.setItem(CANCELLED_KEY, JSON.stringify(map));
}

export const useUploadStatusStore = defineStore('uploadStatus', () => {
  const statusMap = ref<Record<string, UploadStatusEntry>>(loadFromStorage());
  const cancelledMap = ref<Record<string, boolean>>(loadCancelled());

  const markUploading = (datasetName: string) => {
    statusMap.value[datasetName] = {
      status: 'uploading',
      datasetName,
      timestamp: Date.now(),
    };
    // Clear any cancelled hint when starting a new upload
    delete cancelledMap.value[datasetName];
    persistCancelled(cancelledMap.value);
    persist(statusMap.value);
  };

  const markSuccess = (datasetName: string) => {
    statusMap.value[datasetName] = {
      status: 'success',
      datasetName,
      timestamp: Date.now(),
    };
    persist(statusMap.value);
  };

  const markCancelled = (datasetName: string) => {
    cancelledMap.value = { ...cancelledMap.value, [datasetName]: true };
    persistCancelled(cancelledMap.value);
  };

  const clearStatus = (datasetName: string) => {
    delete statusMap.value[datasetName];
    statusMap.value = { ...statusMap.value };
    persist(statusMap.value);
  };

  const clearCancelled = (datasetName: string) => {
    delete cancelledMap.value[datasetName];
    cancelledMap.value = { ...cancelledMap.value };
    persistCancelled(cancelledMap.value);
  };

  const syncWithDatasets = (datasetNames: string[]) => {
    const nameSet = new Set(datasetNames);
    let changed = false;
    let cancelledChanged = false;
    for (const name of Object.keys(statusMap.value)) {
      if (!nameSet.has(name)) {
        delete statusMap.value[name];
        changed = true;
      }
    }
    for (const name of Object.keys(cancelledMap.value)) {
      if (!nameSet.has(name)) {
        delete cancelledMap.value[name];
        cancelledChanged = true;
      }
    }
    if (changed) {
      statusMap.value = { ...statusMap.value };
      persist(statusMap.value);
    }
    if (cancelledChanged) {
      cancelledMap.value = { ...cancelledMap.value };
      persistCancelled(cancelledMap.value);
    }
  };

  const getStatus = (datasetName: string): UploadStatusType | null => {
    if (hasPendingUpload()) {
      const session = loadUploadSession();
      if (session?.datasetName === datasetName) {
        return 'uploading';
      }
    }
    return statusMap.value[datasetName]?.status || null;
  };

  const statusMapFlat = computed<Record<string, UploadStatusType>>(() => {
    const result: Record<string, UploadStatusType> = {};
    for (const [name, entry] of Object.entries(statusMap.value)) {
      result[name] = entry.status;
    }
    const hasSession = hasPendingUpload();
    if (hasSession) {
      const session = loadUploadSession();
      if (session?.datasetName) {
        result[session.datasetName] = 'uploading';
      }
    }
    return result;
  });

  const cancelledMapFlat = computed<Record<string, boolean>>(() => {
    return { ...cancelledMap.value };
  });

  return {
    statusMap,
    statusMapFlat,
    cancelledMapFlat,
    markUploading,
    markSuccess,
    markCancelled,
    clearStatus,
    clearCancelled,
    syncWithDatasets,
    getStatus,
  };
});
