// An event is "past" once its day (UK time) is over, so on the day itself
// people can still change their answer.
const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);

export function isEventPast(startsAt: string | null, now = new Date()) {
  if (!startsAt) return false;
  return day(new Date(startsAt)) < day(now);
}
