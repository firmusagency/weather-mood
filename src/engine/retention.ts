/*
 * How long guest data lives. One place, because three things must agree: what the scripts and the database
 * actually do, what the privacy note tells the guest (src/guest/privacy.ts), and the tests that hold the two together.
 */
export const RETENTION = {
  /** Notifications stop when the browser has shown no sign of life (subscribed, or opened the page) for this long. */
  pushIdleDays: 10,
  /** The last messages before that say so and invite the guest to open the page. */
  pushNoticeDays: 2,
  /** Page opens are deleted from the database after this many days (supabase/migrations/0007_visits_retention.sql). */
  visitDays: 90,
};
