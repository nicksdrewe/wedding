import type { Metadata } from "next";
import { LEGAL } from "@/lib/commercial/legal";
import { LegalPage } from "../_components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms for using Weddings Weddings during its free, invite-only alpha.",
  alternates: { canonical: "/terms" },
};

export const dynamic = "force-dynamic";

export default function TermsPage() {
  return (
    <LegalPage
      kicker="Terms"
      title="Terms of use"
      intro={
        <p>
          These terms apply to anyone who creates a wedding site on {LEGAL.operator} or uses one, whether as a couple,
          family member, wedding party member or guest. By using the service you agree to them.
        </p>
      }
    >
      <h2>The alpha</h2>
      <p>
        Weddings Weddings is in an invite-only alpha and is free to use. Because we&rsquo;re still building it, features
        may change, appear or be removed, and there may be interruptions. We will never charge you without telling you
        first and getting your agreement.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Give accurate details and keep access to your email account secure, since that&rsquo;s how you sign in.</li>
        <li>
          If you&rsquo;re a couple, you&rsquo;re responsible for who you invite to your site and what you allow each person to
          see and do.
        </li>
      </ul>

      <h2>Your content and your guests&rsquo; details</h2>
      <ul>
        <li>
          What you put on your site stays yours. You give us permission to store it and show it to the people you&rsquo;ve
          allowed, only so we can run the service for you.
        </li>
        <li>
          Only add details about people that you have a good reason to use for your wedding, and let your guests know their
          details are on your site. Our <a href="./privacy">privacy notice</a> explains how we handle them.
        </li>
        <li>Don&rsquo;t upload anything you don&rsquo;t have the right to share.</li>
      </ul>

      <h2>Using it fairly</h2>
      <p>Please don&rsquo;t use the service to:</p>
      <ul>
        <li>do anything unlawful, harmful, abusive or harassing;</li>
        <li>send email to anyone who isn&rsquo;t connected with your wedding;</li>
        <li>pretend to be someone else;</li>
        <li>try to get into parts of the service, or other people&rsquo;s weddings, that you haven&rsquo;t been given access to;</li>
        <li>overload, disrupt or copy the service.</li>
      </ul>

      <h2>Photos and your Google Drive</h2>
      <p>
        If you connect a Google Drive account, photos you upload are stored in a folder we create in that account. They
        are subject to your own agreement with Google. Disconnecting stops new uploads; photos already in your Drive stay
        there until you remove them.
      </p>

      <h2>Ending things</h2>
      <ul>
        <li>
          A couple can delete their wedding site at any time from its settings. This permanently deletes everything on it,
          as described in our privacy notice.
        </li>
        <li>
          We may suspend or remove a site that breaks these terms. Where it&rsquo;s reasonable, we&rsquo;ll tell you first
          and give you a chance to put things right.
        </li>
        <li>If we ever close the service, we&rsquo;ll give couples reasonable notice.</li>
      </ul>

      <h2>Our responsibility to you</h2>
      <p>
        During the alpha the service is provided free and as it is. We work hard to keep it running and to keep your
        information safe, but we can&rsquo;t promise it will always be available or free of errors, so please keep your own
        copy of anything critical (such as final numbers for your caterer).
      </p>
      <p>
        Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or
        for anything else the law doesn&rsquo;t allow us to limit, and nothing affects your legal rights as a consumer.
        Otherwise, we aren&rsquo;t responsible for losses that weren&rsquo;t a foreseeable result of our failing to meet
        these terms, and because the service is free, our total liability to you is limited to &pound;100.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms as the service grows. If a change matters, we&rsquo;ll update the date at the top and tell
        couples by email before it applies.
      </p>

      <h2>Law</h2>
      <p>
        These terms are governed by the law of England and Wales. If you live in Scotland or Northern Ireland, you can also
        bring proceedings in your local courts.
      </p>
    </LegalPage>
  );
}
