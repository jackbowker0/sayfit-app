// ============================================================
// ProgressRing — single hero progress arc (rounded caps, track
// hairline, ~800ms sweep-in). One ring max per screen; bars for
// everything that needs comparing.
//
//   <ProgressRing size={88} progress={0.72} color={accent}
//                 trackColor={colors.bgSubtle}>
//     <Text>72%</Text>
//   </ProgressRing>
// ============================================================

import React, { useEffect, useRef } from 'react';
import { Animated, View, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ProgressRing({
  size = 88,
  stroke = 9,
  progress = 0,
  color,
  trackColor,
  children,
}) {
  const pct = Math.min(Math.max(progress, 0), 1);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // SVG props can't ride the native driver
    }).start();
  }, [pct]);

  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        {pct > 0 && (
          <AnimatedCircle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={stroke} fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}
