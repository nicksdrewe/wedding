'use client';
import { cn } from '@/lib/utils';
import { motion, SpringOptions, useSpring, useTransform } from 'motion/react';
import * as React from 'react';
import { useEffect } from 'react';

export type AnimatedNumberProps = {
  value: number;
  className?: string;
  springOptions?: SpringOptions;
  as?: React.ElementType;
};

export function AnimatedNumber({
  value,
  className,
  springOptions,
  as = 'span',
}: AnimatedNumberProps) {
  const MotionComponent = motion.create(
    as as keyof React.JSX.IntrinsicElements
  ) as React.ComponentType<{ className?: string; children?: React.ReactNode }>;

  // Starts at 0 regardless of the initial value so the very first render
  // counts up rather than appearing pre-filled — subsequent value changes
  // then animate from wherever the spring already sits, not a reset to 0.
  const spring = useSpring(0, { duration: 2000, ...springOptions });
  const display = useTransform(spring, (current) =>
    Math.round(current).toLocaleString()
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return (
    <MotionComponent className={cn('tabular-nums', className)}>
      {display as unknown as React.ReactNode}
    </MotionComponent>
  );
}
