// Shown instantly inside the page frame while the real page loads.
export function PageSkeleton() {
  return (
    <div className="page-skel" aria-hidden="true">
      <div className="page-skel__bar page-skel__bar--title" />
      <div className="page-skel__bar" style={{ width: "68%" }} />
      <div className="page-skel__block" />
      <div className="page-skel__block" style={{ height: 90 }} />
      <div className="page-skel__block" style={{ height: 150 }} />
    </div>
  );
}
