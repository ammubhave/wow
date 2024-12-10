import screenshot from "./screenshot.png";

export default function Page() {
  return (
    <>
      <h1>Google Drive Integration</h1>
      <p>
        <strong>
          Effortlessly streamline your puzzle hunt process with WOW's seamless
          Google Drive integration.
        </strong>
      </p>
      <p>
        By connecting your Google Drive account to your WOW workspace, you can
        automate the creation of new spreadsheets for each puzzle you add. This
        eliminates the manual task of setting up a new spreadsheet for every
        puzzle, saving you time and effort.
      </p>
      <p>
        <strong>Key benefits of the Google Drive integration:</strong>
      </p>
      <ul>
        <li>
          <strong>Automated Spreadsheet Creation:</strong> Automatically
          generate new spreadsheets based on your puzzle additions.
        </li>
        <li>
          <strong>Centralized Storage:</strong> Store all your puzzle-related
          spreadsheets in a designated Google Drive folder.
        </li>
        <li>
          <strong>Template Customization:</strong> Use a pre-designed template
          file to ensure consistency and efficiency.
        </li>
      </ul>
      <p>
        <strong>How it works:</strong>
      </p>
      <p>
        <img
          src={screenshot}
          alt="Screenshot of the Google Drive integration in WOW"
          className="rounded-lg max-w-[33rem] mx-auto"
        />
      </p>
      <ol>
        <li>
          <strong>Connect Your Google Drive Account:</strong> Link your Google
          Drive account to your WOW workspace.
        </li>
        <li>
          <strong>Select a Folder:</strong> Choose the Google Drive folder where
          you want to store your newly created spreadsheets.
        </li>
        <li>
          <strong>Select a Template File (Optional):</strong> If you have a
          preferred template for your spreadsheets, select it to be used for new
          puzzles.
        </li>
      </ol>
      <p>
        Once you've completed these steps, WOW will automatically create a new
        spreadsheet in your selected Google Drive folder whenever you add a new
        puzzle. This ensures that all your puzzle-related information is
        organized and easily accessible.
      </p>
      <p>
        <strong>
          Experience the convenience of automated puzzle creation with WOW's
          Google Drive integration today!
        </strong>
      </p>
    </>
  );
}
