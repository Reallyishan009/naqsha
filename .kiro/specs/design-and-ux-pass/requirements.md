# Requirements Document

## Introduction

The App works, but it looks plain and a first-time visitor cannot tell what it is for. This design and UX pass makes the App look like the weaver's own materials (manila card stock, graph paper, silk, zari thread) and makes the first screen self-explanatory. The goal is that a first-time visitor understands what Naqsha is, and which control to press, within five seconds of the first screen appearing. Judges score Quality and Design, and the demo video is filmed on this interface.

The pass follows `docs/DESIGN_BRIEF.md` and is built in four stages on the branch `auto/build`:

- **Stage A, Foundation:** self-hosted fonts, complete tokens, the Night loom switch, shared base styles and the signature details.
- **Stage B, Understanding:** the Landing, navigation, progressive disclosure, and friendly empty, loading and error states.
- **Stage C, Illustrations:** the card drawing, the hero loom and small icons, all drawn inline as SVG.
- **Stage D, Small fixes:** version chooser labels, singular pick counts, the finished cloth on return to Weave, a steadier benchmark, one design document correction and the loom-mcp screenshots.

Scope notes:

- All styling stays in CSS Modules with the tokens in `src/ui/theme/tokens.css`. No CSS framework and no new runtime dependency is added (tech.md).
- Hindi is first and English is second. Hindi text added by this pass is marked unreviewed, as in the existing `hi` Translation_File.
- Existing translation keys keep their names. Existing accessible names, roles, data attributes and test ids that tests or `check:browser` use stay as they are (Requirement 22).
- The Card_Profile values are ILLUSTRATIVE and UNVERIFIED (card-geometry.md). No drawing, layout or style in this pass hard-codes a card dimension, hole count, pitch or hole position. Every such value comes from the Card_Profile.
- The existing specs `app`, `simulator`, `cards-as-code`, `repair-suggestions`, `version-history` and `loom-mcp` keep their requirements. This spec changes how the App looks and reads, and fixes the four defects listed in Stage D.
- This pass adds no property-based test. The testing steering rule on properties covers `src/codec`, `src/reader`, `src/simulator` and `src/exporter`, and this pass adds no function to those modules. Stage D adds example tests only.
- A second pass for per-screen polish and motion follows this one. Motion in this pass is limited to what Requirement 13 and Requirement 7 name.

## Glossary

- **App**: The Naqsha browser application in `src/ui`, built with Vite and React.
- **Screen**: One of Weave, Keep, Scan or Code view.
- **Weave_Screen**, **Keep_Screen**, **Scan_Screen**, **Code_View_Screen**: The four Screens, as defined in the `app`, `cards-as-code` and `version-history` specs.
- **Shell**: The part of the App around the Screens: the header with the selvedge, navigation, language switch, theme switch, banners and the live region.
- **Current_Pattern**: The Pattern held in App memory that Weave plays and Keep saves and exports.
- **Card_Profile**: The CardProfile loaded at runtime from `public/profiles/demo-12x16.json`.
- **Sample_Design**: A built-in naksha generated from the Card_Profile. Three exist: diamond, border and floral.
- **Landing**: The Weave_Screen while the Current_Pattern has no pick.
- **Step_Strip**: The row of three steps on the Landing: "Scan a card", "Watch it weave" and "Keep the design".
- **Sample_Tile**: One large clickable tile on the Landing for one Sample_Design, holding its name, a Cloth_Preview and the "Try it" label.
- **Cloth_Preview**: A small picture of the cloth of one Sample_Design, rendered from that Sample_Design's own Pattern by the simulator.
- **Token_File**: `src/ui/theme/tokens.css`, which holds every colour, type, spacing, radius, shadow and motion token.
- **Contrast_Table**: `THEME_TOKENS` and `TOKEN_PAIRS` in `src/ui/theme/contrast.ts`.
- **Day_Loom**: The default theme (ivory silk ground).
- **Night_Loom**: The deep indigo theme, defined by the `[data-theme='night']` tokens.
- **Theme_Switch**: The labelled control in the Shell that chooses Day_Loom or Night_Loom.
- **Font_Files**: The woff2 files under `public/fonts` for Rozha One (display), Hind (body, with Devanagari) and IBM Plex Mono (data).
- **Font_Weight_Report**: The list in `docs/BUILD_LOG.md` of each Font_File with its size in bytes and the total size in bytes.
- **Precache**: The named cache the Service_Worker fills when it installs, as defined in the `app` spec.
- **Offline_Check**: The check in `scripts/checks/offline.ts` and `scripts/checks/precache.ts` that the Built_Site works with the network off and that every built file is in the Precache.
- **Button**: The shared control style with three variants: primary (zari), secondary (outline) and quiet.
- **Panel**: The shared surface for a block of content, with the panel radius and a 1 px `--line` border.
- **Field**: The shared style for a labelled text input, select or checkbox.
- **Tabs**: The shared style for a row of choices where one is current.
- **Notice**: The shared style for a message block, with variants for information, success, warning and error, each carrying a word or an icon in addition to colour.
- **Disclosure**: A control labelled "More" or "Settings" (or its Hindi equivalent) that shows or hides a group of secondary controls, is collapsed by default and reports its state to assistive technology.
- **Graph_Paper_Ground**: The faint 8 px grid in `--line` on the page background.
- **Selvedge**: The thin woven border at the top of the Shell, drawn in `--zari` and `--madder`.
- **Thread_Progress**: A progress indicator drawn as a thread being drawn across, not a filling rectangle.
- **Card_Drawing**: The shared React component that draws one card as the real object (manila stock, punched holes, two peg holes, lacing holes, square corners, soft shadow). It takes a CardGrid and the Card_Profile.
- **Hero_Loom**: The illustration on the Landing of a Jacquard head with hooks, a card pressing on the needles and warp threads lifting.
- **Lift_Cycle**: One animation of the Hero_Loom: the card presses on the needles, the hooks of the punched holes rise, the matching warp ends lift, one weft passes, and the Hero_Loom returns to rest.
- **Step_Icon**: A small drawn icon for one step of the Step_Strip or one navigation item.
- **Spot_Illustration**: A small drawn picture shown in an empty state.
- **Illustration**: A Card_Drawing, the Hero_Loom, a Step_Icon or a Spot_Illustration. Each is an inline SVG React component with no external file and no image request.
- **Entry_Chunk**: The JavaScript file loaded first by the Built_Site, measured by `scripts/check_bundle.ts`.
- **Built_Site**: The static output of `npm run build` in `dist/`.
- **Check_Browser**: The script run by `npm run check:browser`, with its helpers in `scripts/checks`.
- **Check_All**: The script run by `npm run check:all`.
- **Screenshot_Set**: The PNG files taken by headless Chrome with the Check_Browser helpers, for six views, two themes and two widths, stored under `media/design/before/` or `media/design/after/`.
- **Screenshot_View**: One of six views: Weave landing, Weave with a Sample_Design, Weave with lost cards and the repair panel, Keep with versions, Scan, and Code view with a diff.
- **Version_Chooser**: A control on the Code_View_Screen that lists the saved versions of the designs so the weaver can pick the two sides to compare.
- **Version_Label**: The text of one option in a Version_Chooser.
- **Pick_Count_Text**: Text that states a number of picks, from the keys `codeview.pickCount`, `keep.list.picks` and `codeview.diff.option`.
- **Benchmark_Test**: The test `tests/codec-view/benchmark.test.ts`, which times `diffPatterns` alignment against a ceiling.
- **Build_Log**: `docs/BUILD_LOG.md`.
- **Kiro_Usage**: `docs/KIRO_USAGE.md`.
- **Loom_MCP_Design**: `.kiro/specs/loom-mcp/design.md`.
- **Translation_File**: A per-language file of user-visible text. Two exist: `src/ui/i18n/en.json` and `src/ui/i18n/hi.json`.
- **Review_List**: The list of Hindi strings that a native Hindi speaker has not reviewed, produced from the `reviewed` flag in `hi.json`.
- **Reduced_Motion**: The state in which the browser reports `prefers-reduced-motion: reduce`.
- **WCAG_AA**: A contrast ratio of at least 4.5:1 for text and at least 3:1 for the focus indicator and for graphics that carry meaning.

## Requirements

### Requirement 1: Self-hosted fonts

**User Story:** As a weaver using the App in a workshop with no network, I want the App's lettering to load from the App itself, so that Hindi and English text looks the same offline as online.

#### Acceptance Criteria

1. THE Built_Site SHALL contain exactly four Font_Files as woff2 files under `public/fonts`: Rozha One at weight 400 for display text, Hind at weight 400 and Hind at weight 700 for body text, and IBM Plex Mono at weight 400 for data text.
2. THE Token_File SHALL declare each of the four Font_Files with one `@font-face` rule that sets the font family, the weight of that Font_File and `font-display: swap`. Each rule SHALL have a `src` in woff2 format whose URL has no scheme and no host and resolves to a file in the Built_Site.
3. THE Token_File SHALL set `--font-display` to `'Rozha One', Georgia, serif`, `--font-body` to `Hind, system-ui, sans-serif` and `--font-data` to `'IBM Plex Mono', ui-monospace, monospace`. Each value SHALL list these families in this order and no other family.
4. WHEN any Screen loads in either language (Hindi or English) and in either theme (Day_Loom or Night_Loom), THE App SHALL make zero requests to an origin other than its own to obtain a font, a stylesheet or a script, as recorded in the browser's network log.
5. THE Hind Font_Files and THE Rozha One Font_File SHALL each contain a glyph for every Devanagari code point (U+0900 to U+097F) that appears in a string value of `hi.json`.
6. THE Font_Files SHALL be subset as follows:
   - Each Font_File holds Basic Latin (U+0020 to U+007E) and every punctuation or symbol code point that appears in a string value of `en.json` or `hi.json` or in the name of a Sample_Design.
   - The Rozha One Font_File and the two Hind Font_Files also hold the Devanagari block (U+0900 to U+097F).
   - No Font_File is shipped for a weight other than the four named in criterion 1.
7. THE Built_Site SHALL list each of the four Font_Files in the Precache, under the same path as the `src` of its `@font-face` rule.
8. WHEN `npm run build` completes and the Offline_Check runs, THE Offline_Check SHALL exit with code 0 with all four Font_Files in the Precache. THE Offline_Check SHALL NOT have any assertion removed, skipped or relaxed compared with its state before this pass.
9. WHILE a Font_File is still loading, THE App SHALL show text of the matching family in the first fallback family of its `--font-*` token. That text SHALL have visibility other than hidden and opacity other than 0 from the first paint.
10. WHEN the weaver loads the Built_Site with the network off after one online visit, THE App SHALL render display, body and data text from the Font_Files. The browser's font loading status SHALL report loaded for every Font_File whose family and weight the shown Screen uses, and no font request SHALL fail.
11. IF the request for a Font_File fails, THEN THE App SHALL render every Screen in the fallback family of the matching `--font-*` token. It SHALL show no error Notice for that failure, and every control on the Screen SHALL stay usable.
12. IF a Font_File is missing from the Precache, THEN THE Offline_Check SHALL exit with a non-zero code and name the missing Font_File in its output.

### Requirement 2: Font licences, credits and weight report

**User Story:** As the owner of the repository, I want the font licences checked and credited, so that the App can ship the fonts legally and honestly.

#### Acceptance Criteria

1. WHEN the font licences are checked, THE Build_Log SHALL record, for each of Rozha One, Hind and IBM Plex Mono, the licence name (SIL Open Font License 1.1 expected), the licence source URL, and the date the licence was checked in the form YYYY-MM-DD.
2. IF the licence of a font is neither the SIL Open Font License 1.1 nor another licence that permits both embedding in a web page and redistribution of the font file, THEN THE Build_Log SHALL name the font and the licence, THE Built_Site SHALL NOT contain any Font_File of that font, and the font SHALL NOT be shipped until the user agrees to a replacement.
3. THE Built_Site SHALL contain, for each shipped font, one plain text file under `public/fonts` that holds the full licence text and the copyright notice of that font, and that file SHALL be non-empty.
4. THE README SHALL contain a credits section that lists Rozha One, Hind and IBM Plex Mono and gives, for each, its designer or foundry, its licence name, and the URL of the place it was obtained from.
5. WHEN the Font_Files have been subset, THE Build_Log SHALL contain the Font_Weight_Report, which lists for each Font_File its size in bytes before subsetting and its size in bytes after subsetting, and which gives the sum of the sizes after subsetting, in bytes.
6. IF the sum of the Font_File sizes after subsetting is more than 307,200 bytes (300 KB), THEN THE Build_Log SHALL name each Font_File larger than 51,200 bytes (50 KB) and the glyph ranges and weights that could be removed, and the Build_Log SHALL state that the user has been asked whether to accept the total.

### Requirement 3: Complete design tokens

**User Story:** As a developer, I want one place that defines type, spacing, shape, shadow and motion, so that every Screen looks like part of the same App.

#### Acceptance Criteria

1. THE Token_File SHALL define exactly six type scale tokens, with values of 14, 16, 18, 22, 28 and 36 px, and SHALL set the computed font size of the document root to 18 px.
2. THE Token_File SHALL define exactly seven spacing scale tokens, with values of 4, 8, 12, 16, 24, 32 and 48 px.
3. THE Token_File SHALL define exactly two corner radius tokens: 4 px for controls and 8 px for panels.
4. THE Card_Drawing SHALL have a computed corner radius of 0 on the card outline in every theme, and SHALL NOT take its corner radius from a corner radius token.
5. THE Token_File SHALL define exactly one shadow token, for the soft shadow under a card.
6. THE CSS Modules SHALL contain no `box-shadow`, `text-shadow` or `drop-shadow(` declaration whose value is not `var()` of the shadow token, and SHALL contain no other value for these three.
7. THE Token_File SHALL define exactly three motion duration tokens, with values of 120, 200 and 320 ms.
8. THE CSS Modules SHALL give every `transition` and `animation` declaration a duration that is `var()` of a motion duration token, and SHALL contain no duration written as a literal number of seconds or milliseconds.
9. THE Token_File SHALL set the line height of body text to 1.5, and to 1.7 inside an element whose language is `hi`.
10. THE Token_File SHALL set `font-variant-numeric: tabular-nums` on every table cell and on the pick counter, in every theme and in both languages.
11. WHEN a colour token is added to the Token_File, THE Contrast_Table SHALL receive an entry with the same token name and the same value for Day_Loom, and an entry with the same token name and the same value for Night_Loom, in the same commit.
12. THE Token_File SHALL hold, for every colour token in `THEME_TOKENS`, the same value as `THEME_TOKENS` for Day_Loom and for Night_Loom, and the existing test that compares them SHALL pass with 0 failures when run with `npm run test:run`.
13. THE CSS Modules SHALL contain no function whose name ends in `gradient(`, no `backdrop-filter` property and no `blur(` function.

### Requirement 4: Night loom theme switch

**User Story:** As a weaver in a bright or a dim workshop, I want to choose the day or the night look, so that the App is comfortable to read where I work.

#### Acceptance Criteria

1. THE Shell SHALL show a Theme_Switch with a visible text label (Hindi and English from the Translation_Files) and a Touch_Target of at least 48 CSS pixels by 48 CSS pixels, and the label SHALL NOT be clipped in English or in Hindi.
2. THE Theme_Switch SHALL expose the current theme (Day_Loom or Night_Loom) as a programmatic state or accessible name that changes when the theme changes, and SHALL show the current theme in visible text or shape as well as colour.
3. WHEN the weaver activates the Theme_Switch by touch, click, Enter or Space, THE App SHALL change the theme from Day_Loom to Night_Loom or from Night_Loom to Day_Loom, and SHALL set the `data-theme` attribute on the document before the next browser paint, so that the Night_Loom tokens apply when `data-theme` is `night` and the Day_Loom tokens apply when `data-theme` is `day` or absent.
4. WHEN the weaver activates the Theme_Switch, THE App SHALL store the choice in `localStorage` as the text `day` or `night`, and the store call SHALL be inside a try/catch so that, IF `localStorage` is blocked or full, the choice stays applied for the page session, no error message is shown to the weaver and the App continues to work.
5. WHEN the App starts and the stored theme choice is exactly `day` or `night`, THE App SHALL apply that choice, regardless of the `prefers-color-scheme` value reported by the browser.
6. WHEN the App starts and no valid stored choice exists (nothing stored, or a stored value other than `day` or `night`) and the browser reports `prefers-color-scheme: dark`, THE App SHALL apply the Night_Loom.
7. WHEN the App starts and no valid stored choice exists and the browser reports `prefers-color-scheme: light`, reports no preference, does not support the query, or the query throws an exception, THE App SHALL apply the Day_Loom.
8. IF reading `localStorage` throws an exception, THEN THE App SHALL treat the stored choice as not valid, SHALL apply the theme from Acceptance Criteria 6 or 7, and SHALL continue to start.
9. WHEN the weaver activates the Theme_Switch, THE App SHALL keep the Current_Pattern, the language and the current Screen unchanged, and SHALL NOT reload the page.
10. THE CSS Modules and the Shell and Screen components SHALL take every colour from theme tokens, and SHALL contain no hard-coded colour literal (hexadecimal, `rgb()`, `hsl()` or colour keyword) outside the Token_File.
11. WHERE a canvas or an SVG Illustration draws a colour from the theme, THE App SHALL redraw it from the current token values before the next browser paint after the theme changes, without changing its content.
12. WHEN the App starts, THE App SHALL set `data-theme` on the document before the first paint of the Shell, so that no frame is shown in the other theme.

### Requirement 5: Contrast in both themes

**User Story:** As a weaver with tired eyes, I want every piece of text and every focus ring to be easy to see in both themes, so that I can read the App at arm's length.

#### Acceptance Criteria

1. THE Contrast_Table SHALL list, separately for Day_Loom and for Night_Loom, one pair for every text colour on background colour combination and every focus indicator or meaningful graphic colour on background colour combination that the shared base styles use. The shared base styles are the page body, Button (primary, secondary and quiet), Panel, Field, Tabs, Disclosure, Theme_Switch and Notice (information, success, warning and error). The pairs SHALL include text on a primary Button, text on each of the four Notice variants, the quiet Button text, and the focus indicator against both the page background and the Panel background.
2. THE existing contrast test SHALL compute the contrast ratio of every pair in the Contrast_Table in both themes using the WCAG relative-luminance formula, and SHALL check it against 4.5 for text and 3 for the focus indicator and for graphics that carry meaning. IF any pair is below its minimum, THEN THE contrast test SHALL fail and its output SHALL name the pair, the theme and the measured ratio.
3. IF a pair in the Contrast_Table is below WCAG_AA, THEN THE Build_Log SHALL name the pair, the two colours and the measured ratio to two decimal places, and SHALL propose a darker or lighter value for one of the two colours that reaches WCAG_AA.
4. WHEN a value proposed under Acceptance Criterion 3 is adopted, THE Token_File and THE Contrast_Table SHALL both hold the new value in the same commit, and the existing test that compares them (Requirement 3, Acceptance Criterion 12) and the contrast test SHALL pass.
5. THE Build_Log SHALL record the measured ratio of every pair in the Contrast_Table after this pass, in both themes. Each ratio SHALL be shown to two decimal places, truncated rather than rounded up, so that a ratio below its minimum never appears as meeting it.
6. THE Build_Log SHALL keep the existing note that the Day_Loom `--zari` is `#B0800A` and not the brief's `#B8860B`, and THE Token_File and THE Contrast_Table SHALL both hold `#B0800A` for the Day_Loom `--zari`.
7. THE text on a primary Button SHALL be `--ink` in Day_Loom and `--hole` in Night_Loom, in every Button state that the shared base styles define, and THE Contrast_Table SHALL list each of these text and background pairs against `--zari`.

### Requirement 6: Shared base styles

**User Story:** As a weaver with low digital literacy, I want buttons, panels, fields and messages to look and behave the same on every Screen, so that I learn the App once.

#### Acceptance Criteria

1. THE App SHALL provide a shared Button with exactly three variants (primary with a `--zari` fill, secondary with an outline, and quiet), a shared Panel, a shared Field, shared Tabs and a shared Notice with exactly four variants (information, success, warning and error), each as a React component with a co-located CSS Module.
2. THE Button, Field, Tabs and Disclosure controls SHALL each have a rendered border box of at least 48 CSS pixels in height and at least 48 CSS pixels in width, at every viewport width from 320 to 1280 CSS pixels, in both themes.
3. WHEN a control receives keyboard focus, THE App SHALL draw a focus ring of at least 3 CSS pixels in `--zari`, separated from the control's edge by at least 2 CSS pixels, and the ring SHALL have a contrast ratio of at least 3:1 (WCAG_AA) against `--ground` and against `--surface` in both Day_Loom and Night_Loom.
4. THE Notice SHALL show, in every variant, a visible word or an icon that differs between variants, in addition to its colour.
5. WHILE a Screen is displayed, THE Screen SHALL show at most one primary Button in its content, in every state of that Screen (empty, loading, error and with content), for each of the Weave_Screen, Keep_Screen, Scan_Screen and Code_View_Screen.
6. THE CSS Modules of the Weave_Screen, Keep_Screen, Scan_Screen and Code_View_Screen SHALL contain no declaration of text colour, background, border or border radius for a button element or a button class, so that every button in the four Screens takes these from the shared Button or the shared CSS.
7. THE shared components SHALL render every accessible name, role, `aria-*` attribute, data attribute and test id that an existing unit test or Check_Browser step uses, with the same value as before this pass, so that those tests and steps pass unchanged.
8. THE primary Button label SHALL have a text contrast ratio of at least 4.5:1 (WCAG_AA) against its `--zari` fill in both Day_Loom and Night_Loom.
9. WHILE a Button is disabled, THE Button SHALL report the disabled state to assistive technology, SHALL NOT receive keyboard focus, SHALL NOT run its action when activated, and SHALL show a look that differs from the enabled look in more than colour alone.
10. WHILE one choice of Tabs is current, THE Tabs SHALL mark that choice in text or shape in addition to colour and SHALL report it as the current choice to assistive technology.

### Requirement 7: Signature details

**User Story:** As a visitor, I want the App to look like the weaver's own materials, so that it feels made for this craft.

#### Acceptance Criteria

1. THE App SHALL draw the Graph_Paper_Ground on the page background as a grid of 1 px lines in `--line` at 8 px spacing, in both themes, using CSS only and no image file.
2. THE Panel SHALL have a fully opaque `--surface` background (alpha 1) in both themes, so that the Graph_Paper_Ground does not show behind running text.
3. THE Shell SHALL draw the Selvedge across the full width of its top edge, 4 px to 8 px high, as a repeating woven pattern that alternates segments of `--zari` and `--madder`, using CSS or inline SVG, with no gradient and no image file.
4. WHEN an operation has been running for 300 ms (reading a card image, exporting a file, or saving a design), THE App SHALL show Thread_Progress, a thread drawn across a track, and SHALL state the progress as visible text or as an element with the `progressbar` role carrying `aria-valuemin` 0, `aria-valuemax` 100 and the current `aria-valuenow`.
5. WHILE Reduced_Motion is active, THE Thread_Progress SHALL show its current state as a static thread length or as text, and SHALL run no animation or transition.
6. THE App SHALL use no emoji (Unicode characters with the Extended_Pictographic property) as an icon in any Screen or in the Shell.
7. THE Graph_Paper_Ground and the Selvedge SHALL NOT cause a horizontal scrollbar at a viewport width of 320 px, so that the document's scroll width is no greater than its client width on every Screen, in English and in Hindi, in both themes.
8. THE App SHALL contain no gradient (`linear-gradient`, `radial-gradient`, `conic-gradient`) and no glass effect (`backdrop-filter`, or a background with alpha below 1 behind running text) in any `.module.css` file.

### Requirement 8: Landing

**User Story:** As a first-time visitor, I want the first screen to tell me what Naqsha is and what to press, so that I understand it within five seconds.

#### Acceptance Criteria

1. WHILE the Current_Pattern has no pick, THE Weave_Screen SHALL show the Landing.
2. THE Landing SHALL show the headline "Read a loom's punch cards. Weave the design again." as a heading in the display font when the interface language is English, and SHALL show its Hindi equivalent from `hi.json`, marked `"reviewed": false`, when the interface language is Hindi.
3. THE Landing SHALL show the Step_Strip with exactly three steps in this reading order: "Scan a card", "Watch it weave" and "Keep the design". Each step SHALL have one Step_Icon and a label in the current interface language, and both `en.json` and `hi.json` SHALL hold that label.
4. THE Landing SHALL show exactly one Sample_Tile for each of the three Sample_Designs (diamond, border and floral). Each Sample_Tile SHALL be one control whose whole area is activatable and measures at least 48 by 48 CSS pixels. Each SHALL hold the name of its Sample_Design, its Cloth_Preview and the label "Try it" (or its Hindi equivalent).
5. THE Landing SHALL style the "Try it" control of the first Sample_Tile as the primary Button, and SHALL style the "Try it" controls of the other two Sample_Tiles as the secondary Button. The Landing SHALL contain no other primary Button.
6. WHEN the weaver activates a Sample_Tile by pointer, touch, or the Enter or Space key, THE App SHALL set the Current_Pattern to the Pattern of that Sample_Design, replace the Landing with the weave player, and start playing the first pick within 500 ms.
7. THE Landing SHALL show one link to the Scan_Screen, styled as the quiet Button, after the last Sample_Tile in reading order, with a Touch_Target of at least 48 CSS pixels.
8. THE Landing SHALL render each Cloth_Preview through the simulator from the Pattern of its Sample_Design, and SHALL make no image file request for any Cloth_Preview.
9. THE Landing SHALL contain no visible text and no accessible name that includes, in any letter case, the words "bitmap", "matrix", "decode", "threshold", "grid detection" or "Canvas", or their Hindi equivalents in `hi.json`.
10. THE Landing SHALL show the whole headline, the whole Step_Strip and the whole first Sample_Tile, with no scrolling, within the top 700 CSS pixels of the page at a viewport of 390 by 844 CSS pixels, in both English and Hindi.
11. IF the Card_Profile has failed to load, THEN THE Landing SHALL show the error Notice of Requirement 11 in place of the Sample_Tiles, and THE Shell navigation SHALL stay usable and keep the Current_Pattern unchanged.
12. WHEN the App starts, THE App SHALL show the Landing as the first Screen.
13. WHILE the Card_Profile is loading, THE Landing SHALL show the loading message of Requirement 11 in place of the Sample_Tiles, and THE Shell navigation SHALL stay usable.
14. IF the simulator fails to render the Cloth_Preview of a Sample_Design, THEN THE Landing SHALL show that Sample_Tile without its Cloth_Preview, with its name and "Try it" label and its activation still working, and SHALL show no error Notice for that failure.

### Requirement 9: Navigation

**User Story:** As a weaver, I want each navigation item to have a plain label and a small picture, so that I know where I am and where I can go.

#### Acceptance Criteria

1. THE Shell SHALL show exactly four navigation items, one for each of the Weave_Screen, Keep_Screen, Scan_Screen and Code_View_Screen, each with a visible text label from the Translation_Files and an inline SVG icon drawn in the markup with `aria-hidden="true"`.
2. THE navigation item of the current Screen SHALL carry `aria-current="page"`, and no other navigation item SHALL carry `aria-current`.
3. THE navigation item of the current Screen SHALL differ from the other navigation items by at least one non-colour property (font weight, an underline or border, or a filled shape) as well as by colour, and the colour difference SHALL meet WCAG_AA.
4. THE navigation item for the Code_View_Screen SHALL show a visible word that marks it as an advanced view ("Advanced" in English, a Hindi equivalent in Hindi), added through a new translation key present in both `en.json` and `hi.json`, while keeping the existing key `nav.code` unchanged.
5. WHEN the viewport width is 320 CSS pixels, THE Shell SHALL show every navigation label, the language switch and the Theme_Switch with no clipped text, no overlap between controls and no horizontal scrollbar, in English and in Hindi, in Day_Loom and in Night_Loom.
6. THE navigation items SHALL each have a Touch_Target of at least 48 CSS pixels by 48 CSS pixels.
7. THE navigation items SHALL be in the DOM at all times, SHALL be visible without any activation, and SHALL NOT be inside a menu, drawer or collapsible control.
8. WHEN the weaver presses the Tab key, THE Shell SHALL move keyboard focus to each navigation item in the visual order (Weave, Keep, Scan, Code view), and the focused item SHALL show the focus ring defined in Requirement 6.
9. WHEN a navigation item has keyboard focus and the weaver presses Enter or Space, THE App SHALL activate that item.
10. WHEN the weaver activates a navigation item, THE App SHALL show the Screen of that item within the same frame, set `aria-current="page"` on that item, and leave the Current_Pattern, the language and the theme unchanged.
11. WHEN the weaver activates the navigation item of the Screen that is already current, THE App SHALL keep that Screen shown and leave the Current_Pattern unchanged.

### Requirement 10: Progressive disclosure and screen structure

**User Story:** As a weaver, I want each screen to show what it is for, what to do next and one main button, with the rest tucked away, so that I am never faced with a wall of controls.

#### Acceptance Criteria

1. THE Weave_Screen, Keep_Screen, Scan_Screen and Code_View_Screen SHALL each show, above their controls, one purpose line and one next-step line. Each line SHALL be a single sentence of at most 100 characters, taken from the Translation_Files in the current Language (English or Hindi).
2. THE Weave_Screen SHALL show the playback controls and the speed control without a Disclosure, and SHALL put the repeat count, the thread colours and the zari settings inside a Disclosure labelled "More" or "Settings" (or its Hindi equivalent).
3. THE Keep_Screen SHALL show the name field, the save control and the primary export control without a Disclosure, and SHALL put the export options (bit depth, lift colour, order of picks, order of ends) and the other metadata fields inside a Disclosure.
4. THE App SHALL put the Card_Profile details inside a Disclosure. WHILE the Card_Profile is unverified, THE App SHALL show the one-line Card_Profile status notice without the weaver activating any Disclosure.
5. THE Scan_Screen SHALL place the choose-a-photo control first in reading order among its controls, and SHALL put every other Scan_Screen control inside a Disclosure.
6. THE Disclosure SHALL be collapsed each time its Screen is first shown, and SHALL set its expanded state to true for assistive technology while it is expanded and to false while it is collapsed.
7. WHEN the weaver activates a Disclosure at a viewport of 390 by 844 CSS pixels, THE Disclosure SHALL show its controls, and the primary Button SHALL remain fully inside the viewport at the scroll position it had before the activation.
8. IF a control that `check:browser` uses sits inside a Disclosure, THEN THE Check_Browser SHALL open that Disclosure by its accessible name before it uses the control, and the Build_Log SHALL name each such check change. IF the Check_Browser cannot find the Disclosure by its accessible name, THEN THE Check_Browser SHALL fail that check with a message that names the Disclosure.
9. THE Disclosure SHALL keep the keyboard order of the controls the same as their reading order, with the controls inside an expanded Disclosure coming immediately after the Disclosure's own control.
10. WHILE a Disclosure is collapsed, THE Disclosure SHALL keep its controls out of the Tab order and out of the assistive-technology tree, and SHALL keep the values already entered in those controls, so that they are unchanged when the Disclosure is expanded again.
11. WHEN the weaver presses Enter or Space while a Disclosure's control has keyboard focus, THE Disclosure SHALL toggle between expanded and collapsed, and SHALL show a visible focus ring on that control while it has keyboard focus.
12. WHEN a Disclosure collapses while keyboard focus is on one of its inner controls, THE Disclosure SHALL move keyboard focus to the Disclosure's own control.

### Requirement 11: Empty, loading and error states

**User Story:** As a weaver, I want every empty, waiting and failed state to say what happened and what to do next in my own words, so that I never feel stuck.

#### Acceptance Criteria

1. WHEN any of the following situations is present, THE App SHALL show a state message in the current language that names the situation and gives the next step: no saved designs on the Keep_Screen, no card in the Scan_Batch on the Scan_Screen, nothing to compare on the Code_View_Screen, the Card_Profile loading, a Screen chunk loading, the Card_Profile failing to load, a Screen failing to load, a card that cannot be read, and an Archive failure.
2. THE App SHALL write each state message in the weaver's words (card, design, loom, pick, naksha), and SHALL NOT use the words "bitmap", "matrix", "decode", "decoded" or "decoding" (compared without regard to case) in any state message outside the Code_View_Screen.
3. IF a state message reports an error, THEN THE App SHALL write it as one to three sentences of at most 160 characters in total, where the first sentence states what went wrong and the last sentence states what the weaver can do, in the form of the brief's example: "The card is not fully in the frame. Move the phone back."
4. THE App SHALL show each state message inside the shared Notice or inside an empty state Panel, and each SHALL carry a word or an icon in addition to its colour.
5. WHERE an empty state shows a Spot_Illustration, THE Spot_Illustration SHALL be decorative (`aria-hidden="true"`) and the state message SHALL carry the meaning in text.
6. THE App SHALL keep every existing translation key and its meaning, and SHALL add each new key to both `en.json` and `hi.json`.
7. THE `hi.json` entry of every key added by this pass SHALL be marked `"reviewed": false`, and the Review_List SHALL list it.
8. THE Translation_Files SHALL contain the same set of keys, so that no key exists in one file and not the other.
9. WHEN a Screen starts loading, THE App SHALL show the loading message inside one `role="status"` region, and SHALL keep that region mounted until loading ends, so that screen readers announce the message once and not again until the next load.
10. IF the Card_Profile fails to load, a Screen fails to load, or an Archive operation fails, THEN THE App SHALL show a retry control with a Touch_Target of at least 48 CSS pixels by 48 CSS pixels in the state message, SHALL leave the Shell navigation usable, and SHALL keep the Current_Pattern, the Scan_Batch and every saved design unchanged.
11. IF a card cannot be read, THEN THE App SHALL show the state message for that card only, SHALL keep every other card in the Scan_Batch and the Current_Pattern unchanged, and SHALL leave the choose-a-photo control usable so that the weaver can try another photo.
12. WHEN an error state message appears, THE App SHALL announce it to assistive technology once through a `role="alert"` region, and SHALL NOT move keyboard focus away from the control that was focused before the message appeared.

### Requirement 12: Card drawing

**User Story:** As a naqshband, I want a card to look like the real card in my hand wherever it appears, so that I recognise it at once.

#### Acceptance Criteria

1. WHEN the Card_Drawing is given a CardGrid and the Card_Profile, THE Card_Drawing SHALL draw the manila stock filled with `--card`, one round hole filled with `--hole` for each punched hook position and none for an unpunched hook position, the two peg holes each at its own diameter, the lacing holes, square corners (corner radius 0) and the one soft shadow token defined by the Token_File.
2. THE Card_Drawing SHALL read the card size, the hook positions, the hole diameter, the peg hole positions and diameters and the lacing hole positions from the Card_Profile, and SHALL contain no card dimension as a literal, so that a Card_Profile with different values produces a drawing with the card size, the hook positions, the hole diameter, the peg hole positions and diameters and the lacing hole positions of that Card_Profile and no others.
3. WHEN a CardGrid that matches the Card_Profile is given, THE Card_Drawing SHALL draw a number of punched-hole circles equal to the number of punched hook positions in the CardGrid, and SHALL draw each circle with its centre at the position the Card_Profile gives for that hook and with the Card_Profile's hole diameter, for every such CardGrid and not only for the Sample_Designs.
4. THE Card_Drawing SHALL be the only component that draws a card on the Weave_Screen (the current card), the Scan_Screen (the result and the batch list), the Keep_Screen, the repair suggestion drawing and every empty state that shows a card, so that no earlier card picture remains in `src/ui`.
5. IF the CardGrid does not match the Card_Profile, THEN THE Card_Drawing SHALL draw the manila card with its peg holes and lacing holes and no punched holes, SHALL include in its `<desc>` text that states the card does not match the Card_Profile, and SHALL NOT throw an exception.
6. WHERE no text adjacent to the Card_Drawing states both the pick number and the number of punched holes, THE Card_Drawing SHALL have the `img` role and a `<title>` and a `<desc>` that together state the pick number (the number the screen shows for that pick) and the number of punched holes, in the current Language.
7. WHERE text adjacent to the Card_Drawing already states both the pick number and the number of punched holes, THE Card_Drawing SHALL have `aria-hidden="true"` and no `<title>` or `<desc>`.
8. THE Card_Drawing SHALL scale to the width of its container at the aspect ratio of the card size in the Card_Profile, and SHALL cause no horizontal scrolling at a viewport width of 320 CSS pixels (document scroll width not greater than 320 px).
9. WHILE the Night_Loom is current, THE Card_Drawing SHALL fill its stock and its holes from the `--card` and `--hole` values of the Night_Loom, and SHALL contain no colour literal.
10. WHEN a card is shown as damaged or missing, THE Card_Drawing or the component that contains it SHALL show, inside the same card element, a hatched gap in `--madder` over the card face and visible text (not only a `<title>`) in the current Language that states the card is damaged or missing, so that the state is not carried by colour alone.
11. THE Card_Drawing SHALL keep every accessible name, role and test id that an existing test in `tests/` and Check_Browser use on the existing card pictures, so that those tests and checks find the same elements without any change to their selectors.
12. IF the Card_Profile given to the Card_Drawing fails `validateCardProfile`, THEN THE Card_Drawing SHALL draw no card, SHALL show text that states the card cannot be drawn, SHALL NOT throw an exception, and SHALL leave the CardGrid and the current Pattern unchanged.

### Requirement 13: Hero loom

**User Story:** As a first-time visitor, I want a picture of a loom at work on the first screen, so that I see at a glance what the App is about.

#### Acceptance Criteria

1. THE Landing SHALL show the Hero_Loom as an inline SVG React component drawn by this pass. The Hero_Loom SHALL show a Jacquard head with hooks, a card drawn like a Card_Drawing (manila stock in `--card`, holes in `--hole`, square corners) pressing on the needles, and warp threads. THE Hero_Loom SHALL cause no external file or image request.
2. THE Hero_Loom SHALL be built from the Pattern of the first Sample_Design and from the Card_Profile. The pick it shows SHALL be the first pick of that Pattern with at least one punched hook position. The number of hooks that rise and the number of warp ends that lift SHALL each equal the number of punched hook positions of that pick, and each SHALL sit at the end that hook position maps to.
3. WHEN the Landing is shown and Reduced_Motion is not active, THE Hero_Loom SHALL play exactly one Lift_Cycle and then rest. The Lift_Cycle SHALL last no more than 3,000 ms, its duration SHALL come from a motion duration token, and it SHALL NOT repeat until the Landing is shown again.
4. WHILE Reduced_Motion is active, THE Hero_Loom SHALL be static, SHALL start no animation, and SHALL show the lifted state: the hooks of the punched holes raised and the matching warp ends lifted.
5. THE Hero_Loom SHALL have a `<title>` and a `<desc>` that name the Jacquard head, the card and the lifting warp ends, in Hindi or English according to the current language. Alternatively it SHALL have `aria-hidden="true"`, in which case the Landing headline SHALL state the same meaning in text. WHEN the language changes while the Landing is shown, THE `<title>` and `<desc>` SHALL change to the new language with no reload.
6. WHERE the Entry_Chunk would exceed the budget of Requirement 15 (204,800 bytes gzipped), THE App SHALL load the Hero_Loom as a separate chunk with `lazy`. While it loads, THE App SHALL show a fallback with the same width and height as the Hero_Loom at every viewport width, so that the Landing content below it moves by 0 CSS pixels when the Hero_Loom appears.
7. THE Hero_Loom SHALL show a raised hook and a lowered hook, and a lifted warp end and a resting warp end, as different vertical positions and not by colour alone. Every graphic that carries meaning SHALL have a contrast ratio of at least 3:1 against its background (WCAG_AA). No colour in the Hero_Loom SHALL carry meaning that is not also stated in text nearby or in the `<desc>`.
8. THE Hero_Loom SHALL scale to the width of its container, keeping its aspect ratio, with no horizontal overflow at viewport widths of 320 and 1280 CSS pixels.
9. IF the lazy chunk of the Hero_Loom fails to load, THEN THE App SHALL keep showing the fallback of criterion 6, SHALL leave the rest of the Landing usable, and SHALL NOT throw an uncaught exception.
10. IF the first Sample_Design has no pick with a punched hook position, or its pick does not match the Card_Profile, THEN THE Hero_Loom SHALL draw the Jacquard head, the card and the warp threads with no raised hook and no lifted warp end, and SHALL NOT throw an exception.

### Requirement 14: Step icons and spot illustrations

**User Story:** As a weaver, I want small drawn pictures that show the three steps and the empty states, so that I understand without reading much.

#### Acceptance Criteria

1. THE App SHALL provide three Step_Icons as inline SVG React components, one each for "Scan a card", "Watch it weave" and "Keep the design", and each Step_Icon SHALL have drawing content different from the other two.
2. THE App SHALL provide three Spot_Illustrations as inline SVG React components, one each for these empty states: no saved designs, no cards scanned, and nothing to compare. Each Spot_Illustration SHALL have drawing content different from the other two.
3. WHILE the Keep_Screen has no saved design, THE Keep_Screen SHALL show the "no saved designs" Spot_Illustration inside its empty state Panel. WHILE the Scan_Screen has no scanned card, THE Scan_Screen SHALL show the "no cards scanned" Spot_Illustration inside its empty state Panel. WHILE the Code_View_Screen has no two sides to compare, THE Code_View_Screen SHALL show the "nothing to compare" Spot_Illustration inside its empty state Panel. In each case the empty state Panel SHALL also show its text message, and the Spot_Illustration SHALL NOT replace that message.
4. THE Step_Icons and Spot_Illustrations SHALL take every colour from `currentColor` or from a token in the Token_File. Their source SHALL contain no hex, `rgb()` or `hsl()` colour literal, so that they follow Day_Loom and Night_Loom.
5. WHERE an Illustration is decorative, THE Illustration SHALL have `aria-hidden="true"` and no `<title>`. An Illustration is decorative when text in the same Panel, Button or Step_Strip item states what the Illustration shows.
6. WHERE an Illustration is not decorative, THE Illustration SHALL have `role="img"` and a non-empty `<title>` and a non-empty `<desc>`, both in the current language (English or Hindi).
7. THE repository SHALL contain no file with the extension svg, png, jpg, jpeg, gif, webp, ico, woff, woff2, ttf or otf that this pass added for an Illustration. `package.json` SHALL gain no dependency for icons or illustrations. Each Illustration SHALL be drawn as SVG elements in its React component.
8. THE Illustrations SHALL contain no `linearGradient` or `radialGradient` element, no `filter` element or blur effect, no `backdrop-filter`, and no emoji character, in the SVG markup or in the component source.
9. THE Step_Icons and Spot_Illustrations SHALL declare a `viewBox` and SHALL scale to the size of their container, with no fixed pixel `width` attribute larger than the container. WHEN the viewport is 320 CSS pixels wide, THE Weave_Screen, Keep_Screen, Scan_Screen and Code_View_Screen SHALL show no horizontal scroll caused by an Illustration.
10. WHEN the Built_Site loads any Screen, THE App SHALL make no network request for an image file (svg, png, jpg, jpeg, gif or webp). The only exceptions are the favicon and the manifest icons. This SHALL hold in both themes and in both languages.

### Requirement 15: Bundle budget

**User Story:** As a weaver on a basic phone, I want the App to load fast, so that I can start weaving without waiting.

#### Acceptance Criteria

1. THE Entry_Chunk SHALL be smaller than 204,800 bytes (200 KB) when gzipped at compression level 9, as `scripts/check_bundle.ts` measures it, and a size of exactly 204,800 bytes or more SHALL fail.
2. THE Font_Files SHALL NOT be counted in the Entry_Chunk and SHALL be fetched only when a rule that uses them applies.
3. THE Build_Log SHALL record the gzipped size, in bytes, of the Entry_Chunk and of every other JavaScript chunk in `dist/assets`, once before Stage A starts and once after Stage C completes, each with the chunk file name.
4. WHERE the Entry_Chunk measured after Stage C would be 204,800 bytes or more gzipped, THE App SHALL load the Hero_Loom and every other Illustration whose removal brings the Entry_Chunk under 204,800 bytes from separate JavaScript chunks, and THE Build_Log SHALL name each Illustration moved.
5. IF the Entry_Chunk is 204,800 bytes or more gzipped after any Stage, THEN THE `check-bundle` command SHALL exit with a non-zero status and print a message that names the Entry_Chunk file, its gzipped size in bytes and the limit, and THE Build_Log SHALL record the failing size.
6. WHEN any Stage completes, THE Built_Site SHALL pass `check-bundle`, which includes the existing checks that the Entry_Chunk does not contain the Scan-only marker and that a separate chunk does.

### Requirement 16: Version chooser labels

**User Story:** As an archivist who keeps many versions of a design, I want each version in the chooser to show when it was saved and what changed, so that I can tell them apart.

#### Acceptance Criteria

1. THE Version_Label SHALL be plain text in the form "name (n picks)" followed by " · " and the saved date, and, WHERE the version has a note, followed by " · " and the note excerpt. The count text SHALL follow Requirement 17.
2. WHERE a version has a note, THE Version_Label SHALL show the note excerpt as follows. The note is first trimmed, and each run of whitespace, including line breaks, is replaced by one space. If the result has 40 or fewer characters (counted as Unicode code points), it is shown in full. If it has more, it is cut at the last space within the first 40 characters, or at exactly 40 characters when that span has no space, and a single "…" is appended. The appended "…" does not count toward the 40.
3. WHERE a version has no note, or its note is empty or only whitespace, THE Version_Label SHALL show the name, the number of picks and the saved date, with no empty brackets, no empty note part, and no trailing or doubled " · ".
4. THE Version_Label SHALL show the saved date and the time to the minute, formatted for the document language (`hi` or `en`), so that the same version shows the same date text as the Keep_Screen version list.
5. IF the saved time of a version is missing or is not a valid date, THEN THE Version_Label SHALL leave out the date and its " · " separator, and THE Version_Chooser SHALL still list the version.
6. IF a version has no name or a name that is empty or only whitespace, THEN THE Version_Label SHALL use the same untitled-design text that the Code_View_Screen shows today for an unnamed saved design.
7. IF two or more versions in the same Version_Chooser would have identical Version_Labels, THEN THE Version_Chooser SHALL append " #k" to each of those labels, where k counts from 1 in order of saved time, earliest first, and versions with equal saved times are ordered by their archive id. After this step no two labels in one Version_Chooser are identical.
8. THE Code_View_Screen SHALL keep the existing accessible names of the Version_Choosers.
9. THE `codeview.diff.option` key SHALL keep its name, and the extra parts of the Version_Label (the separator, the "#k" suffix and the ellipsis) SHALL come from new keys in both Translation_Files, with the new `hi.json` entries marked `"reviewed": false`.

### Requirement 17: Singular pick counts

**User Story:** As a weaver reading English, I want "1 pick" and not "1 picks", so that the App reads correctly.

#### Acceptance Criteria

1. WHEN the App displays a Pick_Count_Text in English for a count of 1, THE App SHALL show the text "1 pick" for `codeview.pickCount` and `keep.list.picks`, and "{name} (1 pick)" for `codeview.diff.option`, where {name} is the design name.
2. WHEN the App displays a Pick_Count_Text in English for a count of 0 or for any whole number count of 2 or more, THE App SHALL show the count written in decimal digits followed by "picks" (for example "0 picks", "2 picks", "12 picks"), and for `codeview.diff.option` SHALL show "{name} (n picks)".
3. THE `codeview.pickCount`, `keep.list.picks` and `codeview.diff.option` keys SHALL each have an English text for a count of 1 and an English text for every other count, stored in the same one and other form that `keep.save.guessesNote.one` and `keep.save.guessesNote.other` use, and THE same form SHALL apply to every other key in `en.json` whose text puts a count directly before the word "picks".
4. THE Hindi text of `codeview.pickCount`, `keep.list.picks` and `codeview.diff.option` SHALL read correctly for a count of 1, and THE `hi.json` file SHALL have a one text and an other text for each key that `en.json` has them for, so that both files have the same set of keys.
5. WHERE the Hindi one text and other text of a key are the same word, THE Build_Log SHALL name that key and state that no separate Hindi singular form is needed.
6. THE existing translation key names SHALL keep their names as the names the code passes when it asks for a Pick_Count_Text, and THE code SHALL choose between the one text and the other text from the count alone.
7. THE test suite SHALL contain an example test for each of the three keys that checks the exact English text for a count of 1, and an example test for each of the three keys that checks the exact English text for counts of 0 and 2, and each of these tests SHALL fail against the previous text "1 picks".

### Requirement 18: Finished cloth on return to Weave

**User Story:** As a weaver, I want to leave Weave and come back to find the cloth finished, so that I do not have to weave it again.

#### Acceptance Criteria

1. WHEN the weaver returns to the Weave_Screen from another Screen, AND the cloth had finished before the weaver left, AND the Current_Pattern is the same Pattern as when the weaver left, THE Weave_Screen SHALL arrive in the finished state on its first render, with the finished status text showing, the paused status text not showing, and no pick played again.
2. WHEN the Weave_Screen arrives in the finished state, THE Weave_Screen SHALL show the whole cloth, so that the number of picks woven equals the number of picks of the Current_Pattern and the current pick shown equals that number.
3. THE Weave_Screen SHALL leave the arrival behaviour for a cloth that was paused before the weaver left, and for a cloth that was never woven, as it is today. Its status text, number of picks woven and current pick shown SHALL be the same as before this fix.
4. IF the Current_Pattern was replaced by a different Pattern while the weaver was away from the Weave_Screen, THEN THE Weave_Screen SHALL arrive as it does today for a cloth that was never woven, and SHALL NOT show the finished status text.
5. WHEN the weaver activates the play control while the Weave_Screen is in the finished state after such an arrival, THE Weave_Screen SHALL start the weave again from the first pick, as it does today after a cloth finishes without the weaver leaving.
6. THE test suite SHALL contain one example test of the sequence: weave to the end, leave the Weave_Screen, open the Code_View_Screen, return, and check that the finished status text shows, that the paused status text does not show, and that the number of picks woven equals the number of picks of the Current_Pattern.
7. THE App SHALL keep `AppState.selectedPick` at a value from 0 up to the number of picks of the Current_Pattern minus 1 at all times, including on arrival in the finished state, as the existing playback state requires.

### Requirement 19: Steady alignment benchmark

**User Story:** As a developer, I want the alignment benchmark to stay green on a busy machine and still fail on a real slowdown, so that the suite is trustworthy.

#### Acceptance Criteria

1. IF the time that the Benchmark_Test measures for the alignment of `diffPatterns` becomes 2.0 times or more the time measured today (about 520 ms in a full suite run, so 1,040 ms or more), THEN THE Benchmark_Test SHALL fail and SHALL print the measured time and the limit it was judged against.
2. THE Benchmark_Test SHALL decide its pass or fail by exactly one of two approaches: a fixed ceiling in milliseconds, or the ratio of the alignment time to a baseline time measured in the same run, on the same machine, from a reference workload that does not call `diffPatterns`.
3. WHERE the Benchmark_Test uses a baseline, THE Benchmark_Test SHALL pass only if the alignment time divided by the baseline time is at most a stated upper bound, and that bound SHALL be at least 1.5 times the highest ratio measured in three consecutive full suite runs and less than 2.0 times the ratio measured today.
4. WHERE the Benchmark_Test uses a fixed ceiling, THE Benchmark_Test SHALL state in a comment the measured time in milliseconds, the ceiling in milliseconds and the margin as a ratio. The ceiling SHALL be at least 1.5 times the highest time measured in three consecutive full suite runs and less than 1,040 ms.
5. THE Build_Log SHALL state which of the two approaches was used, the time or ratio measured before and after the change in each of three consecutive full suite runs, and the reason for the choice.
6. THE Benchmark_Test SHALL keep the comparison of `DIFF_PICK_LIMIT` picks against `DIFF_PICK_LIMIT` picks, the smaller warm-up sizes, the fixed seed and the number of timed repetitions at their present values, and SHALL NOT remove a case that it checks today.
7. WHEN `npm run test:run` runs the full suite three times in a row on the same machine, THE Benchmark_Test SHALL pass in each of the three runs.
8. WHEN the alignment is temporarily made to do its work twice (a slowdown of 2.0 times), THE Benchmark_Test SHALL fail, and THE Build_Log SHALL record that this check was made and that the alignment was restored afterwards.

### Requirement 20: Loom_MCP_Design error result

**User Story:** As a reader of the loom-mcp spec, I want the design document to describe the error result the code returns, so that the document can be trusted.

#### Acceptance Criteria

1. THE Loom_MCP_Design Data Models section SHALL describe a Tool_Error as `{isError: true, content: [text "reason: message. Hint: hint"], _meta: {reason, hint}}`, matching `failure()` in `tools/loom-mcp/src/result.ts`, with `content` holding exactly one text block, `_meta` holding exactly the two keys `reason` and `hint`, and no `structuredContent` key and no `ok` key.
2. THE Loom_MCP_Design SHALL state that a Tool_Error has no `structuredContent`, and SHALL give the reason: an MCP client checks any `structuredContent` against the tool's `outputSchema`, and an error does not have the shape of a success.
3. THE Loom_MCP_Design SHALL describe `message` as one sentence stating what went wrong and `hint` as one sentence stating what the caller should do next. It SHALL state that the reason code is in `_meta.reason`, that the hint is in `_meta.hint`, that the same reason, message and hint appear in the text block, and that `message` is only in the text block.
4. THE Loom_MCP_Design Data Models section SHALL continue to describe a success result as `{content, structuredContent}` validated by the tool's `outputSchema`, and SHALL make no change to that entry.
5. THE change SHALL touch only `.kiro/specs/loom-mcp/design.md` and SHALL make no change to any file under `tools/loom-mcp` or `src`, so that `git diff --name-only` lists exactly that one file.
6. IF a sentence in `.kiro/specs/loom-mcp/design.md` other than the Data Models Tool_Error entry says or implies that a Tool_Error carries `structuredContent` or `{ok: false, ...}`, THEN THE Loom_MCP_Design SHALL be corrected so that sentence matches criteria 1 to 3. After the change, a search of `.kiro/specs/loom-mcp/design.md` for `ok: false` SHALL return no match, and every remaining mention of `structuredContent` in a sentence about a Tool_Error SHALL say that the error has none.

### Requirement 21: Commit the loom-mcp screenshots

**User Story:** As the owner of the repository, I want the loom-mcp evidence screenshots committed, so that the evidence is kept with the code.

#### Acceptance Criteria

1. WHERE the directory `media/kiro/` exists and contains at least one file with the extension `.png`, THE Stage D commit SHALL add every `.png` file in `media/kiro/` to the repository, and SHALL add no other file from `media/kiro/`.
2. IF the directory `media/kiro/` does not exist or contains no `.png` file, THEN THE final report SHALL say that no screenshots were found in `media/kiro/`, and SHALL name the untracked files `media/loom-mcp-connected.png` and `media/loom-mcp-validate-profile.png` as present in `media/`, and THE Stage D commit SHALL leave both files untracked until the user decides.
3. THE Stage D commit SHALL contain the fixes of Requirements 16 to 20 and the screenshots of this requirement, and no other change.
4. IF `media/kiro/` is absent and either `media/loom-mcp-connected.png` or `media/loom-mcp-validate-profile.png` is also absent from `media/`, THEN THE final report SHALL name each file that is absent, and THE Stage D commit SHALL add no loom-mcp screenshot.
5. WHEN the Stage D commit is made, THE final report SHALL list the path of every screenshot file that the commit added, or SHALL state that the commit added none.

### Requirement 22: Keep existing names and checks

**User Story:** As a developer, I want the redesign to leave the tests and browser checks working, so that the pass proves nothing broke.

#### Acceptance Criteria

1. THE redesign SHALL keep every accessible name, role, data attribute and test id that a test under `tests/` or a script under `scripts/` uses to find an element, so that each such query still finds the same element it found before the pass, in English and in Hindi wherever the query is made in that language.
2. IF a design change requires an accessible name, a role, a data attribute or a test id to change, THEN THE test or script that uses it, including Check_Browser, SHALL find the element by its new value, and the Build_Log SHALL name the test or check file, the old selector, the new selector and the reason for the change.
3. THE redesign SHALL keep every assertion in the tests and in Check_Browser at the same strength, and SHALL NOT weaken an assertion, remove an assertion, skip a test, mark a test as todo, lower a `numRuns` value, narrow an arbitrary, add `fc.pre` or `.filter` to exclude inputs, loosen a tolerance, replace an equality with a looser check, or raise a timeout or ceiling to make the suite pass.
4. IF an existing test fails because of this pass, THEN THE final report SHALL name the test file and the test name, SHALL state whether the code or the test was changed and why, and SHALL include the counterexample, seed and path that fast-check printed when the failing test is a property.
5. IF a change to a test or to Check_Browser would reduce what it covers, THEN THE change SHALL NOT be made until the user has agreed to it, and the final report SHALL state exactly what was reduced and why.
6. WHEN Stage A, Stage B, Stage C or Stage D is complete, THE suites run by `npm run typecheck` and `npm run test:run` SHALL pass, with 0 type errors, 0 failed tests, and no test skipped that was not already skipped before this pass, before the commit of that Stage.
7. WHEN Stage A, Stage B, Stage C or Stage D is complete, THE Check_Browser run by `npm run check:browser` SHALL report 0 failed checks before the commit of that Stage.
8. IF `npm run typecheck`, `npm run test:run` or `npm run check:browser` fails at the end of a Stage, THEN THE Stage SHALL NOT be committed, and the final report SHALL name the failing command and the failing test or check.

### Requirement 23: Accessibility, small screens and Hindi

**User Story:** As a weaver using a small phone with a screen reader, a keyboard or Hindi text, I want the new look to work for me, so that the redesign does not shut anyone out.

#### Acceptance Criteria

1. THE App SHALL keep every interactive control reachable with the Tab key and activatable with Enter or Space on every Screen, with the 3 CSS pixel focus ring that meets WCAG_AA in both themes, in an order that matches the reading order, and with no control that traps focus (Tab and Shift+Tab SHALL always move focus out of it).
2. THE App SHALL show no horizontal scrollbar on any Screen at viewport widths of 320, 390 and 1280 CSS pixels, in English and in Hindi, in Day_Loom and Night_Loom, so that the document's scroll width is at most the viewport width in each of the 48 combinations.
3. WHILE the document language is `hi`, THE App SHALL set a computed line height of 1.7 times the font size on running text (paragraphs, list items and Notice text).
4. WHILE Reduced_Motion is active, THE App SHALL run no CSS animation, no CSS transition and no scripted animation, including the Hero_Loom Lift_Cycle, the hole pop and the Thread_Progress, so that every change on screen is immediate and no element changes position, size, opacity or colour over time.
5. THE App SHALL convey each of these states by a word, an icon or a shape in addition to colour: current Screen, current theme, expanded or collapsed Disclosure, error, success and damaged card.
6. THE App SHALL keep exactly one persistent live region (`role="status"`) in the Shell, and every announcement (loading, success and error) SHALL be written into that live region once per change.
7. THE App SHALL keep text left-aligned, SHALL NOT centre the content block of any Screen, and SHALL show the primary Button of each Screen within the first 844 CSS pixels of height at a viewport of 390 by 844 CSS pixels, outside any menu and outside any collapsed Disclosure.
8. THE App SHALL contain in every Illustration no figure of a deity, no religious symbol, no skull, no depiction of blood, and no emoji character in its drawing, title or description.
9. WHILE the document language is `hi` and the viewport width is 320 CSS pixels, THE App SHALL show every Hindi string inside its control or container with no clipped text (the text's scroll width and scroll height are at most the container's client width and client height) and with no overlap between the text and any other element's bounding box.
10. IF a Hindi string cannot be shown within its control at 320 CSS pixels, THEN THE App SHALL wrap the text onto further lines and grow the control in height instead of cutting the text off, and the Build_Log SHALL name the string's key and the fix.

### Requirement 24: Screenshots before and after

**User Story:** As the owner of the repository, I want screenshots from before and after the pass, so that the improvement can be seen and the new look can be inspected.

#### Acceptance Criteria

1. BEFORE any Stage A change is made to a file under `src/`, `public/` or `index.html`, THE Screenshot_Set "before" SHALL be taken with headless Chrome using the Check_Browser helpers, saved under `media/design/before/`, and committed on the branch `auto/build`.
2. WHEN Stage C is complete, THE Screenshot_Set "after" SHALL be taken the same way, from the Built_Site, and saved under `media/design/after/`.
3. EACH Screenshot_Set SHALL hold exactly 24 PNG files, one for each combination of the six Screenshot_Views, the two themes (Day_Loom and Night_Loom) and the two widths (320 and 1280 CSS pixels), named `<view>-<theme>-<width>.png`, where:
   - `<view>` is one of `weave-landing`, `weave-sample`, `weave-lost`, `keep-versions`, `scan`, `code-diff`, in that order for the six Screenshot_Views;
   - `<theme>` is `day` or `night`;
   - `<width>` is `320` or `1280`.
4. EACH PNG file SHALL be a full-page capture at the stated viewport width, with a viewport height of 800 CSS pixels and a device scale factor of 1, so that the PNG is 320 or 1280 pixels wide.
5. WHEN the "before" set is taken, THE Check_Browser SHALL set the `data-theme` attribute on the document to `night` for the Night_Loom files and SHALL leave it unset for the Day_Loom files, because no Theme_Switch exists before Stage A.
6. WHEN the "after" set is taken, THE Check_Browser SHALL choose the theme through the Theme_Switch, and SHALL NOT set `data-theme` directly.
7. WHEN the "after" files exist, THE author SHALL inspect each of the 24 files and fix every defect found, and SHALL retake each file that changed, for up to 3 rounds of inspection. A defect is any of the following:
   - two text or control boxes that overlap;
   - text cut off by its container;
   - a horizontal scrollbar;
   - text below 4.5:1 contrast with its background, or a graphic that carries meaning below 3:1;
   - two adjacent controls less than 8 CSS pixels apart.
8. THE Build_Log SHALL list each defect found in the "after" inspection, with the file name and how it was fixed, or state that none were found. IF a defect remains after 3 rounds, THEN THE Build_Log SHALL list it as unfixed with the file name.
9. EACH of the three Screenshot_Views below SHALL show the content named for it, in the "before" set and in the "after" set:
   - `weave-lost` SHALL show at least 1 lost card and the repair panel.
   - `keep-versions` SHALL show at least 1 design with 2 or more versions.
   - `code-diff` SHALL show a diff with at least 1 changed pick.
10. IF a capture fails, a Screenshot_View cannot be brought to the content required by Acceptance Criterion 9, or the 24 files are not present and valid, THEN THE Check_Browser SHALL name each file that is missing or failed, SHALL keep every file already saved, and SHALL exit with a non-zero status. For the "before" set, Stage A SHALL NOT start until the 24 files are present and valid.
11. WHEN a Screenshot_Set is taken, THE Check_Browser SHALL verify that it holds exactly the 24 file names from Acceptance Criterion 3, that each file is a valid PNG, and that each file's width in pixels equals its `<width>`.

### Requirement 25: Process, records and final report

**User Story:** As the owner of the repository, I want each stage committed, the checks run and the work written up, so that I can review the pass stage by stage.

#### Acceptance Criteria

1. WHEN a Stage (A, B, C or D) is complete, THE author SHALL make exactly one commit for that Stage on the branch `auto/build`, so that the branch holds four Stage commits for this pass, in the order A, B, C, D.
2. IF `npm run typecheck` or `npm run test:run` exits with a non-zero status, THEN THE author SHALL NOT make the commit for that Stage, SHALL fix the cause, and SHALL run both commands again until both exit with status 0.
3. WHEN Stage D is committed, THE author SHALL push the branch `auto/build` to its remote, and the remote branch head SHALL equal the Stage D commit.
4. IF the push of `auto/build` fails, THEN THE author SHALL keep the local commits unchanged, SHALL NOT force-push, and SHALL state in the final report that the push failed and why.
5. WHEN Stage D is complete, THE author SHALL run `npm run check:browser` once and `npm run check:all` once, and SHALL report for each command its exit status and the names of any failing checks.
6. IF `npm run check:browser` or `npm run check:all` reports a failure, THEN THE author SHALL list that failure in the final report under "anything not done" or with its fix, and SHALL NOT edit a check to make it pass.
7. THE Build_Log SHALL receive exactly one new entry for this pass, and that entry SHALL contain: the Font_Weight_Report, the licence record, the bundle sizes of Requirement 15, the contrast table of Requirement 5, the benchmark decision of Requirement 19 and the "after" inspection of Requirement 24.
8. THE Kiro_Usage SHALL receive an update that states how Kiro was used in this pass, in at least one sentence for each of Stages A, B, C and D.
9. THE README SHALL list the name, the licence and the credit line for each font of Requirement 2, and the number of listed fonts SHALL equal the number of font families in the Font_Files.
10. THE Illustrations and styles added in this pass SHALL add no entry to `dependencies` or `devDependencies` in `package.json`.
11. WHEN Stage D is complete and the checks of criterion 5 have run, THE author SHALL write a final report that lists: the screenshot file paths, the Entry_Chunk size in bytes before and after, each contrast failure with its fix, anything not done, the one item to look at first, and the credits used.
12. WHEN the final report is delivered, THE author SHALL stop, and SHALL NOT start a second pass or make further commits on `auto/build` in the same run.
