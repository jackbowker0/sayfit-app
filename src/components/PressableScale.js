// ============================================================
// PressableScale — the app's standard tappable surface
//
// Native-feel press state: springs to ~0.97 scale on press-in,
// springs back on release (interruptible, native driver). Use
// this instead of TouchableOpacity for buttons, rows, and cards
// so every touch in the app has the same physical response.
//
//   <PressableScale onPress={...} haptic="tap" style={...}>
//
// haptic: 'tap' | 'medium' | 'tick' | null (default 'tap').
// scaleTo: how far to compress (rows want 0.98, buttons 0.96).
// containerStyle: layout styles for the outer Pressable (e.g.
// flex:1 when the button lives in a row).
// ============================================================

import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import * as haptics from '../services/haptics';

export default function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  containerStyle,
  scaleTo = 0.97,
  haptic = 'tap',
  disabled = false,
  ...props
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: scaleTo,
      stiffness: 300,
      damping: 20,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      stiffness: 200,
      damping: 14,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = (e) => {
    if (haptic && haptics[haptic]) haptics[haptic]();
    onPress?.(e);
  };

  return (
    <Pressable
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={handlePress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      style={containerStyle}
      {...props}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.5 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
