# Promoting WOW, and measuring what works

PostHog records where every visitor came from: the referring site, and the UTM tags on the
link they clicked. It keeps that first touch on the person, and links it to their account when they
sign up. So the rule is simple: **every link you post gets UTM tags.** Then PostHog can tell you
which posts bring teams, not just clicks.

## Tagging links

Add three tags to any link you share. Keep them lowercase, with hyphens.

| Tag            | What it says            | Use these                                                                                           |
| -------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| `utm_source`   | Where the link lives    | `reddit`, `discord`, `slack`, `bluesky`, `mastodon`, `email`, `hunt-site`, `qr`                     |
| `utm_medium`   | What kind of place      | `community` (forums, Discord servers), `social`, `email`, `referral` (another site's page), `print` |
| `utm_campaign` | Why you posted it       | `mystery-hunt-2027`, `puzzle-exchange-2026-12`, `demo-video`, `captain-outreach`                    |
| `utm_content`  | Optional: which version | `video`, `screenshot`, `thread-reply`                                                               |

Examples:

```
https://www.wafflehaus.io/?utm_source=reddit&utm_medium=community&utm_campaign=mystery-hunt-2027&utm_content=video
https://www.wafflehaus.io/exchange?utm_source=discord&utm_medium=community&utm_campaign=puzzle-exchange-2026-12
https://www.wafflehaus.io/docs/start/captain?utm_source=email&utm_medium=email&utm_campaign=captain-outreach
```

Always link to `www.wafflehaus.io`. Invitation links (`join.wafflehaus.io/<id>`) keep their tags
through the redirect, but they're for teams, so don't tag them.

## The events that matter

| Event               | Means                                                     |
| ------------------- | --------------------------------------------------------- |
| `$pageview`         | A visit (the first one carries the UTM tags and referrer) |
| `user_signed_up`    | A new account                                             |
| `workspace_created` | A team set up for a hunt: the best sign of a new team     |
| `workspace_joined`  | Someone joined a team; how far each team spreads WOW      |
| `puzzle_solved`     | The team actually used it                                 |
| `recap_image_saved` | A team took its recap card away to share                  |

Events are grouped by workspace, so you can count teams as well as people.

## Insights to build once in PostHog

1. **Where visitors come from.** Trends → `$pageview`, unique users, weekly. Break down by the
   person property _Initial UTM source_, then again by _Initial referring domain_ (posts without
   tags still show up there).
2. **What turns into teams.** Funnel → `$pageview` → `user_signed_up` → `workspace_created`,
   30-day window, breakdown _Initial UTM source_ (and _Initial UTM campaign_), attribution
   _first touchpoint_. This is the one to judge a channel by.
3. **Teams that actually play.** Funnel → `workspace_created` → `puzzle_solved`, aggregated by
   _Workspaces_ (the group), so one keen captain doesn't count as ten teams.
4. **Word of mouth.** Trends → `workspace_joined`, aggregated by _Workspaces_: average joins per
   team. Plus `recap_image_saved` per week after big hunts.
5. **What pulls people in.** Trends → `$pageview` where the path starts with `/exchange` (the
   Puzzle Exchange) or `/docs`, broken down by _Initial UTM source_.

Put them on one dashboard and look at it the week after each post and each hunt.

## How the tracking is set up

- **Ad blockers:** the browser sends events to `e.wafflehaus.io`, PostHog's managed reverse proxy
  (a CNAME in Cloudflare DNS, set up in PostHog's organization settings). PostHog's own hosts are
  on common block lists, and puzzle hunters run blockers, so numbers before this change undercount.
  The proxy doesn't touch the Worker, so it adds nothing to the Worker request count.
- **Accounts:** the browser links the visitor to their account on any page once they're signed in
  (`src/components/posthog-identity.tsx`), and forgets it on sign-out.
- **Development:** the dev server doesn't send anything (the server skips dev too), so your
  numbers are real visitors only. To watch events locally, run `posthog.opt_in_capturing()` in the
  browser console.
- **Session replay** is on, with passwords masked: watching a few first visits from a new channel
  shows what people look at before they leave.
