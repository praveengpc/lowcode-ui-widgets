# lowcode-ui-widgets
Self-contained, framework-free UI widgets you can drop into any app built for low-code platforms like OutSystems, distributed via CDN, no build step required.

## Usage

1. Load this file's raw or jsDelivr URL via OutSystems required Scripts.
2. Drop `<dashboard-widget></dashboard-widget>` into an HTML widget on the screen.

## INSTRUCTION

## Updating a widget and releasing a new version

1. Edit the widget's `.js` file in this repo and commit the change.
2. **If you're updating an existing widget that's already in use somewhere**,
   keep its custom element tag name exactly the same — the host page already
   has that tag typed into it and won't be updated to match a new name.
3. Go to this repo's **Releases** page → **"Create a new release."**
4. Type a new tag (e.g. `v2.0.0` — use proper `vX.Y.Z` semver formatting, not
   a bare `v2`, so version resolution stays reliable).
5. Give it a short title and a one- or two-line description of what changed.
6. Make sure **"Set as the latest release"** is checked, then click
   **"Publish release."**
7. Open the widget's `@latest` CDN URL in a **private/incognito browser
   window** and confirm your change actually shows up.
8. **If it still shows the old version**, that's almost always the CDN's own
   cache, not a mistake on your end — go to the
   [jsDelivr purge tool](https://www.jsdelivr.com/tools/purge), paste in the
   exact `@latest` URL, and submit it to force a refresh. Then recheck step 7.
9. Only once you've confirmed the change in a browser should you consider it
   safe to rely on in OutSystems or anywhere else consuming the CDN URL.

## PROMPT INSTRUCTION

## Generating a new widget or updating one with Claude

To get consistent results, use one of these prompts:

**Starting from a design image:**
> Here's a UI design [attach image]. Build a simple single-page React app
> matching it, then give me three things: a live preview, the full React
> source code, and a Web Component version of the same UI — a single
> self-contained `.js` file, a class extending `HTMLElement` with its own
> Shadow DOM, no page wrapper, no extra page-title header — same shape as
> the other widgets in this repo. Suggest a tag name for it.

**Starting from existing React code:**
> Here's React code for a UI [paste code]. Convert it directly into a Web
> Component version — same shape as the other widgets in this repo: a
> single self-contained `.js` file, `HTMLElement` + Shadow DOM,
> `connectedCallback` rendering, no page wrapper. Suggest a tag name for it.

**Updating an existing widget already in this repo:**
> Here's the current code for `<paste the widget's .js file>`. I want to
> change: `<describe the change>`. Keep the tag name exactly as
> `<existing-tag-name>` since it's already placed in a live screen.

After Claude gives you the file, follow the "Updating a widget and releasing
a new version" steps above to actually publish it.

## Versioning

Each release is tagged using semver (`v1.0.0`, `v2.0.0`, ...). Point
production usage at `@latest` for zero-touch updates once a release is
published, or pin to a specific tag (`@v1.0.0`) if you want changes to
require a deliberate version bump before they go live. Avoid pointing
production at `@main` — its cache is short and unpredictable, and it isn't
a stable release point.
