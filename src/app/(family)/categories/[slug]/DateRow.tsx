"use client";

import { EditableRow } from "@/components/EditableRow";
import { deleteCategoryDate } from "../actions";
import { DateForm } from "./DateForm";

type DiaryEntry = { id: string; title: string; entry_date: string };

// diary_entries (category-sourced): couple manages, family reads. A
// page_option-sourced entry from markOptionWinner is keyed on
// (category_page_id, source) independently of these rows, so editing or
// deleting a manually-added entry here is safe.
export function DateRow({
  entry,
  categoryPageId,
  isCouple,
}: {
  entry: DiaryEntry;
  categoryPageId: string;
  isCouple: boolean;
}) {
  return (
    <EditableRow
      item={entry}
      isCouple={isCouple}
      onDelete={deleteCategoryDate}
      renderView={(d) => (
        <span className="font-reading text-[13px] text-ink">
          {d.entry_date} — {d.title}
        </span>
      )}
      renderForm={({ item, onCancel, onSaved }) => (
        <li className="rounded-[8px] border border-ink/8 bg-cream/50 px-3 py-2">
          <DateForm
            categoryPageId={categoryPageId}
            entry={item}
            onCancel={onCancel}
            onSaved={onSaved}
          />
        </li>
      )}
    />
  );
}
