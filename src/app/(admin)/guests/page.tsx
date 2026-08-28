import { createClient } from "@/lib/supabase/server";
import { AddContactForm } from "./AddContactForm";

export default async function GuestsPage() {
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, full_name, email, phone, role, tags, plus_one_eligible, rsvp_status, rsvp_token")
    .order("full_name");

  return (
    <div>
      <h1 className="font-script text-4xl">Guest List</h1>
      <p className="mt-2 font-serif text-ink-soft">
        Your working guest list — doubles as the CRM for RSVP links, tags,
        and reminders.
      </p>

      <AddContactForm />

      <div className="mt-10 overflow-x-auto rounded-2xl border border-ink/10">
        <table className="w-full text-left font-serif text-sm">
          <thead className="bg-cream-deep">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Tags</th>
              <th className="px-4 py-3">Plus one</th>
              <th className="px-4 py-3">RSVP status</th>
            </tr>
          </thead>
          <tbody>
            {(contacts ?? []).map((c) => (
              <tr key={c.id} className="border-t border-ink/10">
                <td className="px-4 py-3">{c.full_name}</td>
                <td className="px-4 py-3">{c.email}</td>
                <td className="px-4 py-3 capitalize">{c.role.replace("_", " ")}</td>
                <td className="px-4 py-3">{c.tags?.join(", ")}</td>
                <td className="px-4 py-3">{c.plus_one_eligible ? "Yes" : "No"}</td>
                <td className="px-4 py-3 capitalize">{c.rsvp_status}</td>
              </tr>
            ))}
            {(!contacts || contacts.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-soft">
                  No guests yet — add your first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
