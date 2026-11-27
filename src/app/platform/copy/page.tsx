import { COPY_FIELDS, loadCopy } from "@/lib/commercial/copy";
import { CopyEditor } from "./CopyEditor";

export default async function PlatformCopy() {
  const saved = await loadCopy();
  const fields = COPY_FIELDS.map((f) => ({ ...f, current: saved.get(f.key) ?? f.value }));
  return (
    <>
      <header className="pc-head">
        <div>
          <p className="pc-eyebrow">Site words</p>
          <h1 className="pc-title">Edit the front page</h1>
          <p className="pc-sub">Every heading and paragraph on the main site. Changes go live as soon as you save. Clear a box, or use &ldquo;Original&rdquo;, to put the first version back.</p>
        </div>
      </header>
      <CopyEditor fields={fields} />
    </>
  );
}
