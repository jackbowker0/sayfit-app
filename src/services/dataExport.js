// ============================================================
// DATA EXPORT — user-owned backup of all local SayFit data
// ------------------------------------------------------------
// There is otherwise NO way to get workout / macro / weigh-in /
// dose history off the device — a delete or OS container purge
// would lose it all permanently. This dumps every sayfit_*
// AsyncStorage key to a JSON file the user can save, AirDrop, or
// email through the system share sheet.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const EXPORT_VERSION = 1;

// Local-timezone YYYY-MM-DD for the filename (not UTC).
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Serialize every SayFit AsyncStorage key into a JSON backup and open the
 * system share sheet. Returns { ok, uri, keyCount } or { ok:false, error }.
 */
export async function exportAllData() {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('sayfit_'));
    const pairs = await AsyncStorage.multiGet(keys);
    const data = {};
    for (const [k, v] of pairs) {
      try { data[k] = v == null ? null : JSON.parse(v); }
      catch (_) { data[k] = v; } // keep the raw string if it isn't JSON
    }
    const payload = {
      app: 'SayFit',
      exportVersion: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      keyCount: keys.length,
      data,
    };
    const json = JSON.stringify(payload, null, 2);
    const uri = `${FileSystem.cacheDirectory}sayfit-backup-${stamp()}.json`;
    await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export SayFit data',
        UTI: 'public.json',
      });
    }
    return { ok: true, uri, keyCount: keys.length };
  } catch (e) {
    console.warn('[Export] failed:', e);
    return { ok: false, error: e?.message || 'Export failed' };
  }
}
