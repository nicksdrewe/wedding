import { Botanical } from "@/components/Botanical";

// The light behind every signed-in page: three slow pools of colour (one in
// the current section's bloom colour, one warm "sunlight", one pale wash), a
// faint paper grain, and two stems swaying at the bottom corners. Fixed to
// the window, never interactive, CSS-only (gradients + transforms, no blur
// filters), and stilled by the global prefers-reduced-motion rule.
export function Backdrop() {
  return (
    <div aria-hidden="true" className="backdrop">
      <div className="backdrop__glow backdrop__glow--a" />
      <div className="backdrop__glow backdrop__glow--b" />
      <div className="backdrop__glow backdrop__glow--c" />
      <div className="backdrop__grain" />
      <div className="backdrop__stem left-[-30px] hidden md:block">
        <Botanical seed={11} stems={3} width={220} height={360} spread={36} color="var(--sec)" strokeOpacity={0.16} fillOpacity={0.07} />
      </div>
      <div className="backdrop__stem right-[-24px] hidden md:block" style={{ animationDuration: "14s", animationDirection: "reverse" }}>
        <Botanical seed={29} stems={2} width={180} height={300} spread={24} color="var(--sec)" strokeOpacity={0.14} fillOpacity={0.06} />
      </div>
    </div>
  );
}
