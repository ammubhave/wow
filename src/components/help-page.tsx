export function HelpPage() {
  return (
    <div className="flex justify-center prose">
      <div className="max-w-4xl">
        <h2>Help Page</h2>
        <p />
        <h4>Swipe between pages</h4>
        <p>
          To turn off swipe between pages on Chrome, visit this link to toggle the option:
          chrome://settings/?search=swipe+between+pages
        </p>
        <p />
        <h4>Shortcut Command Bar</h4>
        <p>
          Press <code>Cmd + K</code> (Mac) or <code>Ctrl + K</code> (Windows) to open the command
          bar. From there, you can quickly navigate to different sections of the app or perform
          actions.
        </p>
        <p />
        <h4>File issues</h4>
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
