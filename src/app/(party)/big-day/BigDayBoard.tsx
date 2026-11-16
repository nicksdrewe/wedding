"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { Clock, Eye, GripVertical, Pencil, Plus } from "lucide-react";
import { toDriveImageUrl } from "@/lib/google/image-url";
import { CostRange } from "@/components/CostRange";
import { EmptyState } from "@/components/EmptyState";
import {
  deleteBigDayItem,
  moveBigDayItem,
  saveBigDayDates,
  saveBigDayItem,
  setBigDayPublished,
} from "@/lib/big-day/actions";
import { daysBetween, listDays, longDate, MAX_SPAN_DAYS, shortDate, timeToMinutes, weekdayOf } from "@/lib/big-day/dates";
import {
  BIG_DAY_COLOURS,
  COLOUR_LABELS,
  type BigDayColour,
  type BigDayItem,
  type BigDaySettings,
  type BigDaySource,
} from "@/lib/big-day/types";

type Draft = {
  id?: string;
  title: string;
  day: string;
  startTime: string;
  endTime: string;
  colour: BigDayColour;
  notes: string;
  visible: boolean;
  pageOptionId: string | null;
  ideaId: string | null;
};

type DragPayload = { type: "item"; id: string } | { type: "source"; kind: BigDaySource["kind"] | "custom"; id: string };

function sortItems(items: BigDayItem[]): BigDayItem[] {
  return [...items].sort((a, b) => {
    if (!a.startTime && b.startTime) return -1;
    if (a.startTime && !b.startTime) return 1;
    if (a.startTime && b.startTime && a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

function overlapping(items: BigDayItem[]): Set<string> {
  const timed = items.filter((i) => i.startTime);
  const out = new Set<string>();
  const span = (i: BigDayItem) => {
    const s = timeToMinutes(i.startTime as string);
    return [s, i.endTime ? timeToMinutes(i.endTime) : s + 1] as const;
  };
  for (let a = 0; a < timed.length; a++) {
    for (let b = a + 1; b < timed.length; b++) {
      const [as, ae] = span(timed[a]);
      const [bs, be] = span(timed[b]);
      if (as < be && bs < ae) {
        out.add(timed[a].id);
        out.add(timed[b].id);
      }
    }
  }
  return out;
}

function timeLabel(i: BigDayItem): string {
  if (!i.startTime) return "Any time";
  return i.endTime ? `${i.startTime}–${i.endTime}` : i.startTime;
}

export function BigDayBoard({
  settings,
  items,
  chosen,
  ideas,
  canEdit,
  isCouple,
}: {
  settings: BigDaySettings;
  items: BigDayItem[];
  chosen: BigDaySource[];
  ideas: BigDaySource[];
  canEdit: boolean;
  isCouple: boolean;
}) {
  const days = useMemo(() => listDays(settings.startDate, settings.endDate), [settings.startDate, settings.endDate]);
  const [, startTransition] = useTransition();
  const [shown, moveOptimistic] = useOptimistic(items, (cur, m: { id: string; day: string }) =>
    cur.map((i) => (i.id === m.id ? { ...i, day: m.day } : i)),
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);
  const drag = useRef<DragPayload | null>(null);

  const activeDay = selectedDay && days.includes(selectedDay) ? selectedDay : (days[0] ?? null);

  const byDay = useMemo(() => {
    const map = new Map<string, BigDayItem[]>();
    for (const d of days) map.set(d, []);
    const outside: BigDayItem[] = [];
    for (const i of shown) {
      const list = map.get(i.day);
      if (list) list.push(i);
      else outside.push(i);
    }
    for (const [d, list] of map) map.set(d, sortItems(list));
    return { map, outside: [...outside].sort((a, b) => (a.day === b.day ? 0 : a.day < b.day ? -1 : 1)) };
  }, [shown, days]);

  const sourceByKey = useMemo(() => {
    const m = new Map<string, BigDaySource>();
    for (const s of [...chosen, ...ideas]) m.set(`${s.kind}:${s.id}`, s);
    return m;
  }, [chosen, ideas]);

  function blankDraft(day: string): Draft {
    return {
      title: "",
      day,
      startTime: "",
      endTime: "",
      colour: "gold",
      notes: "",
      visible: false,
      pageOptionId: null,
      ideaId: null,
    };
  }

  function draftFromSource(s: BigDaySource, day: string): Draft {
    return {
      ...blankDraft(day),
      title: s.title,
      colour: s.kind === "option" ? "moss" : "dusk",
      pageOptionId: s.kind === "option" ? s.id : null,
      ideaId: s.kind === "idea" ? s.id : null,
    };
  }

  function editDraft(i: BigDayItem): Draft {
    return {
      id: i.id,
      title: i.title,
      day: i.day,
      startTime: i.startTime ?? "",
      endTime: i.endTime ?? "",
      colour: i.colour,
      notes: i.notes ?? "",
      visible: i.visibleToGuests,
      pageOptionId: i.pageOptionId,
      ideaId: i.ideaId,
    };
  }

  function addFrom(source: BigDaySource | null) {
    if (!activeDay) return;
    setNotice(null);
    setDraft(source ? draftFromSource(source, activeDay) : blankDraft(activeDay));
  }

  function createAndEdit(d: Draft) {
    startTransition(async () => {
      const res = await saveBigDayItem({
        title: d.title || "New item",
        notes: null,
        day: d.day,
        startTime: null,
        endTime: null,
        colour: d.colour,
        visibleToGuests: false,
        pageOptionId: d.pageOptionId,
        ideaId: d.ideaId,
      });
      if (res.error || !res.id) {
        setNotice(res.error ?? "Couldn't add that.");
        return;
      }
      setDraft({ ...d, id: res.id });
    });
  }

  function onDropOnDay(day: string) {
    const payload = drag.current;
    drag.current = null;
    setDropDay(null);
    if (!canEdit || !payload) return;
    setNotice(null);
    if (payload.type === "item") {
      const item = shown.find((i) => i.id === payload.id);
      if (!item || item.day === day) return;
      startTransition(async () => {
        moveOptimistic({ id: item.id, day });
        const res = await moveBigDayItem(item.id, day);
        if (res.error) setNotice(res.error);
      });
      return;
    }
    if (payload.kind === "custom") {
      createAndEdit(blankDraft(day));
      return;
    }
    const source = sourceByKey.get(`${payload.kind}:${payload.id}`);
    if (source) createAndEdit(draftFromSource(source, day));
  }

  if (days.length === 0) {
    return (
      <div className="space-y-5">
        {canEdit ? (
          <section className="surface surface-raised max-w-xl p-5 rise">
            <h2 className="font-title text-[22px] tracking-tight">When is the celebration?</h2>
            <p className="mt-1 font-reading text-[14px] text-ink-soft">
              Choose the first and last day. It can run for up to {MAX_SPAN_DAYS} days, from a single Saturday to a whole week.
            </p>
            <DatesForm settings={settings} />
          </section>
        ) : (
          <EmptyState title="The schedule isn't set yet" hint="Check back once the couple have chosen the days." />
        )}
        {canEdit && settings.startDate && (
          <p className="font-serif text-[13px] text-alert" role="alert">
            The saved dates aren&apos;t valid. Choose them again.
          </p>
        )}
      </div>
    );
  }

  const columns = days.map((day, idx) => {
    const list = byDay.map.get(day) ?? [];
    const clash = overlapping(list);
    return (
      <section
        key={day}
        className="bd-col"
        data-active={day === activeDay}
        data-drop={dropDay === day}
        aria-label={longDate(day)}
        onDragOver={(e) => {
          if (!canEdit || !drag.current) return;
          e.preventDefault();
          if (dropDay !== day) setDropDay(day);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropDay((d) => (d === day ? null : d));
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDropOnDay(day);
        }}
      >
        <h2 className="bd-col__head font-title">
          <span className="bd-col__weekday">{weekdayOf(day, "long")}</span>
          <span className="bd-col__date">{shortDate(day)}</span>
        </h2>
        <ul className="bd-col__list">
          {list.map((item, n) => (
            <li key={item.id}>
              <ItemCard
                item={item}
                canEdit={canEdit}
                clash={clash.has(item.id)}
                index={idx === 0 ? n : 0}
                onEdit={() => {
                  setNotice(null);
                  setDraft(editDraft(item));
                }}
                onDragStart={() => {
                  drag.current = { type: "item", id: item.id };
                }}
                onDragEnd={() => {
                  drag.current = null;
                  setDropDay(null);
                }}
              />
            </li>
          ))}
        </ul>
        {list.length === 0 && (
          <p className="bd-col__empty">{canEdit ? "Nothing yet. Drag something here, or use Add." : "Nothing planned yet."}</p>
        )}
        {canEdit && (
          <button
            type="button"
            className="btn btn-quiet btn-sm bd-col__add"
            onClick={() => {
              setNotice(null);
              setDraft(blankDraft(day));
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Add to {weekdayOf(day)}
          </button>
        )}
      </section>
    );
  });

  return (
    <div className="space-y-5">
      {canEdit && <SettingsStrip settings={settings} isCouple={isCouple} />}

      {notice && (
        <p className="font-serif text-[14px] text-alert" role="alert">
          {notice}
        </p>
      )}

      <div className={canEdit ? "bd-layout bd-layout--side" : "bd-layout"}>
        {canEdit && (
          <aside className="bd-side surface surface-raised" data-open={sideOpen} aria-label="Add to the schedule">
            <button
              type="button"
              className="bd-side__toggle"
              aria-expanded={sideOpen}
              aria-controls="bd-side-body"
              onClick={() => setSideOpen((o) => !o)}
            >
              <span className="font-title">Add from…</span>
              <span className="font-serif text-[12px] text-ink-soft">{sideOpen ? "Hide" : "Show"}</span>
            </button>
            <div id="bd-side-body" className="bd-side__body">
              <p className="bd-side__hint">Drag onto a day, or press Add{activeDay ? ` (goes on ${weekdayOf(activeDay)})` : ""}.</p>
              <SourceGroup title="Custom">
                <SourceCard
                  title="Blank item"
                  subtitle="Anything, e.g. Boys' cycle, 8am"
                  image={null}
                  onAdd={() => addFrom(null)}
                  onDragStart={() => {
                    drag.current = { type: "source", kind: "custom", id: "blank" };
                  }}
                  onDragEnd={() => {
                    drag.current = null;
                    setDropDay(null);
                  }}
                />
              </SourceGroup>
              <SourceGroup title="Chosen" empty="No chosen options yet.">
                {chosen.map((s) => (
                  <SourceCard
                    key={s.id}
                    title={s.title}
                    subtitle={s.subtitle}
                    image={s.image}
                    onAdd={() => addFrom(s)}
                    onDragStart={() => {
                      drag.current = { type: "source", kind: "option", id: s.id };
                    }}
                    onDragEnd={() => {
                      drag.current = null;
                      setDropDay(null);
                    }}
                  />
                ))}
              </SourceGroup>
              <SourceGroup title="Ideas" empty="No ideas yet.">
                {ideas.map((s) => (
                  <SourceCard
                    key={s.id}
                    title={s.title}
                    subtitle={null}
                    image={s.image}
                    onAdd={() => addFrom(s)}
                    onDragStart={() => {
                      drag.current = { type: "source", kind: "idea", id: s.id };
                    }}
                    onDragEnd={() => {
                      drag.current = null;
                      setDropDay(null);
                    }}
                  />
                ))}
              </SourceGroup>
            </div>
          </aside>
        )}

        <div className="bd-main">
          <div className="bd-tabs" role="group" aria-label="Choose a day">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                className="bd-tab"
                aria-pressed={day === activeDay}
                onClick={() => setSelectedDay(day)}
              >
                <span className="bd-tab__wd">{weekdayOf(day)}</span>
                <span className="bd-tab__dt">{shortDate(day)}</span>
              </button>
            ))}
          </div>

          <div className="bd-cols" style={{ ["--bd-days" as string]: days.length }}>
            {columns}
          </div>

          {byDay.outside.length > 0 && (
            <section className="surface surface-sunken mt-6 p-4" aria-label="Outside the chosen days">
              <h2 className="section-head">
                <span className="section-head__title">Outside the chosen days</span>
                <span className="section-head__rule" />
              </h2>
              <p className="mb-3 font-reading text-[13px] text-ink-soft">
                These are on days that are no longer in the schedule. Move them to a day, or delete them.
              </p>
              <ul className="bd-outside">
                {byDay.outside.map((item) => (
                  <li key={item.id}>
                    <p className="bd-outside__day">{longDate(item.day)}</p>
                    <ItemCard
                      item={item}
                      canEdit={canEdit}
                      clash={false}
                      index={0}
                      onEdit={() => {
                        setNotice(null);
                        setDraft(editDraft(item));
                      }}
                      onDragStart={() => {
                        drag.current = { type: "item", id: item.id };
                      }}
                      onDragEnd={() => {
                        drag.current = null;
                        setDropDay(null);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {canEdit && (
        <ItemDialog
          draft={draft}
          days={days}
          onClose={() => setDraft(null)}
          onSaved={() => setDraft(null)}
        />
      )}
    </div>
  );
}

function ItemCard({
  item,
  canEdit,
  clash,
  index,
  onEdit,
  onDragStart,
  onDragEnd,
}: {
  item: BigDayItem;
  canEdit: boolean;
  clash: boolean;
  index: number;
  onEdit: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <article
      className="bd-card rise"
      data-colour={item.colour}
      style={{ ["--i" as string]: Math.min(index, 7) }}
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <div className="bd-card__top">
        <p className="bd-card__time">
          <Clock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          {timeLabel(item)}
        </p>
        {canEdit && <GripVertical className="bd-card__grip h-4 w-4" aria-hidden="true" />}
      </div>
      <div className="bd-card__body">
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={toDriveImageUrl(item.image)} alt="" className="bd-card__thumb" loading="lazy" />
        )}
        <div className="min-w-0">
          <h3 className="bd-card__title font-title">{item.title}</h3>
          <p className="bd-card__colour">Colour: {COLOUR_LABELS[item.colour]}</p>
        </div>
      </div>
      {item.notes && <p className="bd-card__notes">{item.notes}</p>}
      {item.cost && (
        <CostRange
          predictedMin={item.cost.min}
          predictedMax={item.cost.max}
          actual={item.cost.actual}
          currency={item.cost.currency}
          className="bd-card__cost"
        />
      )}
      {clash && (
        <p className="bd-card__clash" role="note">
          Overlaps another item on this day
        </p>
      )}
      <div className="bd-card__foot">
        {item.visibleToGuests ? (
          <span className="chip chip-sec">
            <Eye className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            Guests can see this
          </span>
        ) : (
          <span />
        )}
        {canEdit && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={onEdit} aria-label={`Edit ${item.title}`}>
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Edit
          </button>
        )}
      </div>
    </article>
  );
}

function SourceGroup({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="bd-src">
      <h3 className="bd-src__title">{title}</h3>
      {hasChildren ? <ul className="bd-src__list">{children}</ul> : <p className="bd-src__empty">{empty}</p>}
    </div>
  );
}

function SourceCard({
  title,
  subtitle,
  image,
  onAdd,
  onDragStart,
  onDragEnd,
}: {
  title: string;
  subtitle: string | null;
  image: string | null;
  onAdd: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <li
      className="bd-srccard"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", title);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={toDriveImageUrl(image)} alt="" className="bd-srccard__thumb" loading="lazy" />
      ) : (
        <span className="bd-srccard__thumb bd-srccard__thumb--blank" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        <span className="bd-srccard__title">{title}</span>
        {subtitle && <span className="bd-srccard__sub">{subtitle}</span>}
      </span>
      <button type="button" className="btn btn-sec btn-sm bd-srccard__add" onClick={onAdd} aria-label={`Add ${title}`}>
        Add
      </button>
    </li>
  );
}

function DatesForm({ settings }: { settings: BigDaySettings }) {
  const [start, setStart] = useState(settings.startDate ?? "");
  const [end, setEnd] = useState(settings.endDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    if (!start || !end) return setError("Choose a first and last day.");
    if (daysBetween(start, end) < 0) return setError("The last day can't be before the first day.");
    if (daysBetween(start, end) > MAX_SPAN_DAYS - 1) return setError(`Choose at most ${MAX_SPAN_DAYS} days.`);
    setError(null);
    startTransition(async () => {
      const res = await saveBigDayDates(start, end);
      setError(res.error);
      setSaved(!res.error);
    });
  }

  return (
    <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label>
        <span className="field-label">First day</span>
        <input type="date" className="field" value={start} onChange={(e) => setStart(e.target.value)} required />
      </label>
      <label>
        <span className="field-label">Last day</span>
        <input type="date" className="field" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} required />
      </label>
      <button type="submit" className="btn btn-sec" disabled={pending}>
        {pending ? "Saving…" : "Save days"}
      </button>
      {error && (
        <p className="font-serif text-[13px] text-alert sm:col-span-3" role="alert">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="font-serif text-[13px] text-ink-soft sm:col-span-3" role="status">
          Saved.
        </p>
      )}
    </form>
  );
}

function SettingsStrip({ settings, isCouple }: { settings: BigDaySettings; isCouple: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(settings.published, (_c, next: boolean) => next);

  return (
    <section className="surface p-4 sm:p-5" aria-label="Schedule settings">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 lg:max-w-xl">
          <h2 className="font-title text-[20px] tracking-tight">Days</h2>
          <DatesForm settings={settings} />
        </div>
        <div className="lg:max-w-sm">
          <h2 className="font-title text-[20px] tracking-tight">Guests</h2>
          {isCouple ? (
            <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--sec)]"
                checked={optimistic}
                disabled={pending}
                onChange={(e) => {
                  const next = e.target.checked;
                  setError(null);
                  startTransition(async () => {
                    setOptimistic(next);
                    const res = await setBigDayPublished(next);
                    if (res.error) setError(res.error);
                  });
                }}
              />
              <span className="font-serif text-[14px] text-ink">Publish to guests</span>
            </label>
          ) : (
            <p className="mt-3 font-serif text-[14px] text-ink">
              {settings.published ? "Published to guests." : "Not published to guests. The couple decide when."}
            </p>
          )}
          <p className="mt-1 font-reading text-[13px] text-ink-soft">
            Guests will only see the items ticked &ldquo;Guests can see this&rdquo;. The guest page comes later, so guests can&apos;t open it yet and this switch is harmless for now.
          </p>
          {error && (
            <p className="mt-2 font-serif text-[13px] text-alert" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function ItemDialog({
  draft,
  days,
  onClose,
  onSaved,
}: {
  draft: Draft | null;
  days: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<Draft | null>(draft);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setForm(draft);
    setError(null);
    setConfirmDelete(false);
    const dialog = ref.current;
    if (!dialog) return;
    if (draft && !dialog.open) dialog.showModal();
    if (!draft && dialog.open) dialog.close();
  }, [draft]);

  const dayOptions = form && !days.includes(form.day) ? [form.day, ...days] : days;

  function patch(p: Partial<Draft>) {
    setForm((f) => (f ? { ...f, ...p } : f));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    startTransition(async () => {
      const res = await saveBigDayItem({
        id: form.id,
        title: form.title,
        notes: form.notes.trim() ? form.notes : null,
        day: form.day,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        colour: form.colour,
        visibleToGuests: form.visible,
        pageOptionId: form.pageOptionId,
        ideaId: form.ideaId,
      });
      if (res.error) setError(res.error);
      else onSaved();
    });
  }

  function remove() {
    if (!form?.id) return onClose();
    const id = form.id;
    startTransition(async () => {
      const res = await deleteBigDayItem(id);
      if (res.error) setError(res.error);
      else onSaved();
    });
  }

  return (
    <dialog ref={ref} className="bd-dialog" onClose={onClose} aria-labelledby="bd-dialog-title">
      {form && (
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <h2 id="bd-dialog-title" className="font-title text-[22px] tracking-tight sm:col-span-2">
            {form.id ? "Edit item" : "Add item"}
          </h2>
          <label className="sm:col-span-2">
            <span className="field-label">Title</span>
            <input
              className="field"
              value={form.title}
              maxLength={160}
              required
              onChange={(e) => patch({ title: e.target.value })}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">Day</span>
            <select className="field" value={form.day} onChange={(e) => patch({ day: e.target.value })}>
              {dayOptions.map((d) => (
                <option key={d} value={d}>
                  {longDate(d)}
                  {days.includes(d) ? "" : " (outside the chosen days)"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Start time (optional)</span>
            <input type="time" step={900} className="field" value={form.startTime} onChange={(e) => patch({ startTime: e.target.value })} />
          </label>
          <label>
            <span className="field-label">End time (optional)</span>
            <input type="time" step={900} className="field" value={form.endTime} onChange={(e) => patch({ endTime: e.target.value })} />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="field-label">Colour</legend>
            <div className="bd-swatches">
              {BIG_DAY_COLOURS.map((c) => (
                <label key={c} className="bd-swatch" data-colour={c}>
                  <input
                    type="radio"
                    name="bd-colour"
                    value={c}
                    checked={form.colour === c}
                    onChange={() => patch({ colour: c })}
                  />
                  <span className="bd-swatch__box">
                    <span className="bd-swatch__dot" aria-hidden="true" />
                    {COLOUR_LABELS[c]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="sm:col-span-2">
            <span className="field-label">Notes</span>
            <textarea className="field" rows={3} maxLength={4000} value={form.notes} onChange={(e) => patch({ notes: e.target.value })} />
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--sec)]"
              checked={form.visible}
              onChange={(e) => patch({ visible: e.target.checked })}
            />
            <span className="font-serif text-[14px] text-ink">Guests can see this</span>
          </label>
          {error && (
            <p className="font-serif text-[13px] text-alert sm:col-span-2" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn btn-quiet" onClick={onClose} disabled={pending}>
              Cancel
            </button>
            {form.id && (
              <span className="ml-auto flex items-center gap-2">
                {confirmDelete ? (
                  <>
                    <button type="button" className="btn btn-danger" onClick={remove} disabled={pending}>
                      Yes, delete
                    </button>
                    <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>
                      Keep it
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)} disabled={pending}>
                    Delete
                  </button>
                )}
              </span>
            )}
          </div>
        </form>
      )}
    </dialog>
  );
}
