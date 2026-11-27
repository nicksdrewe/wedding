import { SITE_NAME, SITE_URL } from "@/lib/commercial/pricing";
import { FAQ } from "../_components/faq";

// A plain summary for AI assistants and answer engines (llmstxt.org).
export function GET() {
  const body = `# ${SITE_NAME}

> Private wedding websites for couples in the UK. Each wedding gets its own site at its own address (for example jonsarah.weddingsweddings.co.uk), with the guest list, RSVPs, planning, budget, messages and the day's running order in one place. Currently a free, invite-only alpha. No adverts.

## What a wedding site includes

- Guest list with households, plus ones and dietary needs
- RSVPs for every event (ceremony, reception, engagement party, stag and hen)
- Planning boards to compare venues and suppliers, with costs, photos, map pins and votes
- Budget and cost tracking, including who is contributing
- Diary, tasks and reminders
- Emails and updates to guests, sent from the wedding's own site
- Private pages for the wedding party
- A running order for the day on every guest's phone
- Five colour palettes and a day or night look
- Sign-in with an emailed code, no passwords

## Availability

- Invite-only alpha: couples with an invite code can start a wedding site free

## Questions

${FAQ.map((f) => `### ${f.q}\n\n${f.a}`).join("\n\n")}

## Links

- [Home](${SITE_URL}/)
- [Start a wedding site](${SITE_URL}/start)
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
