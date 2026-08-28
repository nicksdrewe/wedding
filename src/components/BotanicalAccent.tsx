// Placeholder fine-line botanical motif — swap for commissioned/generated artwork (see build brief §8).
export function BotanicalAccent({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 180 C 40 140, 30 100, 60 70 C 90 40, 130 40, 160 20" />
      <ellipse cx="70" cy="65" rx="18" ry="10" transform="rotate(-30 70 65)" />
      <ellipse cx="95" cy="48" rx="16" ry="9" transform="rotate(-15 95 48)" />
      <ellipse cx="125" cy="35" rx="14" ry="8" transform="rotate(10 125 35)" />
      <circle cx="155" cy="22" r="7" />
      <path d="M60 70 C 45 85, 35 95, 20 100" />
      <path d="M95 48 C 85 65, 75 75, 60 85" />
      <ellipse cx="30" cy="105" rx="10" ry="6" transform="rotate(40 30 105)" />
    </svg>
  );
}
