import { PageHeader } from "@/components/PageHeader";
import { listPageRegistry, listPagePermissions, listKnownTags } from "@/lib/permissions/actions";
import { AccessMatrixForm } from "./AccessMatrixForm";

export default async function AccessPage() {
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
      <PageHeader
        eyebrow="Household"
        title="Roles & Access"
        infoText="Control which roles and contact tags can see each page, and whether they see itemized detail or just the totals."
      />

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
