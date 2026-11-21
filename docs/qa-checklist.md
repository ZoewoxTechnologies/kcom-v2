# QA checklist

Run this on staging before launch. Tick each box, note the browser or device and the date, and log every failure as its own bug ticket. Launch needs no open blocker or major bugs.

**Severity.** Blocker: a core flow is broken or content is lost. Major: a feature fails in one supported browser or device. Minor: cosmetic or workaround exists.

## Setup

- [ ] Staging site, API and admin are deployed from the same commit; note the commit.
- [ ] An editor account and an admin account exist. Use the editor for content tests.
- [ ] A mailbox you can read is available for subscribe and contact tests.
- [ ] Staging is configured to rebuild the site on publish (see `docs/deploy.md`).

## Test matrix

Run sections 1 to 5 on the public site in every row. Use the current stable release of each.

| Row | Platform |
| --- | --- |
| Chrome | Desktop |
| Safari | macOS |
| Firefox | Desktop |
| Edge | Desktop |
| Safari | iPhone (iOS) |
| Chrome | Android phone |

Admin (section 6): Chrome or Safari on desktop, and a tablet in portrait and landscape.

## 1. Public pages

For each row of the matrix:

- [ ] Home loads with no console errors; Today's Capsule is first, and every homepage section the editors enabled shows, in the set order.
- [ ] Capsules index, a capsule page, Today's Capsule and a month archive load; previous and next links work.
- [ ] Series index and a series page load.
- [ ] Blog index and a post load; cover image and body render.
- [ ] Events index and an event page load; upcoming and past are correct.
- [ ] Books, About, Team, Partner and Privacy pages load.
- [ ] An unknown address shows the 404 page with search.
- [ ] Navigation, footer links and the skip link work by keyboard; focus is always visible.
- [ ] Images load at a sensible size and never overflow the screen.
- [ ] Text is at least 16px and readable with no horizontal scrolling.
- [ ] RSS (`/rss.xml`), sitemap and robots load.
- [ ] Sharing a capsule link shows the right title, description and image.

## 2. Search

- [ ] Search finds a known capsule, post and event by title and by body text.
- [ ] Typing searches after a short pause; there is no submit button.
- [ ] No results shows a clear message; special characters do not break it.
- [ ] The 404 page search works.
- [ ] Results are usable on a phone.

## 3. Email signup

- [ ] Subscribe with a valid address; the check-your-inbox page shows.
- [ ] The confirmation email arrives, from the right sender, and renders in Gmail, Apple Mail and Outlook.
- [ ] The confirm link opens the confirmed page; a second use or an old link shows the expired page.
- [ ] Subscribing twice with the same address is handled gracefully.
- [ ] An invalid address shows an inline error; the form can be fixed and resubmitted.
- [ ] The unsubscribe link in an email opens the unsubscribed page and stops mail.
- [ ] The subscriber appears in Subscribers in admin with the right status.

## 4. Contact form

- [ ] Send a message with valid details; a success state shows.
- [ ] The message appears in the admin Inbox.
- [ ] Empty and invalid fields show clear errors; entered text is kept.
- [ ] Bot protection does not block a real person on any matrix row.
- [ ] Rapid repeat submissions are limited without losing the first message.

## 5. Capsule flow end to end

Do this once on desktop, then check the result on a phone.

- [ ] As an editor, create a capsule, save a draft, and confirm it is not on the public site.
- [ ] Schedule it for a time a few minutes ahead; it shows as Scheduled in the list and calendar.
- [ ] At that time it becomes Published without any action.
- [ ] The site rebuilds and the capsule appears on its page, the capsules index, Today's Capsule (when it is today's), the month archive, RSS and sitemap.
- [ ] The subscriber email for the capsule arrives once, with the right content and links.
- [ ] Repeat with the default time (next midnight, Lagos): check the date shown is the Lagos date.
- [ ] Publish now works and follows the same path.
- [ ] Unpublish removes it from the site after the next rebuild.
- [ ] Unscheduling returns it to Draft.

## 6. Admin app

On desktop and on a tablet in both orientations:

- [ ] Sign in, sign out, and a wrong password shows a clear error.
- [ ] An editor sees no Users or Settings; an admin sees both.
- [ ] Capsules: create, edit, filter, sort and search the list; calendar view works.
- [ ] Blog, Events, Books, Pages and Homepage: create, edit, reorder where offered, and publish.
- [ ] Rich text toolbar works, including links and image upload.
- [ ] Leaving an edited page shows the discard prompt; Keep editing and Discard both work.
- [ ] Content search finds items and opens them.
- [ ] Inbox and Subscribers load and update.
- [ ] Buttons and controls are large enough to tap on a tablet; nothing is clipped.
- [ ] Reduced-motion setting turns off animations.

## 7. Themes

Check the public site and the admin app in light and dark, using the system setting and any manual toggle:

- [ ] Every page in sections 1 and 6 has readable text and contrast in both themes.
- [ ] Images, logos and icons look right on both backgrounds.
- [ ] Forms, focus rings, toasts and prompts are visible in both themes.
- [ ] Switching theme while on a page does not break layout or flash the wrong colours.

## 8. Wrap-up

- [ ] Every failure has a bug ticket with steps, browser or device, and severity.
- [ ] No blocker or major bug is open.
- [ ] Results (date, commit, tester) are recorded with this checklist.
