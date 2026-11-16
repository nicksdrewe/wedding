import { redirect } from "next/navigation";

// Categories and Project Management are now one page: Wedding Planning.
export default function CategoriesPage() {
  redirect("/project");
}
