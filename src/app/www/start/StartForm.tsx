"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { applyCode, checkAddress, createWedding, type SignupResult } from "@/lib/commercial/actions";
import { suggestSlug, tidySlug } from "@/lib/commercial/slug";
import { ROOT_DOMAIN } from "@/lib/wedding/host";

type Address = { state: "idle" | "checking" | "ok" | "bad"; note: string | null };

export function StartForm() {
  const [one, setOne] = useState("");
  const [two, setTwo] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [address, setAddress] = useState<Address>({ state: "idle", note: null });
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState<{ code: string; percent: number } | null>(null);
  const [codeNote, setCodeNote] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [done, setDone] = useState<Extract<SignupResult, { ok: true }> | null>(null);
  const [applying, startApply] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const checkSeq = useRef(0);

  // The address follows the names until it's edited by hand.
  useEffect(() => {
    if (!slugEdited) setSlug(suggestSlug(one, two));
  }, [one, two, slugEdited]);

  // Check the address shortly after typing stops.
  useEffect(() => {
    if (slug.length < 3) {
      setAddress({ state: "idle", note: null });
      return;
    }
    const seq = ++checkSeq.current;
    setAddress({ state: "checking", note: "Checking…" });
    const t = setTimeout(async () => {
      const r = await checkAddress(slug);
      if (seq !== checkSeq.current) return;
      setAddress(r.available ? { state: "ok", note: "That address is free." } : { state: "bad", note: r.reason });
    }, 400);
    return () => clearTimeout(t);
  }, [slug]);

  const accepted = !!discount && discount.percent >= 100;

  function apply() {
    setCodeNote(null);
    startApply(async () => {
      const r = await applyCode(code);
      if (r.percent != null) {
        setDiscount({ code: code.trim().toUpperCase(), percent: r.percent });
        setCodeNote(r.percent < 100 ? "That code isn't an alpha invite. Check the code you were sent." : "You're in. Welcome to the alpha.");
      } else {
        setDiscount(null);
        setCodeNote(r.error);
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accepted) {
      setError({ text: "Add your invite code to continue. We're invite-only during the alpha.", field: "code" });
      return;
    }
    startSubmit(async () => {
      const r = await createWedding({ partnerOne: one, partnerTwo: two, dateLabel, slug, fullName, email, code: discount!.code });
      if (r.ok) {
        setDone(r);
        window.scrollTo({ top: 0 });
      } else setError({ text: r.error, field: r.field });
    });
  }

  if (done) {
    return (
      <div className="ww-done" role="status">
        <p className="ww-kicker">All set</p>
        <h2 className="ww-h2">
          {one} &amp; {two}, your site is ready.
        </h2>
        <p className="ww-url-big">
          <b>{done.slug}</b>.{ROOT_DOMAIN}
        </p>
        <p className="ww-sub">
          Sign in there with <strong>{done.email}</strong>. We&rsquo;ll email you a code, so there&rsquo;s no password to
          remember. We&rsquo;ve sent the address to your inbox too.
        </p>
        <a href={done.siteUrl} className="ww-btn ww-btn-primary">
          Open your site
        </a>
      </div>
    );
  }

  const invalid = (f: string) => (error?.field === f ? true : undefined);

  return (
    <form className="ww-start-grid" onSubmit={submit} noValidate style={{ marginTop: 36 }}>
      <div className="ww-form">
        <fieldset className="ww-fieldset">
          <legend>The two of you</legend>
          <div className="ww-row">
            <label className="ww-label">
              First name
              <input
                className="ww-input"
                value={one}
                onChange={(e) => setOne(e.target.value)}
                autoComplete="given-name"
                maxLength={60}
                aria-invalid={invalid("partnerOne")}
              />
            </label>
            <label className="ww-label">
              And
              <input className="ww-input" value={two} onChange={(e) => setTwo(e.target.value)} maxLength={60} aria-invalid={invalid("partnerTwo")} />
            </label>
          </div>
          <label className="ww-label">
            When
            <small>A date, or something looser like &ldquo;Summer 2027&rdquo;. Optional.</small>
            <input className="ww-input" value={dateLabel} onChange={(e) => setDateLabel(e.target.value)} maxLength={60} placeholder="Summer 2027" />
          </label>
        </fieldset>

        <fieldset className="ww-fieldset">
          <legend>Your address</legend>
          <label className="ww-label">
            Where guests will find you
            <span className="ww-address">
              <input
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(tidySlug(e.target.value));
                }}
                placeholder="jonsarah"
                aria-invalid={invalid("slug") ?? (address.state === "bad" ? true : undefined)}
                autoCapitalize="none"
                spellCheck={false}
                maxLength={40}
              />
              <span>.{ROOT_DOMAIN}</span>
            </span>
          </label>
          {address.note && (
            <p className={`ww-note ${address.state === "ok" ? "ok" : address.state === "bad" ? "bad" : ""}`} aria-live="polite">
              {address.note}
            </p>
          )}
        </fieldset>

        <fieldset className="ww-fieldset">
          <legend>You</legend>
          <div className="ww-row">
            <label className="ww-label">
              Your full name
              <input
                className="ww-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                maxLength={120}
                aria-invalid={invalid("fullName")}
              />
            </label>
            <label className="ww-label">
              Email
              <input
                className="ww-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                maxLength={320}
                aria-invalid={invalid("email")}
              />
            </label>
          </div>
          <p className="ww-note">You&rsquo;ll sign in with this. Your partner can be added once you&rsquo;re in.</p>
        </fieldset>
      </div>

      <aside className="ww-order" aria-label="Your invite">
        <h2>Your invite</h2>
        <p className="ww-note" style={{ fontSize: 14, lineHeight: 1.55 }}>
          We&rsquo;re invite-only while we build this with our first couples, and it&rsquo;s free for alpha couples. Add the
          code you were sent.
        </p>
        <label className="ww-label">
          Invite code
          <span className="ww-code">
            <input
              className="ww-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  apply();
                }
              }}
              aria-invalid={invalid("code")}
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={60}
            />
            <button
              type="button"
              className="ww-btn ww-btn-ghost ww-btn-sm"
              onClick={apply}
              disabled={applying || !code.trim()}
              style={{ minHeight: 46 }}
            >
              {applying ? "Checking…" : "Apply"}
            </button>
          </span>
        </label>
        {codeNote && (
          <p className={`ww-note ${accepted ? "ok" : "bad"}`} aria-live="polite">
            {codeNote}
          </p>
        )}

        {error && (
          <p className="ww-error" role="alert">
            {error.text}
          </p>
        )}

        <button type="submit" className="ww-btn ww-btn-primary ww-btn-block" disabled={submitting}>
          {submitting ? "Making your site…" : "Create our wedding site"}
        </button>
        <p className="ww-fine ww-center" style={{ margin: 0 }}>
          No invite yet? Ask the couple who told you about us.
        </p>
        <p className="ww-fine ww-center" style={{ margin: 0 }}>
          By creating your site you agree to our <a href="./terms">terms</a> and <a href="./privacy">privacy notice</a>.
          Only add guests&rsquo; details you need for your wedding.
        </p>
      </aside>
    </form>
  );
}
