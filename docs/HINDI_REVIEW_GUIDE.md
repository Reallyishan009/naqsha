# Hindi review guide

For a Hindi speaker who reviews the text of Naqsha. No technical knowledge needed.

**What to do**
1. Open `docs/hindi-review-sheet.csv` in Google Sheets or Excel (it is UTF-8).
2. Start with Priority 1 rows (header and the Landing page, the first thing a visitor sees), then 2, 3, 4.
3. Read the English and the Hindi now. In "Verdict" write OK or Change. If Change, write the better Hindi in the next column.
4. Do not change the Key column. Keep anything inside curly brackets, such as `{count}`, exactly as it is: the app fills those in.
5. Do not worry about the text being short. Buttons and labels have little room.

**Questions that need your judgement** (write the answer in the Note column of the nearest row)
- "Pick" (one row of weaving, one card) is written "पिक". Is there a word weavers or card makers use, such as "बाना" or "पंक्ति"?
- "Card" is written "कार्ड". Do weavers say "पत्ता", "कार्ड" or something else for a Jacquard card?
- "Loom" is written "करघा". Is that right for a Jacquard loom?
- The app name नक्शा: is "नक्शा" or "नक़्शा" better? Weavers in Banaras and Lucknow may say "नक्शा" for the design on a card. Is that how it is used?
- "Hook", "end", "naksha" and "naqshband" are weaving terms. Are the Hindi forms understandable to a weaver?
- Does the tone feel polite and clear, or too formal?

**After the review**
Send the sheet back. Someone then sets `reviewed: true` for each approved string in `src/ui/i18n/hi.json` and fixes the changed ones. Until that happens the README says the Hindi is unreviewed, and that stays true.
