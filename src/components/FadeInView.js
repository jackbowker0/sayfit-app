// ============================================================
// FadeInView — Drop-in replacement for Reanimated entering animations
//
// Usage:
//   <FadeInView delay={100}>Content</FadeInView>
//   <FadeInView delay={200} from="up">Content</FadeInView>
//   <FadeInView delay={300} type="zoom">Content</FadeInView>
// ============================================================

import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export default function FadeInView({
  children,
  style,
  delay = 0,
  duration = 400,
  from = 'down',  // 'down' | 'up' | 'right' | 'left' | 'none'
  type = 'fade',  // 'fade' | 'zoom' | 'slide'
  distance = 20,
  ...props
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(getInitialTranslate(from, distance))).current;
  const scale = useRef(new Animated.Value(type === 'zoom' ? 0.5 : 1)).current;

  useEffect(() => {
    const animations = [
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ];

    if (from !== 'none' && type !== 'zoom') {
      animations.push(
        Animated.timing(translate, {
          toValue: 0,
          duration,
          delay,
          useNativeDriver: true,
        })
      );
    }

    if (type === 'zoom') {
      animations.push(
        Animated.spring(scale, {
          toValue: 1,
          delay,
          useNativeDriver: true,
          damping: 12,
          stiffness: 150,
        })
      );
    }

    Animated.parallel(animations).start();
  }, []);

  const transform = [];
  if (type === 'zoom') {
    transform.push({ scale });
  } else if (from === 'down' || from === 'up') {
    transform.push({ translateY: translate });
  } else if (from === 'left' || from === 'right') {
    transform.push({ translateX: translate });
  }

  return (
    <Animated.View
      style={[style, { opacity, transform }]}
      {...props}
    >
      {children}
    </Animated.View>
  );
}

function getInitialTranslate(from, distance) {
  switch (from) {
    case 'down': return distance;
    case 'up': return -distance;
    case 'right': return distance;
    case 'left': return -distance;
    default: return 0;
  }
}
