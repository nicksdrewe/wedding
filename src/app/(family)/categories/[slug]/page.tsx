import { CategoryDetail } from "./CategoryDetail";

export default async function CategoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CategoryDetail slug={slug} board={null} />;
}
