import {ExternalLinkIcon} from "lucide-react";

export function HelpPage() {
  return (
    <div className="flex justify-center">
      <div className="flex max-w-4xl flex-1 flex-col gap-4 md:gap-8">
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          <h1 className="text-3xl font-semibold">Help Page</h1>
        </div>
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          <span className="font-bold">Swipe between pages</span>
          <div>
            To turn off swipe between pages on Chrome, visit this link to toggle the option.
            <br />
            chrome://settings/?search=swipe+between+pages
          </div>
          <span className="font-bold">Shortcut Command Bar</span>
          <div>
            Press <code>Cmd + K</code> (Mac) or <code>Ctrl + K</code> (Windows) to open the command
            bar. From there, you can quickly navigate to different sections of the app or perform
            actions.
          </div>
          <span className="font-bold">File issues</span>
          <div>
            File issues by talking to Amol or Allen or by filing a{" "}
            <a
              href="https://github.com/ammubhave/wow/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="gap-2">
              Github issue <ExternalLinkIcon />.
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
