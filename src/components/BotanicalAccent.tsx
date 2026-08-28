import Image from "next/image";

// Original fine-line peony vector art (public/botanical) — generated for this
// project, not sourced from a reference image. Swap the files in
// public/botanical/ if the couple commissions replacement artwork later.
export function BotanicalAccent({
  className = "",
  variant = "corner",
}: {
  className?: string;
  variant?: "corner" | "divider";
}) {
  const src =
    variant === "corner"
      ? "/botanical/corner-spray.svg"
      : "/botanical/divider-sprig.svg";

  return (
    <Image
      src={src}
      alt=""
      width={variant === "corner" ? 200 : 600}
      height={variant === "corner" ? 400 : 90}
      className={className}
      priority={false}
    />
  );
}
