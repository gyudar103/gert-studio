GERT Studio 0.2.0 - Windows portable preview

Preview for review: clean-machine validation is pending.

1. Extract the entire ZIP to a folder you can access.
2. Double-click "GERT Studio.exe".
3. GERT Studio opens in your default browser.

Keep the small GERT Studio control window open while working.
Choose Load demo, Validate, then Run Simulation to try an example.
Export JSON to save your project. Import JSON to load it again.
When current results exist, Export JSON saves a simulation snapshot including the
used settings, exact seed, versions, and results. Import restores saved results
without rerunning; model or settings edits clear them.
Incomplete drafts and node/activity/outcome notes can also be saved and reloaded.
Supply all missing duration and probability inputs before running a simulation.
Export before refreshing the browser, closing a tab, or exiting the application.
Use Exit GERT Studio in the control window to stop the local server.
Closing a browser tab alone does not stop it. Double-clicking the EXE again
opens the running application in a browser; each tab has its own editor state.
Drag the workspace separators to resize panels, or focus them and use arrow keys.
Panel sizes persist locally across restarts; Reset layout restores the defaults.
Model data still requires Export JSON. Expand result uncertainty details for
sample SD, Monte Carlo SE, and method-labelled 95% confidence intervals.

No Python, Node.js, npm, Git, Docker, or administrator access is needed to run.
The application works offline in your installed browser.
Keep the _internal folder beside the EXE; do not run directly inside the ZIP.

If the browser does not open, use Open GERT Studio in the control window or
copy the displayed local address into a browser.
Startup logs: %LOCALAPPDATA%\GERT Studio\launcher.log
If the frontend cannot reach the backend, check the control window or relaunch
this EXE.

This is an unsigned build. Follow your organization's policy for downloaded apps.
Do not disable security software. Only run releases from a source you trust.
