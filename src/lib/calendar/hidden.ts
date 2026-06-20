// Hide-key matching for calendar preferences. A hidden key suppresses an event
// when it equals the event id or is a parent prefix: item key "bill:<id>" hides
// "bill:<id>:<date>", and "inv:AAPL" hides all "inv:AAPL:earnings:…" without
// touching "inv:AAPLX:…".

export function isHidden(eventId: string, hiddenKeys: string[]): boolean {
  return hiddenKeys.some((k) => eventId === k || eventId.startsWith(`${k}:`));
}
