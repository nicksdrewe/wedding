import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { SettingsTabs } from "@/components/SettingsTabs";
import { getCurrentProfile } from "@/lib/auth/roles";
import { listPageRegistry, listPagePermissions, listKnownTags } from "@/lib/permissions/actions";
import { AccessMatrixForm } from "./AccessMatrixForm";

export default async function AccessPage() {
  // The (admin) layout now admits couple OR family (see 0028), but access
  // management must stay couple-only — this explicit check is the
  // defense-in-depth backstop for that, independent of the shared layout
  // guard.
  const profile = await getCurrentProfile();
  if (profile?.role !== "couple") redirect("/no-access");

  const [registry, permissions, knownTags] = await Promise.all([
    listPageRegistry(),
    listPagePermissions(),
    listKnownTags(),
  ]);

  const topLevel = registry.filter((r) => !r.parent_page_key);
  const childrenByParent = new Map<string, typeof registry>();
  for (const r of registry) {
    if (!r.parent_page_key) continue;
    const list = childrenByParent.get(r.parent_page_key) ?? [];
    list.push(r);
    childrenByParent.set(r.parent_page_key, list);
  }

  return (
    <div>
      <SettingsTabs className="mb-4" />
      <PageHeader
        eyebrow="Settings"
        title="Roles & Access"
        infoText="Control which roles and contact tags can see each page, and whether they see itemized detail or just the totals."
      />

      <p className="mt-4 font-reading text-sm text-ink-soft">
        <Link href="/errors" className="text-accent underline underline-offset-2">
          Recent errors
        </Link>{" "}
        — anything that has gone wrong on the site.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {topLevel.map((page) => (
          <AccessMatrixForm
            key={page.page_key}
            page={page}
            childPages={childrenByParent.get(page.page_key) ?? []}
            permissions={permissions.filter(
              (p) => p.page_key === page.page_key || (childrenByParent.get(page.page_key) ?? []).some((c) => c.page_key === p.page_key)
            )}
            knownTags={knownTags}
          />
        ))}
      </div>
    </div>
  );
}
