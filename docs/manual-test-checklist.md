# Manual Test Checklist

## Dialog focus (Add record and record details)

Run `npm run dev` and check both dialogs: "Add record" (New disbursement, signed in as an organization or admin) and the record details dialog. Use only the keyboard unless a step says otherwise. Repeat the checks in Safari if you can.

- [ ] Entry points: "Add record", "View" in the Public Transparency table, "View" in the Beneficiary Records table, and "View record" in My Activity.
- [ ] Open each dialog with Enter or Space, and with a mouse click. Focus moves to the dialog's first control (its close button), and a screen reader announces the dialog's name. Only that button shows a focus outline, not the whole dialog.
- [ ] Tab and Shift+Tab move only through the dialog's controls and wrap at both ends. Pressing Tab 20 times never reaches the top bar, the section tabs, or the page behind. This also holds for a dialog with one control (record details while signed out).
- [ ] In Chrome and Firefox, Tab still moves between the month, day, and year parts of the "Disbursement date" field.
- [ ] While a dialog is open, the header, main content, and footer (the other children of `div.app`) have `inert`, and the dialog is not inside an inert element. `div.app` itself is not made inert, because the dialogs render inside it.
- [ ] Escape closes the dialog.
- [ ] The X button, Cancel (Add record), and a click on the backdrop close the dialog. A click inside the dialog does not. Closing the record details also clears the edit-conflict banner.
- [ ] After any close, focus goes to the "Add record" button or to the record's View button, also on a later ledger page (Next) and after the record was refreshed while the dialog was open (Verify, Save changes). After opening from My Activity, that is the View button in the Public Transparency table.
- [ ] If that button is not on the page (after Confirm void, the ledger reloads at page 1), focus goes to the active section tab.
- [ ] Record details: typing in the edit fields, Save changes, Verify, and Reload latest keep the dialog open and focus inside it. When Reload latest removes its own button, focus moves to the dialog.
- [ ] Add record: values typed before closing are still there after reopening. Publish record saves, shows a disabled "Saving…" button while busy, and closes the dialog.
- [ ] Focus outlines stay visible on dialog controls.
- [ ] After closing, `inert` is removed: the header, filters, and table can be clicked and tabbed to again.
- [ ] Other flows (sign-in, filters, ledger Previous and Next, admin Load more, toasts, and admin tabs) behave as before.
