// Little looping pictures for each part of the site. They are pure CSS on one
// shared 9-second clock (see www.css, --loop), so every scene on the page
// beats in time with the others: while a winner is chosen on one, a cost
// lands on the next and a guest replies on another.

export function BoardScene() {
  return (
    <div className="ww-scene ww-sc-board" aria-hidden="true">
      <div className="sc-opt a">
        <span className="sc-img" />
        <b>Hill House</b>
        <em>£9,100</em>
        <span className="sc-votes">
          <i />
          <i />
          <i />
        </span>
        <span className="sc-crown">Winner</span>
      </div>
      <div className="sc-opt b">
        <span className="sc-img" />
        <b>The Old Barn</b>
        <em>£8,400</em>
        <span className="sc-votes">
          <i />
        </span>
      </div>
      <div className="sc-opt c">
        <span className="sc-img" />
        <b>Riverside Hall</b>
        <em>£7,250</em>
        <span className="sc-votes" />
      </div>
      <div className="sc-bubble">&ldquo;Those gardens though&rdquo;</div>
      <div className="sc-pin" />
    </div>
  );
}

export function TreeScene() {
  return (
    <div className="ww-scene ww-sc-tree" aria-hidden="true">
      <span className="sc-node root">Our wedding</span>
      <div className="sc-branches">
        {["Ceremony", "Reception", "Food", "Music", "Outfits", "Stag & hen"].map((n, i) => (
          <span key={n} className={`sc-node n${i}`}>
            {n}
          </span>
        ))}
      </div>
      <svg className="sc-lines" viewBox="0 0 300 60" preserveAspectRatio="none">
        {[25, 75, 125, 175, 225, 275].map((x, i) => (
          <path key={x} className={`l${i}`} d={`M150 0 C150 30, ${x} 30, ${x} 60`} />
        ))}
      </svg>
    </div>
  );
}

export function BudgetScene() {
  return (
    <div className="ww-scene ww-sc-budget" aria-hidden="true">
      {[
        ["Venue", "£9,100"],
        ["Food & drink", "£6,480"],
        ["Flowers", "£1,950"],
        ["Band", "£2,200"],
      ].map(([n, v], i) => (
        <div key={n} className={`sc-row r${i}`}>
          <span>{n}</span>
          <b>{v}</b>
          <i />
        </div>
      ))}
      <div className="sc-split">
        <span>Stag weekend</span>
        <span className="sc-chip">8 ways · £142 each</span>
      </div>
    </div>
  );
}

export function GuestsScene() {
  return (
    <div className="ww-scene ww-sc-guests" aria-hidden="true">
      <div className="sc-head">
        <b className="sc-count" />
        <span>coming to the ceremony</span>
      </div>
      {[
        ["Aunt Jo & Pete", "Ceremony · Evening"],
        ["The Okafors (4)", "Evening only"],
        ["Sam + 1", "Vegetarian"],
        ["Grandma Rose", "Step-free seat"],
      ].map(([n, d], i) => (
        <div key={n} className={`sc-guest g${i}`}>
          <span className="sc-dot" />
          <span className="sc-name">
            {n}
            <em>{d}</em>
          </span>
          <span className="sc-status" />
        </div>
      ))}
    </div>
  );
}

export function PartyScene() {
  return (
    <div className="ww-scene ww-sc-party" aria-hidden="true">
      <div className="sc-card back">
        <b>Stag do · Porto</b>
        <span>Flights £96 · Boat party £45</span>
      </div>
      <div className="sc-card front">
        <span className="sc-lock" />
        <b>Hidden from the couple</b>
        <span>Only the best man and groomsmen can see this</span>
      </div>
    </div>
  );
}

export function MessagesScene() {
  return (
    <div className="ww-scene ww-sc-msg" aria-hidden="true">
      <div className="sc-mail">
        <span className="sc-from">From: Jon &amp; Sarah</span>
        <b>Coaches leave at 1.30pm</b>
        <span className="sc-to">To: everyone not driving (64)</span>
      </div>
      <div className="sc-replies">
        <span className="r0">Aunt Jo: Perfect, see you there x</span>
        <span className="r1">Tom: Can we bring the pram?</span>
        <span className="r2">Priya: Saved us a seat!</span>
      </div>
    </div>
  );
}

export function DayScene() {
  return (
    <div className="ww-scene ww-sc-day" aria-hidden="true">
      {[
        ["13:30", "Coaches leave the hotel"],
        ["14:00", "Ceremony"],
        ["15:15", "Drinks on the lawn"],
        ["17:30", "Dinner & speeches"],
        ["20:00", "First dance"],
      ].map(([t, n], i) => (
        <div key={t} className={`sc-slot s${i}`}>
          <time>{t}</time>
          <span>{n}</span>
        </div>
      ))}
      <span className="sc-now" />
    </div>
  );
}
