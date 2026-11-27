import type { Metadata } from "next";
import { LegalPage } from "../_components/LegalPage";

export const metadata: Metadata = {
  title: "Cookie notice",
  description: "The only cookies Weddings Weddings uses are the ones needed to sign you in and keep the site working.",
  alternates: { canonical: "/cookies" },
};

export const dynamic = "force-dynamic";

const COOKIES = [
  ["sb-…-auth-token", "Keeps you signed in.", "Until you sign out, or it expires"],
  ["ww-wedding", "Remembers which wedding site you're on, so the right wedding's information loads.", "While you use the site"],
  ["ww-wedding-pick", "On preview addresses only: remembers which wedding was chosen.", "While you use the site"],
  ["View-as cookies", "Only when a couple uses \"view as\" to see the site as one of their guests; removed when they stop.", "Up to 30 minutes"],
];

const STORAGE = [
  ["The access code", "If a wedding asks for a code on its front page, your device remembers you've entered it."],
  ["Your email at sign-in", "Remembers the email you typed so you can finish signing in with the code we send."],
  ["The examples note", "Remembers that you've seen the note about the examples switch."],
];

export default function CookiesPage() {
  return (
    <LegalPage
      kicker="Cookies"
      title="Cookie notice"
      intro={
        <p>
          We only use cookies and similar storage that are strictly necessary to sign you in and make the site work. We
          don&rsquo;t use analytics, advertising or tracking cookies, which is why you won&rsquo;t see a cookie banner.
        </p>
      }
    >
      <h2>Cookies</h2>
      <div className="ww-legal-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>What it does</th>
              <th>How long</th>
            </tr>
          </thead>
          <tbody>
            {COOKIES.map(([n, w, h]) => (
              <tr key={n}>
                <td>{n}</td>
                <td>{w}</td>
                <td>{h}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Our hosting provider may also set a strictly necessary cookie to protect the site from abuse.</p>

      <h2>Storage on your device</h2>
      <p>A few small things are kept in your browser&rsquo;s own storage, never sent to anyone else:</p>
      <ul>
        {STORAGE.map(([n, w]) => (
          <li key={n}>
            <strong>{n}:</strong> {w}
          </li>
        ))}
      </ul>

      <h2>Notifications</h2>
      <p>
        If you turn on notifications, your browser gives us an address to send them to. You can turn them off at any time in
        your browser or phone settings.
      </p>

      <h2>Managing cookies</h2>
      <p>
        You can clear or block cookies in your browser settings. If you block the ones above, you won&rsquo;t be able to sign
        in.
      </p>
    </LegalPage>
  );
}
