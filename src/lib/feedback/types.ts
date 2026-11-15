// Client-safe types for votes and comments (see 0037_reactions_and_comments
// .sql and docs/plans/step8-feedback-ui.md).

export type FeedbackTargetType = "page_option" | "idea" | "task";

export type FeedbackComment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  mine: boolean;
};

export type FeedbackData = {
  up: number;
  down: number;
  // The viewer's own vote: 1, -1, or 0 for none.
  myVote: 1 | -1 | 0;
  upNames: string[];
  downNames: string[];
  comments: FeedbackComment[];
};

export const EMPTY_FEEDBACK: FeedbackData = {
  up: 0,
  down: 0,
  myVote: 0,
  upNames: [],
  downNames: [],
  comments: [],
};
