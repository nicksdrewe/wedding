// Vendored verbatim from https://github.com/ibelick/motion-primitives
// (components/core/glow-effect.tsx).
'use client';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { motion, Transition } from 'motion/react';

export type GlowEffectProps = {
  className?: string;
  style?: React.CSSProperties;
  colors?: string[];
  mode?:
    | 'rotate'
    | 'pulse'
    | 'breathe'
    | 'colorShift'
    | 'flowHorizontal'
    | 'static';
  blur?:
    | number
    | 'softest'
    | 'soft'
    | 'medium'
    | 'strong'
    | 'stronger'
    | 'strongest'
    | 'none';
  transition?: Transition;
  scale?: number;
  duration?: number;
};

export function GlowEffect({
  className,
  style,
  colors = ['#FF5733', '#33FF57', '#3357FF', '#F1C40F'],
  mode = 'rotate',
  blur = 'medium',
  transition,
  scale = 1,
  duration = 5,
}: GlowEffectProps) {
  // The upstream component recomputes this whole object (with fresh array/
  // object references) on every single render — harmless for a component
  // that only re-renders when ITS OWN props change, but this is typically
  // mounted inside a form (see EngagementPageClient's Send RSVP button)
  // that re-renders on every keystroke and every other field's state
  // change. Framer Motion's `animate` prop, given a structurally-new
  // target object on every render, doesn't reliably recognise "same
  // animation, keep looping" versus "new target, restart" — in practice
  // this showed up as the glow stuttering/restarting while typing and, in
  // one observed case, its background never recovering after a later
  // re-render (attending/not-attending) — a genuine bug report, not a
  // hypothetical. useMemo, keyed on the actual VALUES (colors joined to a
  // string, not the array reference — callers routinely pass a fresh
  // array literal as a prop on every render too, so keying on the array
  // itself wouldn't help), keeps the target referentially stable across
  // re-renders that don't actually change any of these inputs, letting
  // the loop continue smoothly instead of restarting.
  const colorsKey = colors.join('|');
  const transitionKey = transition ? JSON.stringify(transition) : '';

  const animations = useMemo(() => {
    const BASE_TRANSITION: Transition = {
      repeat: Infinity,
      duration: duration,
      ease: 'linear',
    };

    return {
      rotate: {
        background: [
          `conic-gradient(from 0deg at 50% 50%, ${colors.join(', ')})`,
          `conic-gradient(from 360deg at 50% 50%, ${colors.join(', ')})`,
        ],
        transition: {
          ...(transition ?? BASE_TRANSITION),
        },
      },
      pulse: {
        background: colors.map(
          (color) =>
            `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 100%)`
        ),
        scale: [1 * scale, 1.1 * scale, 1 * scale],
        opacity: [0.5, 0.8, 0.5],
        transition: {
          ...(transition ?? {
            ...BASE_TRANSITION,
            repeatType: 'mirror',
          }),
        },
      },
      breathe: {
        background: [
          ...colors.map(
            (color) =>
              `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 100%)`
          ),
        ],
        scale: [1 * scale, 1.05 * scale, 1 * scale],
        transition: {
          ...(transition ?? {
            ...BASE_TRANSITION,
            repeatType: 'mirror',
          }),
        },
      },
      colorShift: {
        background: colors.map((color, index) => {
          const nextColor = colors[(index + 1) % colors.length];
          return `conic-gradient(from 0deg at 50% 50%, ${color} 0%, ${nextColor} 50%, ${color} 100%)`;
        }),
        transition: {
          ...(transition ?? {
            ...BASE_TRANSITION,
            repeatType: 'mirror',
          }),
        },
      },
      flowHorizontal: {
        background: colors.map((color) => {
          const nextColor = colors[(colors.indexOf(color) + 1) % colors.length];
          return `linear-gradient(to right, ${color}, ${nextColor})`;
        }),
        transition: {
          ...(transition ?? {
            ...BASE_TRANSITION,
            repeatType: 'mirror',
          }),
        },
      },
      static: {
        background: `linear-gradient(to right, ${colors.join(', ')})`,
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
  }, [colorsKey, transitionKey, scale, duration]);

  const getBlurClass = (blur: GlowEffectProps['blur']) => {
    if (typeof blur === 'number') {
      return `blur-[${blur}px]`;
    }

    const presets = {
      softest: 'blur-xs',
      soft: 'blur-sm',
      medium: 'blur-md',
      strong: 'blur-lg',
      stronger: 'blur-xl',
      strongest: 'blur-xl',
      none: 'blur-none',
    };

    return presets[blur as keyof typeof presets];
  };

  return (
    <motion.div
      style={
        {
          ...style,
          '--scale': scale,
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        } as React.CSSProperties
      }
      animate={animations[mode]}
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full',
        'scale-[var(--scale)] transform-gpu',
        getBlurClass(blur),
        className
      )}
    />
  );
}
