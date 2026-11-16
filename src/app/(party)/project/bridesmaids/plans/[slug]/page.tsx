import { CategoryDetail } from "@/app/(family)/categories/[slug]/CategoryDetail";

// One plan on the bridesmaids board: the same page as a main-wedding category,
// scoped to this board. Access (including prices) follows the board's page
// rules, which every plan inherits.
export default async function BridesmaidsPlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CategoryDetail slug={slug} board="bridesmaid" />;
}
