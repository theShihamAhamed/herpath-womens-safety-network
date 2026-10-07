# HerPath Safety Updates Planning

Safety Updates is important supporting information, but it is not a permanent bottom-navigation destination.

## Entry and route

```text
Map header → notification bell → /alerts
```

The bell may gain an unread indicator later. The shared UX foundation implements the nested route and empty-state shell; local journey deviation/fallback-channel alerts are implemented by the journey feature, while remote push delivery remains deferred.

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

Future notification preferences belong under Profile. Remote notification delivery and preference backends are outside this assessed scope. Alerts are a shared supporting concern; changes that affect owned features require coordination with those owners.
