// ============================================================
// ACCOUNTABILITY WIDGET — Dashboard card showing partner info
//
// Shows the user's accountability partner's streak and recent
// activity. Displayed on the DashboardScreen.
// ============================================================

import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Users, Flame } from 'lucide-react-native';

import { AuthContext } from '../context/AuthContext';
import { COACHES } from '../constants/coaches';
import { COACH_ICONS } from '../constants/icons';
import { useTheme } from '../hooks/useTheme';
import { SPACING, RADIUS, FONT, GLOW } from '../constants/theme';
import { getPartners } from '../services/challenges';
import GlassCard from './GlassCard';

export default function AccountabilityWidget({ navigation }) {
  const { isAuthenticated } = useContext(AuthContext);
  const { colors, isDark } = useTheme();
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    if (isAuthenticated) {
      getPartners().then(setPartners).catch(() => {});
    }
  }, [isAuthenticated]);

  if (!isAuthenticated || partners.length === 0) return null;

  const activePartner = partners.find(p => !p.isPending);
  if (!activePartner) return null;

  const partner = activePartner.partner;
  const coach = COACHES[partner?.coach_id] || COACHES.hype;
  const CoachIcon = COACH_ICONS[partner?.coach_id] || COACH_ICONS.hype;

  return (
    <GlassCard accentColor={coach.color}>
      <TouchableOpacity
        onPress={() => navigation?.navigate('UserProfile', { userId: partner?.id })}
        activeOpacity={0.7}
      >
        <View style={styles.header}>
          <Users size={14} color={colors.textMuted} strokeWidth={2.5} />
          <Text style={[styles.label, { color: colors.textMuted }]}>ACCOUNTABILITY PARTNER</Text>
        </View>

        <View style={styles.partnerRow}>
          <View style={[styles.avatar, { backgroundColor: coach.color + '20' }]}>
            <CoachIcon size={20} color={coach.color} strokeWidth={2} />
          </View>
          <View style={styles.partnerInfo}>
            <Text style={[styles.partnerName, { color: colors.textPrimary }]}>
              {partner?.display_name || partner?.username || 'Partner'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              {partner?.current_streak > 0 ? (
                <>
                  <Flame size={13} color={coach.color} strokeWidth={2.5} />
                  <Text style={[styles.partnerStreak, { color: coach.color }]}>
                    {partner.current_streak}-day streak
                  </Text>
                </>
              ) : (
                <Text style={[styles.partnerStreak, { color: colors.textMuted }]}>
                  No active streak
                </Text>
              )}
            </View>
          </View>
        </View>

        {activePartner.shared_streak > 0 && (
          <View style={[styles.sharedBadge, {
            backgroundColor: coach.color + '10',
            borderWidth: 1,
            borderColor: coach.color + '20',
          }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Flame size={12} color={coach.color} strokeWidth={2.5} />
              <Text style={[styles.sharedText, { color: coach.color }]}>
                {activePartner.shared_streak}-day shared streak
              </Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  label: {
    ...FONT.label,
    fontSize: 10,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerInfo: { flex: 1 },
  partnerName: { ...FONT.subhead, fontSize: 15 },
  partnerStreak: { ...FONT.caption, fontWeight: '600' },
  sharedBadge: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  sharedText: { ...FONT.caption, fontWeight: '600' },
});
