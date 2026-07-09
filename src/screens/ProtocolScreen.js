// ============================================================
// PROTOCOL SCREEN — Medication & protocol tracker
// ------------------------------------------------------------
// Mirrors NutritionScreen/WeightScreen: first-run disclaimer gate,
// today view (due doses + AM/PM supplement checklist), compound
// list (add/edit/delete), and a dose log. Informational only.
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import FadeInView from '../components/FadeInView';
import GlassCard from '../components/GlassCard';
import {
  Syringe, Pill, CalendarClock, Check, Plus, Trash2,
} from 'lucide-react-native';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { SPACING, RADIUS, FONT, GLOW, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import {
  COMPOUND_TYPES, DOSE_UNITS, INJECTION_SITES, STACK_SLOTS,
  getDailyProtocolStatus, getCompounds, getDoseEntries,
  saveCompound, updateCompound, deleteCompound,
  logDose, confirmDose, deleteDose,
  toggleStackTaken, dayKey,
  hasAcknowledgedProtocolDisclaimer, acknowledgeProtocolDisclaimer,
} from '../services/protocol';
import * as haptics from '../services/haptics';
import { capture } from '../services/posthog';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function ProtocolScreen({ navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();

  // ---- Gate state ----
  const [acknowledged, setAcknowledged] = useState(null);   // null = loading

  // ---- Data state ----
  const [status, setStatus] = useState(null);
  const [compounds, setCompounds] = useState([]);
  const [doseEntries, setDoseEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ---- Log-dose form state ----
  const [selectedCompoundId, setSelectedCompoundId] = useState(null);
  const [doseAmount, setDoseAmount] = useState('');
  const [doseUnit, setDoseUnit] = useState('mg');
  const [doseSite, setDoseSite] = useState(null);
  const [saving, setSaving] = useState(false);

  // ---- Add/edit-compound sub-form state ----
  const [compoundMode, setCompoundMode] = useState(false);
  const [editingCompoundId, setEditingCompoundId] = useState(null);
  const [cName, setCName] = useState('');
  const [cType, setCType] = useState('injectable');
  const [cUnit, setCUnit] = useState('mg');
  const [cDefaultDose, setCDefaultDose] = useState('');

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    setLoading(true);
    const ack = await hasAcknowledgedProtocolDisclaimer();
    setAcknowledged(ack);
    if (!ack) { setLoading(false); return; }   // gate handles the rest
    const [st, comps, doses] = await Promise.all([
      getDailyProtocolStatus(), getCompounds(), getDoseEntries(),
    ]);
    setStatus(st);
    setCompounds(comps);
    // today's dose entries, newest first
    const key = st.date;
    setDoseEntries(
      doses.filter(e => dayKey(e.date) === key)
           .sort((a, b) => new Date(b.date) - new Date(a.date))
    );
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ---- First-run acknowledgment ----
  const handleAcknowledge = async () => {
    haptics.success();
    await acknowledgeProtocolDisclaimer();
    capture('protocol_disclaimer_acknowledged', {});
    setAcknowledged(true);
    await loadData();
  };

  // ---- Log a dose (user-typed + user-confirmed in one action) ----
  const handleLogDose = async () => {
    const amt = parseFloat(doseAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Enter a dose', 'Type the dose amount you took to log it.');
      return;
    }
    const compound = compounds.find(c => c.id === selectedCompoundId) || null;
    haptics.success();
    setSaving(true);
    const entry = await logDose({
      compoundId: selectedCompoundId,
      name: compound ? compound.name : '',
      amount: amt,
      unit: doseUnit,
      route: compound ? compound.route : 'other',
      site: doseSite,
    });
    if (entry) await confirmDose(entry.id);   // user typed + confirmed in one action
    // Analytics must NOT carry health data. Send only a coarse category +
    // booleans — never the compound name, dose amount, unit, or route.
    capture('protocol_dose_logged', {
      type: compound ? compound.type : 'other',
      has_site: !!doseSite,
    });
    setDoseAmount(''); setDoseSite(null);
    await loadData();
    setSaving(false);
  };

  const handleToggleStack = async (item) => {
    haptics.tap();
    await toggleStackTaken(item.id);
    capture('protocol_stack_toggled', { slot: item.slot });
    await loadData();
  };

  // ---- Compound sub-form helpers ----
  const openAddCompound = () => {
    haptics.tap();
    setEditingCompoundId(null);
    setCName(''); setCType('injectable'); setCUnit('mg'); setCDefaultDose('');
    setCompoundMode(true);
  };

  const openEditCompound = (compound) => {
    haptics.tap();
    setEditingCompoundId(compound.id);
    setCName(compound.name || '');
    setCType(compound.type || 'other');
    setCUnit(compound.unit || 'mg');
    setCDefaultDose(compound.defaultDose != null ? String(compound.defaultDose) : '');
    setCompoundMode(true);
  };

  const handleSaveCompound = async () => {
    if (!cName.trim()) {
      Alert.alert('Name required', 'Give this compound a name.');
      return;
    }
    haptics.success();
    const route = cType === 'injectable' || cType === 'peptide' ? 'subq' : 'oral';
    if (editingCompoundId) {
      await updateCompound(editingCompoundId, {
        name: cName.trim(), type: cType, unit: cUnit, route,
        defaultDose: cDefaultDose || null,
      });
    } else {
      await saveCompound({
        name: cName, type: cType, unit: cUnit, route,
        defaultDose: cDefaultDose || null,
        schedule: { frequency: 'weekly', daysOfWeek: [], dosesPerWeek: 1 },
      });
      capture('protocol_compound_added', { type: cType, unit: cUnit });
    }
    setCName(''); setCDefaultDose(''); setEditingCompoundId(null); setCompoundMode(false);
    await loadData();
  };

  const handleDeleteCompound = (compound) => {
    haptics.tap();
    Alert.alert('Delete compound', `Remove ${compound.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          haptics.medium();
          await deleteCompound(compound.id);
          await loadData();
        } },
    ]);
  };

  const handleDeleteDose = (entry) => {
    haptics.tap();
    Alert.alert('Delete dose', 'Remove this dose from today?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          haptics.medium();
          await deleteDose(entry.id);
          capture('protocol_entry_deleted', {});
          await loadData();
        } },
    ]);
  };

  // Select a compound in the log-dose form; pre-fill unit + dose (editable only).
  const handleSelectCompound = (compound) => {
    haptics.tick();
    if (selectedCompoundId === compound.id) {
      setSelectedCompoundId(null);
      return;
    }
    setSelectedCompoundId(compound.id);
    if (compound.unit) setDoseUnit(compound.unit);
    if (compound.defaultDose != null) setDoseAmount(String(compound.defaultDose));
    if (compound.type !== 'injectable' && compound.type !== 'peptide') setDoseSite(null);
  };

  // ----- Loading gate (still resolving ack state) -----
  if (acknowledged === null) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <ActivityIndicator size="large" color={coach.color} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  // ----- First-run acknowledgment gate -----
  if (acknowledged === false) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32, flexGrow: 1, justifyContent: 'center' }}>
          <FadeInView>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.orange + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <CalendarClock size={30} color={colors.orange} strokeWidth={2} />
              </View>
              <Text style={{ ...FONT.title, color: colors.textPrimary, textAlign: 'center' }}>Before you start</Text>
            </View>
            <GlassCard accentColor={colors.orange}>
              <Text style={{ ...FONT.body, color: colors.textSecondary, lineHeight: 22 }}>
                This is for informational purposes only and is not medical advice. Consult your healthcare provider before starting, stopping, or changing any medication or supplement.
                {'\n\n'}
                Only track substances that are legally prescribed or obtained in your jurisdiction.
                {'\n\n'}
                All doses you record are values you type and confirm yourself — this app never calculates or recommends a dose.
              </Text>
            </GlassCard>
            <TouchableOpacity
              onPress={handleAcknowledge}
              style={{
                backgroundColor: coach.color, paddingVertical: 14, borderRadius: RADIUS.md,
                alignItems: 'center', marginTop: 8,
                ...(isDark ? { shadowColor: coach.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: GLOW.md } : {}),
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: getTextOnColor(coach.color) }}>
                I understand
              </Text>
            </TouchableOpacity>
          </FadeInView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ----- Derived render data -----
  const activeCompounds = compounds.filter(c => c.active);
  const isInjectableType = (() => {
    const sel = compounds.find(c => c.id === selectedCompoundId);
    return sel && (sel.type === 'injectable' || sel.type === 'peptide');
  })();

  // ----- Supplement checklist row -----
  const StackRow = ({ item, taken }) => (
    <TouchableOpacity
      onPress={() => handleToggleStack(item)}
      activeOpacity={0.7}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
      accessibilityRole="button"
      accessibilityLabel={`${taken ? 'Uncheck' : 'Check'} ${item.name}`}
    >
      <View style={{
        width: 24, height: 24, borderRadius: 12, marginRight: 12,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: taken ? coach.color : 'transparent',
        borderWidth: taken ? 0 : 1.5,
        borderColor: colors.glassBorder,
      }}>
        {taken && <Check size={14} color={getTextOnColor(coach.color)} strokeWidth={3} />}
      </View>
      <Text style={{
        flex: 1, fontSize: 14, fontWeight: '600',
        color: taken ? colors.textMuted : colors.textPrimary,
        textDecorationLine: taken ? 'line-through' : 'none',
      }}>
        {item.name}
        {item.dose ? ` — ${item.dose}${item.unit ? ` ${item.unit}` : ''}` : ''}
      </Text>
    </TouchableOpacity>
  );

  const renderSlot = (slot) => {
    const bucket = slot.id === 'am' ? status?.am : status?.pm;
    if (!bucket || bucket.total === 0) return null;
    return (
      <View key={slot.id} style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted }}>{slot.label}</Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, fontVariant: ['tabular-nums'] }}>
            {bucket.done}/{bucket.total}
          </Text>
        </View>
        {bucket.items.map(item => (
          <StackRow key={item.id} item={item} taken={bucket.takenItemIds.has(item.id)} />
        ))}
      </View>
    );
  };

  // ----- Main render -----
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={coach.color} />
        }
      >

        {/* ---- Header ---- */}
        <FadeInView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Syringe size={24} color={coach.color} strokeWidth={2} />
              <Text style={{ ...FONT.title, color: colors.textPrimary }}>Protocol</Text>
            </View>
            <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 4, marginLeft: 34 }}>
              Track your medication & protocol
            </Text>
          </View>
        </FadeInView>

        {/* ---- Persistent disclaimer banner ---- */}
        <GlassCard fadeDelay={60} accentColor={colors.orange}>
          <Text style={{ ...FONT.caption, color: colors.textSecondary, lineHeight: 18 }}>
            Informational only — not medical advice. Consult your provider. Only track substances legally prescribed or obtained in your jurisdiction.
          </Text>
        </GlassCard>

        {/* ---- Today view ---- */}
        <GlassCard fadeDelay={120} accentColor={coach.color} glow>
          <Text style={{ ...FONT.label, color: colors.textMuted, marginBottom: 10 }}>Today</Text>

          {/* Due doses */}
          {status?.injectionDueToday ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Syringe size={16} color={coach.color} strokeWidth={2.5} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                Dose due today{status?.nextDose ? ` — ${status.nextDose.name}` : ''}
              </Text>
            </View>
          ) : status?.scheduledToday?.length === 0 ? (
            <Text style={{ ...FONT.caption, color: colors.textMuted }}>No doses scheduled today.</Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Check size={16} color={coach.color} strokeWidth={2.5} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
                Doses done for today
              </Text>
            </View>
          )}

          {/* AM/PM supplement checklist */}
          {STACK_SLOTS.map(renderSlot)}
        </GlassCard>

        {/* ---- Log a dose form ---- */}
        <GlassCard fadeDelay={200} accentColor={coach.color}>
          <Text style={{ ...FONT.subhead, color: colors.textPrimary, marginBottom: 12 }}>Log a dose</Text>

          {/* Compound chip-select */}
          {activeCompounds.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {activeCompounds.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 7,
                    borderRadius: RADIUS.round,
                    backgroundColor: selectedCompoundId === c.id ? coach.color : colors.glassBg,
                    borderWidth: 1,
                    borderColor: selectedCompoundId === c.id ? coach.color : colors.glassBorder,
                  }}
                  onPress={() => handleSelectCompound(c)}
                >
                  <Text style={{
                    fontSize: 12, fontWeight: '600',
                    color: selectedCompoundId === c.id ? getTextOnColor(coach.color) : colors.textSecondary,
                  }}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Dose amount */}
          <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>DOSE (amount) *</Text>
          <TextInput
            style={[inputStyle(colors), { marginBottom: 12 }]}
            value={doseAmount}
            onChangeText={setDoseAmount}
            keyboardType="decimal-pad"
            placeholder="66"
            placeholderTextColor={colors.textDim}
            returnKeyType="done"
            onSubmitEditing={handleLogDose}
          />

          {/* Unit chip-select */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {DOSE_UNITS.map((u) => (
              <TouchableOpacity
                key={u}
                style={{
                  paddingHorizontal: 10, paddingVertical: 6,
                  borderRadius: RADIUS.round,
                  backgroundColor: doseUnit === u ? coach.color : colors.glassBg,
                  borderWidth: 1,
                  borderColor: doseUnit === u ? coach.color : colors.glassBorder,
                }}
                onPress={() => { haptics.tick(); setDoseUnit(u); }}
              >
                <Text style={{
                  fontSize: 12, fontWeight: '600',
                  color: doseUnit === u ? getTextOnColor(coach.color) : colors.textSecondary,
                }}>
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Injection-site chip-select (injectable/peptide only) */}
          {isInjectableType && (
            <>
              <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>SITE</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                {INJECTION_SITES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 6,
                      borderRadius: RADIUS.round,
                      backgroundColor: doseSite === s ? coach.color : colors.glassBg,
                      borderWidth: 1,
                      borderColor: doseSite === s ? coach.color : colors.glassBorder,
                    }}
                    onPress={() => { haptics.tick(); setDoseSite(doseSite === s ? null : s); }}
                  >
                    <Text style={{
                      fontSize: 12, fontWeight: '600',
                      color: doseSite === s ? getTextOnColor(coach.color) : colors.textSecondary,
                    }}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity
            style={{
              backgroundColor: doseAmount ? coach.color : colors.bgSubtle,
              paddingVertical: 14, borderRadius: RADIUS.md,
              alignItems: 'center',
              ...(doseAmount && isDark ? {
                shadowColor: coach.color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.3,
                shadowRadius: GLOW.md,
              } : {}),
            }}
            onPress={handleLogDose}
            disabled={saving || !doseAmount}
          >
            <Text style={{
              fontSize: 16, fontWeight: '700',
              color: doseAmount ? getTextOnColor(coach.color) : colors.textDim,
            }}>
              {saving ? 'Saving...' : 'Log dose'}
            </Text>
          </TouchableOpacity>
        </GlassCard>

        {/* ---- My compounds ---- */}
        <FadeInView delay={280}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ ...FONT.label, color: colors.textMuted }}>My compounds</Text>
            <TouchableOpacity
              onPress={compoundMode ? () => { haptics.tap(); setCompoundMode(false); setEditingCompoundId(null); } : openAddCompound}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Plus size={14} color={coach.color} strokeWidth={2.5} />
              <Text style={{ ...FONT.caption, color: coach.color, fontWeight: '600' }}>
                {compoundMode ? 'Close' : 'Add compound'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Inline add/edit sub-form */}
          {compoundMode && (
            <GlassCard accentColor={coach.color}>
              <TextInput
                style={[inputStyle(colors), { marginBottom: 10 }]}
                value={cName}
                onChangeText={setCName}
                placeholder="Compound name"
                placeholderTextColor={colors.textDim}
                maxLength={60}
                returnKeyType="next"
              />

              {/* Type chip-select */}
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {COMPOUND_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 6,
                      borderRadius: RADIUS.round,
                      backgroundColor: cType === t.id ? coach.color : colors.glassBg,
                      borderWidth: 1,
                      borderColor: cType === t.id ? coach.color : colors.glassBorder,
                    }}
                    onPress={() => { haptics.tick(); setCType(t.id); }}
                  >
                    <Text style={{
                      fontSize: 12, fontWeight: '600',
                      color: cType === t.id ? getTextOnColor(coach.color) : colors.textSecondary,
                    }}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Unit chip-select */}
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {DOSE_UNITS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 6,
                      borderRadius: RADIUS.round,
                      backgroundColor: cUnit === u ? coach.color : colors.glassBg,
                      borderWidth: 1,
                      borderColor: cUnit === u ? coach.color : colors.glassBorder,
                    }}
                    onPress={() => { haptics.tick(); setCUnit(u); }}
                  >
                    <Text style={{
                      fontSize: 12, fontWeight: '600',
                      color: cUnit === u ? getTextOnColor(coach.color) : colors.textSecondary,
                    }}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Optional default dose */}
              <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>DEFAULT DOSE (optional)</Text>
              <TextInput
                style={inputStyle(colors)}
                value={cDefaultDose}
                onChangeText={setCDefaultDose}
                keyboardType="decimal-pad"
                placeholder="e.g. 66"
                placeholderTextColor={colors.textDim}
                returnKeyType="done"
              />
              <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 6, marginBottom: 14 }}>
                Pre-fill only — you confirm each dose.
              </Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 12,
                    borderRadius: RADIUS.md, backgroundColor: colors.glassBg,
                    borderWidth: 1, borderColor: colors.glassBorder,
                  }}
                  onPress={() => { haptics.tap(); setCompoundMode(false); setEditingCompoundId(null); }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 2, alignItems: 'center', paddingVertical: 12,
                    borderRadius: RADIUS.md, backgroundColor: coach.color,
                    ...(isDark ? { shadowColor: coach.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: GLOW.md } : {}),
                  }}
                  onPress={handleSaveCompound}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: getTextOnColor(coach.color) }}>
                    {editingCompoundId ? 'Save changes' : 'Save compound'}
                  </Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          )}

          {/* Compound list or empty state */}
          {loading ? (
            <ActivityIndicator size="large" color={coach.color} style={{ marginTop: 24 }} />
          ) : compounds.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: colors.glassBg,
                borderWidth: 1, borderColor: colors.glassBorder,
                alignItems: 'center', justifyContent: 'center', marginBottom: 12,
              }}>
                <Pill size={28} color={colors.textMuted} strokeWidth={1.5} />
              </View>
              <Text style={{ ...FONT.subhead, color: colors.textPrimary }}>No compounds yet</Text>
              <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 4 }}>
                Add a compound to start tracking doses
              </Text>
            </View>
          ) : (
            <GlassCard>
              {compounds.map((c, i) => (
                <View
                  key={c.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 13,
                    borderBottomWidth: i < compounds.length - 1 ? 1 : 0,
                    borderBottomColor: colors.glassBorder,
                  }}
                >
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    activeOpacity={0.7}
                    onPress={() => openEditCompound(c)}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                      {c.name}
                      {!c.active ? '  (off)' : ''}
                    </Text>
                    <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }}>
                      {cap(c.type)} · {c.unit}
                      {c.defaultDose != null ? ` · ${c.defaultDose} ${c.unit}` : ''}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteCompound(c)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ paddingLeft: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${c.name}`}
                  >
                    <Trash2 size={16} color={colors.textMuted} strokeWidth={1.8} />
                  </TouchableOpacity>
                </View>
              ))}
            </GlassCard>
          )}
        </FadeInView>

        {/* ---- Today's doses ---- */}
        <FadeInView delay={340} style={{ marginTop: 20 }}>
          <Text style={{ ...FONT.label, color: colors.textMuted, marginBottom: 12 }}>Today's doses</Text>
          {loading ? (
            <ActivityIndicator size="large" color={coach.color} style={{ marginTop: 8 }} />
          ) : doseEntries.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: colors.glassBg,
                borderWidth: 1, borderColor: colors.glassBorder,
                alignItems: 'center', justifyContent: 'center', marginBottom: 12,
              }}>
                <Syringe size={28} color={colors.textMuted} strokeWidth={1.5} />
              </View>
              <Text style={{ ...FONT.subhead, color: colors.textPrimary }}>No doses logged today</Text>
              <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 4 }}>
                Use the form above to log your first dose
              </Text>
            </View>
          ) : (
            <GlassCard>
              {doseEntries.map((entry, i) => (
                <View
                  key={entry.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 13,
                    borderBottomWidth: i < doseEntries.length - 1 ? 1 : 0,
                    borderBottomColor: colors.glassBorder,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                      {entry.name || 'Dose'}
                      {entry.amount != null ? ` — ${entry.amount} ${entry.unit}` : ''}
                    </Text>
                    <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }}>
                      {new Date(entry.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {entry.site ? ` · ${entry.site}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteDose(entry)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ paddingLeft: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Delete dose entry"
                  >
                    <Trash2 size={16} color={colors.textMuted} strokeWidth={1.8} />
                  </TouchableOpacity>
                </View>
              ))}
            </GlassCard>
          )}
        </FadeInView>

      </ScrollView>
    </SafeAreaView>
  );
}

// ---- Shared input style ----
function inputStyle(colors) {
  return {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  };
}
