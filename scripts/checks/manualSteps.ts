/**
 * The steps of `npm run check:manual`. Data only.
 *
 * The five steps whose id starts with "R" copy their `instructions` word for word from the
 * "Manual checks" list in the task 3.9 entry of docs/BUILD_LOG.md (the text after "- ").
 * tests/scripts/manualSteps.test.ts reads the log and fails if the two drift apart.
 */

export const DEPLOYED_URL = 'https://naqsha-ashen.vercel.app/';

export type ManualStep = {
  /** Unique id, used by `--only <id>`. Matched without regard to letter case. */
  id: string;
  title: string;
  /** Exact instructions shown to the person. */
  instructions: string;
  expected: string;
  /** What a "fail" answer means. */
  failMeans: string;
};

/** Ids of the five items that the build log lists as manual checks. */
export const BUILD_LOG_STEP_IDS = ['R23.1', 'R23.11', 'R8.8', 'R14.12', 'R16.5'] as const;

export const MANUAL_STEPS: readonly ManualStep[] = [
  {
    id: 'live-camera',
    title: 'Live camera on the phone',
    instructions: [
      `1. On the phone, open ${DEPLOYED_URL} in Chrome (Android) or Safari (iPhone), then open the Scan screen.`,
      '2. Press "Use the camera". Expect the browser to ask for permission. Allow it.',
      '3. Expect the rear camera, not the selfie camera, and a live picture inside the dashed frame.',
      '4. Hold a card flat inside the frame and press "Take picture". Expect the picture to be read and the marks to appear on the hook positions.',
      '5. Expect the camera light (the small indicator, or the camera icon in the browser bar) to go off right after the capture. Open the camera again, then press "Close the camera" or switch to Weave: expect the light off again.',
      '6. Denied permission: in the browser site settings, block the camera for this site, reload, press "Use the camera". Expect the message "The camera is blocked. Allow the camera for this page in your browser, or choose a photo instead." and the photo chooser still working.',
      '7. HTTP fallback: open the same app over plain http (for example `npm run dev -- --host` and the http://<laptop address>:5173 address on the phone). Expect the message "The camera needs a secure page (https). Choose a photo instead." and the photo chooser still working.',
    ].join('\n'),
    expected:
      'Permission prompt, rear camera, capture and read work; the light goes off after capture and on leaving; the denied and http cases show the stated messages and offer the photo chooser.',
    failMeans:
      'The live camera (Requirement 18) does not work on a real phone: a wrong camera, no read, a light left on, or a missing or wrong message. Write which sub-step failed in the note.',
  },
  {
    id: 'print-100',
    title: 'Print the Diamond card at 100% and measure it',
    instructions: [
      '1. Open the app, go to Try it, choose "Diamond", then on the printable card press "Download PNG".',
      '2. Open the PNG in an image viewer or browser and print it. In the print dialog set the scale to 100% (not "fit to page", not "shrink to fit"), plain paper, no margins scaling.',
      '3. With a ruler in millimetres, measure the card outline: width and height.',
      '4. Expect 60 mm by 45 mm. Allow a ruler reading error of about 1 mm.',
    ].join('\n'),
    expected: 'The printed card measures 60 mm x 45 mm.',
    failMeans:
      'The PNG pixel density or the printable layout is wrong, or your printer scaled the page. Reprint at 100% once before you answer fail, and write the measured size in the note.',
  },
  {
    id: 'card-photo',
    title: 'Read a real photo of the printed card, and tap correction',
    instructions: [
      '1. Use the card printed in the previous step. Lay it flat on a plain, dark or light, matt background in even light (no shadow across it, no glare).',
      '2. Take a photo with the whole card in view, from straight above.',
      '3. Open the Scan screen, choose the photo (or use the camera), and wait for the marks.',
      '4. Expect a filled disc on every punched hook position and an empty ring on every other one, matching the printed card.',
      '5. Tap one mark. Expect it to change state and show the diamond badge, and the "Changes made by you" count to go up by one. Tap it again and expect the count to go back down.',
    ].join('\n'),
    expected: 'The photo is read and matches the printed card; a tap changes one mark and the count follows.',
    failMeans:
      'Reading a real photo (not a generated fixture) fails or gives wrong holes, or tap correction does not work on a touch screen. Write how many marks were wrong in the note.',
  },
  {
    id: 'rise',
    title: 'Rise-from-darkness look and speed on the first weave',
    instructions: [
      `1. Open ${DEPLOYED_URL} in a fresh tab, go to Try it, choose a sample (for example "Diamond"), then go to Weave.`,
      '2. Watch the first weave of that design: the cloth should rise out of darkness as it is woven.',
      '3. Judge the look (smooth, not flickering or jumping) and the speed (long enough to notice, short enough not to make you wait).',
    ].join('\n'),
    expected: 'A smooth rise out of darkness that takes a comfortable time and then settles on the normal cloth.',
    failMeans: 'The rise (Requirement 20) flickers, jumps, is too slow or too fast, or never ends. Describe it in the note.',
  },
  {
    id: 'focus-skip',
    title: 'Keyboard focus after Skip',
    instructions: [
      '1. On a computer with a keyboard, open the Weave screen and start a first weave (the rise from darkness runs).',
      '2. While the rise runs, press Tab until the "Skip fade-in" button has the focus ring, then press Enter.',
      '3. Expect the rise to end, the Skip button to disappear, and the keyboard focus ring to be on the Pause button (or the Play button if the cloth is not playing), not lost on the page.',
      '4. Press Tab once more and expect the focus to move on to the next control, not back to the top of the page.',
    ].join('\n'),
    expected: 'After Skip, focus lands on Pause or Play and Tab continues from there.',
    failMeans: 'A keyboard user loses their place after Skip. This is the accessibility gap fixed in task 6.1 and it is not fixed in practice.',
  },
  {
    id: 'reduced-motion',
    title: 'Reduced motion in the operating system settings',
    instructions: [
      '1. Turn on reduced motion: macOS System Settings > Accessibility > Display > Reduce motion; Windows Settings > Accessibility > Visual effects > Animation effects off; Android Settings > Accessibility > Remove animations; iPhone Settings > Accessibility > Motion > Reduce Motion.',
      '2. Reload the app, go to Try it, choose a sample, then go to Weave.',
      '3. Expect no fade or rise from darkness, no "Skip fade-in" button, and the finished cloth shown at once.',
      '4. Turn the setting back off if you want the animation again.',
    ].join('\n'),
    expected: 'No fade, no Skip button, the finished cloth at once.',
    failMeans: 'The app ignores the reduced-motion setting (Requirement 20). Write the operating system and browser in the note.',
  },
  {
    id: 'indexeddb',
    title: 'IndexedDB in a real browser, including private browsing',
    instructions: [
      `1. Open ${DEPLOYED_URL} in a normal window, scan or choose a design, go to Keep, and save it with a name.`,
      '2. Reload the page. Expect the design in the list. Open it. Delete it, reload, and expect it gone.',
      '3. Save one again, then clear the site data in the browser settings and reload. Expect an empty list and a working app.',
      '4. Open the site in a private (incognito) window and try to save a design. Expect either a saved design that lasts for that window, or a clear message that saving is not available. The app must not break or lose what you typed.',
    ].join('\n'),
    expected: 'Save, reload, open and delete work; clearing site data gives an empty list; private browsing either works or shows a clear message.',
    failMeans: 'The archive loses data on reload, breaks after clearing site data, or crashes or stays silent in private browsing.',
  },
  {
    id: 'hindi',
    title: 'Hindi text review sanity',
    instructions: [
      '1. Open docs/HINDI_REVIEW.md. The line "Unreviewed strings: N" is shown above this step; N is how many Hindi strings are not yet marked as reviewed.',
      '2. Ask: has a native Hindi speaker reviewed these strings, and was `reviewed` set to true in src/ui/i18n/hi.json for each string they approved?',
      '3. Answer pass only if a native speaker has reviewed all of them (N is 0). Answer skip if no native speaker has looked yet.',
    ].join('\n'),
    expected: 'A native Hindi speaker has reviewed every string and N is 0.',
    failMeans: 'A native speaker found wrong or unnatural Hindi, or strings are still unreviewed after a review. Write the keys in the note.',
  },
  {
    id: 'R23.1',
    title: 'Public URL needs no login, account or API key (R23.1)',
    instructions:
      "**23.1 Public URL needs no login, account or API key.** Open https://naqsha-ashen.vercel.app/ in a private browser window on a phone and on a laptop. Expect the Weave screen with no login or sign-up prompt. Open the browser's network tab, reload, and expect only requests to the same host (the page, its scripts and styles, and `profiles/demo-12x16.json`). This also covers the \"served by the Deploy_Host\" half of R23.7; the built files are checked by an automatic test.",
    expected: 'The Weave screen with no login prompt, and only same-host requests.',
    failMeans: 'The public site asks for a login or key, or calls another host.',
  },
  {
    id: 'R23.11',
    title: 'Media were captured from the running Built_Site (R23.11)',
    instructions:
      '**23.11 Media were captured from the running Built_Site with the demo profile and show the notice.** Open `media/scan-printed-card.gif` and `media/keep-export.gif` on GitHub (or a browser) and watch each to the end. Expect the Card_Profile name `demo-12x16` and the "Unverified" notice with the status text visible on every Scan and Keep frame. Open `media/weave-sample.gif` and expect a Sample_Design weaving pick by pick. This step also checks what each GIF shows for R23.9 and R23.10; the automatic tests only check that the files exist, are GIF or PNG, are referenced in the README and are at most 5 MB.',
    expected: 'The profile name and the Unverified notice on every Scan and Keep frame; the weave GIF weaves pick by pick.',
    failMeans: 'A GIF is missing the notice or the profile name, or was not captured from the running site.',
  },
  {
    id: 'R8.8',
    title: 'Reading a 1080p photo takes 300 ms or less on a phone (R8.8)',
    instructions:
      '**8.8 Reading a 1080p photo takes 300 ms or less on a mid-range 2020 phone.** Run `npm run build` and `npm run preview -- --host`, open the address on the phone, choose a 1920 x 1080 photo of the printed card on the Scan screen, and time the wait from choosing the file to the markers appearing (screen recording at 60 fps, count frames). Expect 300 ms or less. Laptop figure for comparison: median 24 ms (task 3.5).',
    expected: '300 ms or less from choosing the file to the markers appearing.',
    failMeans: 'The hole detection budget in tech.md is missed on a real phone. Write the measured time in the note.',
  },
  {
    id: 'R14.12',
    title: 'No horizontal page scroll from 320 to 1920 CSS pixels (R14.12)',
    instructions:
      "**14.12 No horizontal page scroll from 320 to 1920 CSS pixels.** Open the deployed site in a desktop browser, open the device toolbar, set the width to 320, 360, 600, 1024 and 1920 in turn, and visit Weave, Keep and Scan (with a photo read) in English and Hindi. Expect no horizontal scrollbar and no clipped control at any width. Repeat once on a real phone in portrait.",
    expected: 'No horizontal scrollbar and no clipped control at any width, in English and Hindi.',
    failMeans: 'A screen scrolls sideways or clips a control at some width. Write the screen, language and width in the note.',
  },
  {
    id: 'R16.5',
    title: 'Cloth simulation within 16 ms per painted frame (R16.5)',
    instructions:
      '**16.5 Cloth simulation of a 100-pick Pattern stays within 16 ms per painted frame.** On a phone, open `scripts/sim-preview.html` through `npx vite --host`, load a 100-pick pattern, play it, and read the median and worst frame times the page shows. Expect 16 ms or less per painted frame. The Node figures in `.kiro/specs/simulator/measurements.md` do not stand in for this.',
    expected: '16 ms or less per painted frame.',
    failMeans: 'The 60 fps budget in tech.md is missed on a real phone. Write the median and worst times in the note.',
  },
];

export function findStep(id: string): ManualStep | undefined {
  const wanted = id.trim().toLowerCase();
  return MANUAL_STEPS.find((step) => step.id.toLowerCase() === wanted);
}
