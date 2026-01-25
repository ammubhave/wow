export function HelpPage() {
  return (
    <div className="flex justify-center prose">
      <div className="max-w-4xl">
        <h2>Help Page</h2>
        <p />
        <h4 id="swipe">Swipe between pages</h4>
        <p>
          To turn off swipe between pages on Chrome, visit this link to toggle the option:
          chrome://settings/?search=swipe+between+pages
        </p>
        <p />
        <h4 id="shortcut">Shortcut Command Bar</h4>
        <p>
          Press <code>Cmd + K</code> (Mac) or <code>Ctrl + K</code> (Windows) to open the command
          bar. From there, you can quickly navigate to different sections of the app or perform
          actions.
        </p>
        <p />
        <h4 id="wifi">MIT Wi-Fi Discord Voice Channel Issues</h4>
        <p>
          For anyone have issues connecting to Discord voice channels on MIT GUEST: If you are an
          MIT alum or associate, go to <a href="https://wifi.mit.edu/">https://wifi.mit.edu/</a> and
          use your alum login to get the password to "MIT" network. If you are not affiliated with
          MIT, then sign into eduroam with your home institution credentials (ask around to borrow
          one if you don't have one).
        </p>
        <p />
        <h4 id="403s">Fix 403s on Puzzle Page</h4>
        <p>
          If you are getting 403s when opening a puzzle spreadsheet, make sure that you are signed
          into the right Google account (see the top right corner of the page underneath your name).
          Then, open the spreadsheet link directly in a new tab (top right icon next to the puzzle
          name) then refresh the page.
        </p>
        <p />
        <h4 id="file-issues">File issues</h4>
        <p>
          File issues by talking to Amol or Allen or by filing a{" "}
          <a
            href="https://github.com/ammubhave/wow/issues"
            target="_blank"
            rel="noopener noreferrer">
            Github issue
          </a>
          .
        </p>
      </div>
    </div>
  );
}
