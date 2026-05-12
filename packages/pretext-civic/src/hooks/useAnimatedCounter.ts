import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Animated number counter hook.
 *
 * Usage:
 *   const { value, isAnimating } = useAnimatedCounter(1000, 800);
 *
 * Returns the current interpolated value and whether animation is in progress.
 * Uses requestAnimationFrame with an ease-out-cubic easing.
 */
export function useAnimatedCounter(
  target: number,
  duration: number = 600,
): { value: number; isAnimating: boolean } {
  const [value, setValue] = useState(target);
  const [isAnimating, setIsAnimating] = useState(false);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const fromRef = useRef(target);

  const animate = useCallback(
    (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - (1 - progress) ** 3;

      const current = fromRef.current + (target - fromRef.current) * eased;
      setValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setValue(target);
        setIsAnimating(false);
      }
    },
    [target, duration],
  );

  useEffect(() => {
    fromRef.current = value;
    startRef.current = 0;
    setIsAnimating(true);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, animate]);

  return { value, isAnimating };
}
