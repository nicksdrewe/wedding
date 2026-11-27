import type { Metadata } from "next";
import { LEGAL } from "@/lib/commercial/legal";
import { LegalPage } from "../_components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How Weddings Weddings collects, uses and protects personal information, including guest lists, under UK GDPR.",
  alternates: { canonical: "/privacy" },
};

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="Privacy"
      title="Privacy notice"
      intro={
        <p>
          A wedding site holds a lot about a lot of people: who&rsquo;s invited, who&rsquo;s coming, what they can&rsquo;t eat.
          This notice explains what we collect, why, who else handles it, how long we keep it and the rights you have
          under UK data protection law (the UK GDPR and the Data Protection Act 2018).
        </p>
      }
    >
      <h2>Who we are</h2>
      <p>
        {LEGAL.operator} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) runs weddingsweddings.co.uk and the wedding sites at its
        addresses, such as jonsarah.weddingsweddings.co.uk. You can reach us at{" "}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>

      <h2>Two kinds of information, two roles</h2>
      <p>
        <strong>Couples&rsquo; accounts.</strong> When a couple signs up and uses the service, we decide how that
        information is used, so we are the <em>controller</em> of it.
      </p>
      <p>
        <strong>What couples put on their wedding site.</strong> The couple decides what goes on their site: their guest
        list, plans, photos and messages. We hold and process that information on the couple&rsquo;s behalf and on their
        instructions, so for that information we act as their <em>processor</em>. We don&rsquo;t use it for anything else.
        If you&rsquo;re a guest, the couple who invited you is the first place to go with questions about your details, but
        you&rsquo;re always welcome to contact us too.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name and email address, how you sign in (an emailed code, or a password if
          you set one), and your role at each wedding.
        </li>
        <li>
          <strong>Guest list details</strong> that a couple adds: names, email addresses, phone numbers, households, plus ones,
          tags such as &ldquo;best man&rdquo;, and a photo if one is added.
        </li>
        <li>
          <strong>Replies</strong> guests give: whether they&rsquo;re coming to each event, plus-one names, dietary
          requirements and any notes.
        </li>
        <li>
          <strong>Planning content:</strong> options, prices, costs, comments, votes, tasks, diary dates, the day&rsquo;s
          running order and uploaded photos.
        </li>
        <li>
          <strong>Messages</strong> sent from a wedding site to guests, and replies guests send back to the wedding&rsquo;s
          address.
        </li>
        <li>
          <strong>Technical information:</strong> IP addresses (to limit abuse such as repeated sign-in attempts), error
          reports when something breaks, the cookies described in our <a href="./cookies">cookie notice</a>, and, if you
          turn them on, the details your browser needs to send you notifications.
        </li>
        <li>
          <strong>Place searches:</strong> when someone types a postcode or address into a location box, that text is
          looked up to find it on a map.
        </li>
      </ul>

      <h2>Dietary and access needs</h2>
      <p>
        Dietary requirements and access needs can reveal information about health or religious belief, which the law
        treats as special category data. We only hold it because a guest chooses to tell the couple, it is used only to
        plan the wedding, and only the couple and the people they choose can see it. A guest can change or remove it at
        any time from their reply.
      </p>

      <h2>Why we use it, and on what basis</h2>
      <ul>
        <li>
          <strong>To provide the service</strong> to the couple who signed up (performing our agreement with them).
        </li>
        <li>
          <strong>To keep it secure and working:</strong> preventing abuse, fixing errors and protecting accounts (our
          legitimate interests in running a safe service).
        </li>
        <li>
          <strong>On the couple&rsquo;s instructions</strong> for everything on their wedding site.
        </li>
        <li>
          <strong>With your consent</strong> for phone notifications, which you can turn off at any time, and for any
          dietary or access needs you choose to share.
        </li>
      </ul>
      <p>We don&rsquo;t sell personal information, we don&rsquo;t show adverts, and we don&rsquo;t send guests marketing.</p>

      <h2>Who else handles it</h2>
      <p>We use a small number of providers to run the service. Each handles information only to do that job:</p>
      <ul>
        <li>
          <strong>Supabase</strong>: our database and sign-in.
        </li>
        <li>
          <strong>Vercel</strong>: hosting the website.
        </li>
        <li>
          <strong>Resend</strong>: sending emails from wedding sites and receiving replies to them.
        </li>
        <li>
          <strong>Google</strong>: photos uploaded to a wedding site are stored in the Google Drive account that the
          couple connects, so they sit in the couple&rsquo;s own storage, under the couple&rsquo;s own agreement with Google.
        </li>
        <li>
          <strong>postcodes.io and OpenStreetMap</strong>: turning a postcode or address that someone types into a place
          on a map. Only the text typed is sent.
        </li>
        <li>
          <strong>Your browser&rsquo;s notification service</strong>, if you turn on notifications.
        </li>
      </ul>
      <p>
        Some of these providers process information outside the UK, including in the United States. Where they do, the
        transfer is protected by the safeguards UK law requires, such as the UK International Data Transfer Addendum or the
        UK&ndash;US data bridge.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Everything on a wedding site is kept for as long as the site exists. The couple can delete the whole site at any
        time from its settings. That deletes, straight away, every guest, reply, plan, message and setting, the
        site&rsquo;s uploaded photos, and the sign-ins of anyone who wasn&rsquo;t part of another wedding. Technical
        records, such as error reports and abuse-prevention logs, are kept only as long as they are needed to keep the
        service secure and working.
      </p>

      <h2>Your rights</h2>
      <p>Under UK data protection law you can ask us to:</p>
      <ul>
        <li>give you a copy of the personal information we hold about you;</li>
        <li>correct anything that&rsquo;s wrong;</li>
        <li>delete it;</li>
        <li>restrict or object to how we use it;</li>
        <li>give it to you in a format you can take elsewhere;</li>
        <li>stop using it where we rely on your consent.</li>
      </ul>
      <p>
        Email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> and we&rsquo;ll reply within one month. If
        you&rsquo;re a guest, the couple can also correct or remove your details directly. If you&rsquo;re unhappy with how
        we&rsquo;ve handled your information, you can complain to the Information Commissioner&rsquo;s Office at{" "}
        <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">
          ico.org.uk
        </a>{" "}
        or on 0303 123 1113.
      </p>

      <h2>Keeping it safe</h2>
      <p>
        Information is encrypted in transit. Each wedding&rsquo;s information is kept separate from every other wedding&rsquo;s
        at the database level, and within a wedding, each page shows only what the couple has allowed each person to see.
        Sign-in uses one-time codes sent by email, so there are no shared passwords to leak.
      </p>

      <h2>Children</h2>
      <p>
        Accounts are for adults. Couples may add children to a guest list so they can be counted and catered for; please
        add only what&rsquo;s needed.
      </p>

      <h2>For couples: your guests&rsquo; information</h2>
      <p>
        You decide who goes on your guest list and what you record about them. Please add only what you need for the
        wedding, let your guests know their details are on your site (a link to this notice is enough), and delete the site
        when you no longer need it.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this notice in a way that matters, we&rsquo;ll update the date at the top and, for significant changes,
        tell couples by email.
      </p>
    </LegalPage>
  );
}
