// ============================================================
// WeekStrip — 7-day date navigation (Cal AI / Lose It pattern).
//
// Each chip: weekday letter over a day number. Selected day is a
// filled accent circle (shape, not hue alone); days with logged
// entries get a small dot. Tap to view/log that day.
//
//   <WeekStrip days={[{key,label,num,logged,isToday}]}
//              selectedKey={key} onSelect={(key)=>...} />
// ============================================================

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { FONT, getTextOnColor } from '../constants/theme';
import * as haptics from '../services/haptics';

export default function WeekStrip({ days, selectedKey, onSelect, accent, colors }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {days.map((d) => {
        const selected = d.key === selectedKey;
        return (
          <Pressable
            key={d.key}
            onPress={() => { haptics.tick(); onSelect(d.key); }}
            accessibilityRole="button"
            accessibilityLabel={`${d.a11y}${d.logged ? ', has entries' : ''}${selected ? ', selected' : ''}`}
            style={{ alignItems: 'center', width: 40 }}
          >
            <Text style={{ ...FONT.label, fontSize: 10, color: d.isToday ? accent : colors.textMuted }}>
              {d.label}
            </Text>
            <View
              style={{
                width: 34, height: 34, borderRadius: 17, marginTop: 5,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: selected ? accent : 'transparent',
                borderWidth: selected ? 0 : 1,
                borderColor: d.isToday ? accent : colors.glassBorder,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Hanken-SemiBold', fontSize: 14, fontVariant: ['tabular-nums'],
                  color: selected ? getTextOnColor(accent) : colors.textPrimary,
                }}
              >
                {d.num}
              </Text>
            </View>
            <View
              style={{
                width: 4, height: 4, borderRadius: 2, marginTop: 5,
                backgroundColor: d.logged ? (selected ? accent : colors.textMuted) : 'transparent',
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
