import screenshot from "./screenshot.png";

export default function Page() {
  return (
    <>
      <h1>Discord Integration</h1>
      <p>
        <strong>
          Enhance your puzzle hunt experience with WOW's Discord integration.
        </strong>
      </p>
      <p>
        By connecting your Discord server to your WOW workspace, you can
        automatically manage a list of active voice channels corresponding to
        each puzzle. This simplifies communication and coordination among your
        team members.
      </p>
      <p>
        <strong>Key benefits</strong>
      </p>
      <ul>
        <li>
          <strong>Automated Voice Channel Creation:</strong> Automatically
          generate new voice channels for each puzzle you add.
        </li>
        <li>
          <strong>Organized Communication:</strong> Keep all puzzle-related
          discussions within dedicated voice channels.
        </li>
        <li>
          <strong>Easy Access:</strong> Quickly join relevant voice channels to
          connect with your team members.
        </li>
      </ul>
      <h2>How it works</h2>
      <p>
        <img
          src={screenshot}
          alt="Screenshot of the Discord integration in WOW"
          className="rounded-lg max-w-[33rem] mx-auto"
        />
      </p>
      <p>
        You can link your Discord server to your WOW workspace through your
        workspace settings.
      </p>
      <p>
        Once you've completed these steps, WOW will automatically create a new
        voice channel for each puzzle you add. This ensures that all
        puzzle-related discussions are organized and easily accessible.
      </p>
      <h2>Troubleshooting</h2>
      <p>
        If you encounter any issues with the Discord integration, please check
        the following:
      </p>
      <ul>
        <li>
          <strong>Discord Permissions:</strong> Ensure that WOW has the
          necessary permissions to create and manage voice channels on your
          server.
        </li>
        <li>
          <strong>Workspace Settings:</strong> Verify that your Discord server
          is correctly linked to your WOW workspace.
        </li>
        <li>
          <strong>Network Connectivity:</strong> Check your internet connection
          to ensure stable communication with Discord.
        </li>
      </ul>
      <p>
        If you continue to experience problems, please contact our support team
        for assistance.
      </p>
      <p>
        <strong>
          Experience the convenience of automated voice channel management with
          WOW's Discord integration today!
        </strong>
      </p>
    </>
  );
}
