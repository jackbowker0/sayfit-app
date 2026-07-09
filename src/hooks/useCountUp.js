// ============================================================
// useCountUp — animates a number to its new value (ease-out).
//
// Pro apps animate hero metrics instead of snapping them; pair
// with fontVariant tabular-nums so width doesn't jitter.
//   const shown = useCountUp(remaining);
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

export default function useCountUp(value, duration = 600) {
  const target = Number.isFinite(value) ? value : 0;
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // drives state, not a transform
    }).start();
    return () => anim.removeListener(id);
  }, [target]);

  return display;
}
