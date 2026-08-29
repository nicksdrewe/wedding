'use client';
import { ReactNode, useMemo, useRef, useState } from 'react';
import {
  motion,
  useInView,
  Variant,
  Transition,
  UseInViewOptions,
} from 'motion/react';

export type InViewProps = {
  children: ReactNode;
  variants?: {
    hidden: Variant;
    visible: Variant;
  };
  transition?: Transition;
  viewOptions?: UseInViewOptions;
  as?: React.ElementType;
  once?: boolean;
  // Vendored addition (not in upstream motion-primitives): needed for
  // usage like `as="tr"` where wrapping in an extra element would break
  // table semantics, so there's no other way to carry layout classes.
  className?: string;
};

const defaultVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export function InView({
  children,
  variants = defaultVariants,
  transition,
  viewOptions,
  as = 'div',
  once,
  className,
}: InViewProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, viewOptions);

  const [isViewed, setIsViewed] = useState(false)

  // motion.create(tag) rather than the upstream component's motion[tag]
  // bracket access — both forward refs correctly, but bracket access on a
  // broad `React.ElementType` union makes TS choke ("union type too
  // complex" against motion.create's full overload set) once a ref is
  // involved. Narrowed to just the props this component actually passes,
  // same approach as the AnimatedNumber cast.
  //
  // Unlike `motion[tag]`, `motion.create(tag)` is NOT cached internally by
  // framer-motion (see node_modules/framer-motion/dist/es/render/components/
  // create-proxy.mjs — bracket access hits a Map cache, `.create` always
  // calls `createMotionComponent` fresh). Calling it directly in the render
  // body therefore produced a brand-new component *type* on every render,
  // so every time `isInView`/`isViewed` flipped, React tore down the whole
  // subtree and remounted a fresh instance — interrupting the in-flight
  // hidden→visible animation and restarting it from `initial="hidden"`
  // instead of letting the same instance transition through. `useMemo`d on
  // `as` so the component type is stable across re-renders, matching what
  // `motion[tag]` already gives you for free.
  const MotionComponent = useMemo(
    () =>
      motion.create(as as keyof React.JSX.IntrinsicElements) as unknown as React.ForwardRefExoticComponent<{
        ref?: React.Ref<HTMLElement>;
        className?: string;
        initial?: string;
        animate?: string;
        variants?: InViewProps["variants"];
        transition?: Transition;
        onAnimationComplete?: () => void;
        children?: ReactNode;
      }>,
    [as]
  );

  return (
    <MotionComponent
      ref={ref}
      className={className}
      initial='hidden'
      onAnimationComplete={() => {
        if (once) setIsViewed(true)
      }}
      animate={(isInView || isViewed) ? "visible" : "hidden"}

      variants={variants}
      transition={transition}
    >
      {children}
    </MotionComponent>
  );
}
