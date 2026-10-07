# Journey frontend boundary

The journey feature owns consent, foreground location permission, start/stop watcher lifecycle, active tracking, arrival/outcome UI, history, and analytics under the component ownership plan. The current implementation is verified on a physical Android device for start, live tracking, finish, cancel, deviation alerts, privacy cleanup, history, and analytics. The backend contract is exposed through the `/api/v1/journeys/*` endpoints; cross-feature route handoff and shared API/session files remain integration surfaces.

Journey start must follow: consent/route → foreground permission → backend start → synchronously store the returned journey ID → start the watcher. No active backend journey should remain when permission is denied.
