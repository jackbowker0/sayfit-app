// ============================================================
// BARCODE SCANNER MODAL — scan a food barcode -> foodDb lookup
// ------------------------------------------------------------
// Uses expo-camera, which is a NATIVE module: it only exists after
// a dev-client rebuild. We lazy-require it so the app doesn't crash
// on a build that predates it — a graceful "needs rebuild" screen
// shows instead. On a scan we look the barcode up in Open Food Facts
// and hand the found food to the caller (which opens the same portion
// picker as text search). Unknown barcodes offer manual entry.
// ============================================================

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { FONT, SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { lookupBarcode } from '../services/foodDb';
import * as haptics from '../services/haptics';

// Native module — present only after a rebuild that includes expo-camera.
let CameraModule = null;
try { CameraModule = require('expo-camera'); } catch (_) { /* not in this build yet */ }

// Common food barcode symbologies.
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'];

function Shell({ visible, onClose, colors, children }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top', 'bottom']}>
        {children}
        <TouchableOpacity
          onPress={() => { haptics.tap(); onClose(); }}
          style={{ position: 'absolute', top: SPACING.lg + 8, right: SPACING.lg, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="button" accessibilityLabel="Close scanner"
        >
          <X size={26} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

function centeredMessage(text, colors, action) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: 16 }}>
      <Text style={{ ...FONT.body, color: '#fff', textAlign: 'center' }}>{text}</Text>
      {action}
    </View>
  );
}

export default function BarcodeScannerModal({ visible, onClose, onFound, coachColor, colors }) {
  // No native camera in this build → graceful fallback, no hooks-order issues
  // because this branch renders a component with no camera hooks.
  if (!CameraModule?.CameraView) {
    return (
      <Shell visible={visible} onClose={onClose} colors={colors}>
        {centeredMessage(
          'Barcode scanning needs the latest app build. Rebuild the dev client (expo-camera was just added), then this will scan. For now, use "Search food database".',
          colors,
        )}
      </Shell>
    );
  }
  return <ScannerInner CameraModule={CameraModule} visible={visible} onClose={onClose} onFound={onFound} coachColor={coachColor} colors={colors} />;
}

function ScannerInner({ CameraModule, visible, onClose, onFound, coachColor, colors }) {
  const { CameraView, useCameraPermissions } = CameraModule;
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);       // looking up a scanned code
  const [handled, setHandled] = useState(false); // debounce repeat scans of the same frame
  const [notFound, setNotFound] = useState(null);

  // Reset scan state each time the sheet opens.
  useEffect(() => {
    if (visible) { setHandled(false); setBusy(false); setNotFound(null); }
  }, [visible]);

  const onBarcodeScanned = async ({ data }) => {
    if (handled || busy) return;
    setHandled(true);
    setBusy(true);
    setNotFound(null);
    const food = await lookupBarcode(data);
    setBusy(false);
    if (food) {
      haptics.success();
      onFound(food);
    } else {
      haptics.warning?.();
      setNotFound(data); // let the user retry or bail to manual
    }
  };

  // Permission states
  if (!permission) {
    return <Shell visible={visible} onClose={onClose} colors={colors}>{centeredMessage('Checking camera access…', colors, <ActivityIndicator color="#fff" />)}</Shell>;
  }
  if (!permission.granted) {
    return (
      <Shell visible={visible} onClose={onClose} colors={colors}>
        {centeredMessage(
          'SayFit needs camera access to scan barcodes.',
          colors,
          <TouchableOpacity
            onPress={() => { haptics.tap(); requestPermission(); }}
            style={{ backgroundColor: coachColor, paddingVertical: 12, paddingHorizontal: 24, borderRadius: RADIUS.md }}
            accessibilityRole="button" accessibilityLabel="Allow camera access"
          >
            <Text style={{ ...FONT.subhead, color: getTextOnColor(coachColor) }}>Allow camera</Text>
          </TouchableOpacity>,
        )}
      </Shell>
    );
  }

  return (
    <Shell visible={visible} onClose={onClose} colors={colors}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
        onBarcodeScanned={handled ? undefined : onBarcodeScanned}
      />
      {/* Reticle + hint */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 240, height: 150, borderWidth: 2, borderColor: '#ffffffcc', borderRadius: 16 }} />
          <Text style={{ ...FONT.caption, color: '#fff', marginTop: 16, textShadowColor: '#000', textShadowRadius: 4 }}>
            Point at a product barcode
          </Text>
        </View>
      </View>

      {busy && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ ...FONT.caption, color: '#fff' }}>Looking it up…</Text>
        </View>
      )}

      {notFound && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: 16 }]}>
          <Text style={{ ...FONT.body, color: '#fff', textAlign: 'center' }}>
            Barcode {notFound} isn't in the food database.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => { haptics.tap(); setNotFound(null); setHandled(false); }}
              style={{ borderWidth: 1, borderColor: '#fff', paddingVertical: 12, paddingHorizontal: 20, borderRadius: RADIUS.md }}
              accessibilityRole="button" accessibilityLabel="Scan again"
            >
              <Text style={{ ...FONT.caption, color: '#fff', fontWeight: '600' }}>Scan again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { haptics.tap(); onClose(); }}
              style={{ backgroundColor: coachColor, paddingVertical: 12, paddingHorizontal: 20, borderRadius: RADIUS.md }}
              accessibilityRole="button" accessibilityLabel="Enter manually"
            >
              <Text style={{ ...FONT.caption, color: getTextOnColor(coachColor), fontWeight: '700' }}>Enter manually</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Shell>
  );
}
