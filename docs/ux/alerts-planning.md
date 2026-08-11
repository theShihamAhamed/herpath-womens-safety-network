# HerPath Safety Updates Planning

Safety Updates is important supporting information, but it is not a permanent bottom-navigation destination.

## Entry and route

```text
Map header → notification bell → /alerts
```

The bell may gain an unread indicator later. The shared UX foundation implements only the nested route and empty-state shell.

## Future categories

- Nearby safety information
- Route-information changes
- Journey reminders and check-ins
- Incident/report status changes
- Genuine account or session notices

Future items should contain a title, short context, timestamp, read/unread state, and optional deep link. Notification text must not expose private coordinates or identifying information.

## Priority

Do not mark every update urgent. Distinguish informational, important, and genuinely time-sensitive updates. Only genuinely urgent circumstances should use high-interruption behavior.

## Empty state

**No new safety updates.**

## Preferences and ownership

Future notification preferences belong under Profile. Notification delivery and preference backends are outside this foundation PR. Alerts are a shared supporting concern; changes that affect owned features require coordination with those owners.
