# Design notes

The information architecture follows the public VoSKILL site at https://voskill.com, measured on October 25, 2026. Pages fetched: the homepage, `/the-shop`, `/about`, `/group-events`, `/diy-shop`, `/skills-lab`, `/participation-agreement-waiver`, and two shop-class product pages. Styles came from the live Squarespace `site.css` (the `--heading-*` and `--primary-button-*` custom properties).

Bench & Trade does not use VoSKILL's logo, slogans, photos, or colors. Headings are not set in Archivo Black and are not capitalized. Body text is not Inter.

## What VoSKILL actually does

Layout:

- Content max width is 1400px (`--maxPageWidth`).
- Desktop page padding is 4vw. The mobile gutter is 6vw.
- The header is fixed, not transparent. The logo image is 63px tall on desktop and much smaller on a phone.
- The page grid is an 8-column fluid engine on a phone and 24 columns on a desktop, with 11px gaps.
- Motion is effectively off (animation duration 0.1s).
- Photos are sharp-cornered, often full-bleed or in a 3:2 grid, with `object-fit: cover`.

Type, from the stylesheet:

- Base size sits under a 17px root. Headings use Archivo Black, weight 400, letter-spacing -0.02em, line-height 1.2em, `text-transform: capitalize`.
- Heading sizes: H1 4.5rem, H2 3.3rem, H3 2.3rem, H4 1.6rem.
- Body is Inter 400. Normal text is 1.05rem with line-height 1.55em. Large text (quotes) is 1.25rem. Small text is 0.9rem. Meta is 0.8rem.
- On a phone, heading size scales with the viewport. On a desktop it is capped against the 1400px page width.

Controls and forms:

- Buttons are square. Primary and secondary buttons are Inter, 0.9rem, weight 700, letter-spacing 0.06em, uppercase, padding 1.5rem 2.2rem.
- The primary button is near-black (`hsl(0, 0%, 10.98%)`) with white text. A second color, named `--white-hsl` in their file, is a red-orange (`hsl(10.57, 70.97%, 51.37%)`). Accent gray is `hsl(0, 0%, 86.27%)`. We do not use those colors.
- Fields have a 2px border, padding 8px 15px, and 20px under each field. Checkboxes are about 20px with an 11px gap to the label.

Page structure:

- The header is one "Menu" folder, not a row of links: Shop Classes, Teach Shop, Workshops, DIY Shop, Academy, Skills Lab, About.
- The homepage opens with a full-bleed photo and a short centered slogan, then a short belief paragraph, then a text list of ways to start (not icon cards), then quotes, then a footer with the address, a contact per program, and hours.
- `/the-shop` explains how a class runs as numbered steps, what to wear, and a few questions.
- A class product page has a collection label, a title that is often the schedule, one photo, the price, a short description, a program-details list, and one button.
- The footer carries the address and the practical contacts. There is no tracker script in the pages we used as reference for structure.

## How that maps here

| VoSKILL | Bench & Trade |
| --- | --- |
| Menu folder in a fixed header | One Menu button, sticky header, links to home, the Saturday class, sign-up, the waiver, and contact |
| Homepage photo, slogan, then pathways | Dark poster with a line drawing, then a ruled list of where to start |
| How a class runs, numbered | Four numbered steps on the home page |
| Class product page: photo, price, details, one button | Sawdust & Slice page: photo well, price, spots left, details, schedule, sponsor, sign-up |
| Quote band | Omitted. There are no testimonials yet, and none are invented |
| Footer with address and contacts | Olive footer: the class, contact, and the pilot facts |
| Waiver as its own page | `/waiver`, marked placeholder, `noindex` |

The home page does not use a row of icon cards or a gradient band. The sign-up form is one left-aligned column, max 40rem, the same field spacing scale as their forms (20px under a field, 2px borders, 8px 15px padding).

## Our own identity

Canvas `#f3eee6`, paper `#f7f4ee`, ink `#1c1914`, softened ink `#4e463c`, rule `#d4cbbd`. Buttons and links use oxide `#6e3428`, darker `#54261d` on hover. The footer is olive `#3a4634`. Brass `#c4a574` is only the small kicker on the dark poster. The poster itself is `#241c16`.

Headings are Zilla Slab 600 and 700, sentence case, letter-spacing -0.02em. Body, buttons, and the menu are Source Sans 3. Both families are self-hosted with `@fontsource`. Buttons stay square, 0.9rem, weight 700, uppercase, letter-spacing 0.06em.

The header is sticky rather than fixed, so the first line of the page is not hidden under it. The wordmark is type, about 1.05rem on a phone and 1.7rem on a desktop, instead of a 63px logo image.

Spacing uses the same idea as their page padding: `4vw` inside a 1400px wrap, `6vw` under 768px. Sections are separated with a hairline, not cards.

## Components

- `site-header` / `site-footer`: the menu and the practical footer.
- `photo-well`: a sharp 3:2 (or poster) frame with a line drawing and the caption "Photo needed: …". No stock photos.
- `shop-mark`: the bench, peel, and drill drawing.
- `spots-count`: live seats left, or a waitlist line when the class is full.
- `sponsor`: a ruled block, the Casanova wordmark, one sentence on who is hosting, and the official site in a new tab.
- `signup-form`: parent, kids, topping, emergency contact, waiver, allergens, photo release, how they heard about the class.
- Admin roster: one article per family, status, allergies, photo consent, CSV link.

## Images

Until real class photos exist, the wells stay labeled placeholders. Open Graph images are generated posters (dark on the home page, paper on the class page), not photographs.

The sponsor image is the horizontal "casanova PIZZERIA" wordmark from https://www.casanovapizzeria.com/ (`2a5563_2caf245ed9714688bf8d508ee75759ea~mv2.png`), resized and saved at `public/sponsors/casanova-pizzeria.jpg`. The header of that site is text plus social icons, not this file. The file is a logo image on the site, so the sponsor block uses it. Alt text is "Casanova Pizzeria".
