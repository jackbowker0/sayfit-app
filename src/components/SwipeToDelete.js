// ============================================================
// SwipeToDelete — swipe a row left to reveal Delete (Mail-style).
//
// Pure-JS PanResponder + RN Animated so it works in the current
// dev build (no gesture-handler rebuild). Claims the gesture only
// on a clearly horizontal drag, so vertical scrolling stays smooth.
// A hard flick or tapping the revealed button deletes immediately —
// the swipe itself is the intent, no confirm dialog.
//
//   <SwipeToDelete onDelete={...} colors={colors}>
//     <RowContent/>   // give the row an opaque background
//   </SwipeToDelete>
// ============================================================

import React, { useRef } from 'react';
import { Animated, PanResponder, View, Pressable } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import * as haptics from '../services/haptics';

const OPEN_X = -84; // reveal width

export default function SwipeToDelete({ children, onDelete, colors }) {
  const x = useRef(new Animated.Value(0)).current;
  const open = useRef(false);

  const snapTo = (to) => {
    open.current = to !== 0;
    Animated.spring(x, {
      toValue: to, stiffness: 260, damping: 24, mass: 0.7, useNativeDriver: true,
    }).start();
  };

  const doDelete = () => { haptics.medium(); onDelete?.(); };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderMove: (_, g) => {
        const base = open.current ? OPEN_X : 0;
        let next = base + g.dx;
        if (next > 0) next = 0;
        if (next < OPEN_X * 1.8) next = OPEN_X * 1.8;
        x.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const pos = (open.current ? OPEN_X : 0) + g.dx;
        if (pos < OPEN_X * 1.6 || g.vx < -1.8) { snapTo(OPEN_X * 1.8); doDelete(); return; } // hard swipe = delete
        if (pos < OPEN_X * 0.55 || g.vx < -0.4) { if (!open.current) haptics.tick(); snapTo(OPEN_X); return; }
        snapTo(0);
      },
      onPanResponderTerminate: () => snapTo(open.current ? OPEN_X : 0),
    }),
  ).current;

  return (
    <View style={{ overflow: 'hidden' }}>
      <View style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: -OPEN_X }}>
        <Pressable
          onPress={doDelete}
          style={{ flex: 1, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Delete"
        >
          <Trash2 size={18} color="#FFFFFF" strokeWidth={2.2} />
        </Pressable>
      </View>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}
