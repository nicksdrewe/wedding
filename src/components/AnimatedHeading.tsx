"use client";

import { TextEffect } from "@/components/motion-primitives/text-effect";

// Thin wrapper so every page heading gets the same reveal without repeating
// TextEffect's props everywhere — word-by-word fade-and-blur, once on mount.
export function AnimatedHeading({
  as = "h1",
  className,
  children,
}: {
  as?: React.ElementType;
  className?: string;
  children: string;
}) {
  return (
    <TextEffect
      as={as as keyof React.JSX.IntrinsicElements}
      per="word"
      preset="fade-in-blur"
      speedReveal={1.4}
      className={className}
    >
      {children}
    </TextEffect>
  );
}
