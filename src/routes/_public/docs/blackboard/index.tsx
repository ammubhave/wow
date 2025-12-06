import {createFileRoute} from "@tanstack/react-router";

import screenshot from "./screenshot.png";

export const Route = createFileRoute("/_public/docs/blackboard/")({component: RouteComponent});

function RouteComponent() {
  return (
    <>
      <h1>Blackboard</h1>
      <p>
        <strong>
          Blackboard is a powerful tool designed to streamline your puzzle hunt experience.
        </strong>
        It provides a centralized platform for managing puzzles, tracking progress, and coordinating
        with your team.
      </p>
      <p>
        <img
          src={screenshot}
          alt="Screenshot of the Blackboard in WOW"
          className="rounded-lg max-w-[33rem] mx-auto"
        />
      </p>
      <p>
        <strong>Key features of Blackboard include:</strong>
      </p>
      <ul>
        <li>
          <strong>Puzzle Organization:</strong> Create and manage multiple rounds and puzzles within
          each round.
        </li>
        <li>
          <strong>Status Tracking:</strong> Monitor the progress of each puzzle, including whether
          it's "Needs Eyes," "In Progress," "Stuck," or "Backsolved."
        </li>
        <li>
          <strong>Team Coordination:</strong> Assign puzzles to team members and track who is
          working on each one.
        </li>
        <li>
          <strong>Puzzle Details:</strong> View detailed information about each puzzle, including
          its name, solution, and current status.
        </li>
      </ul>

      <p>
        <strong>With Blackboard, you can:</strong>
      </p>

      <ul>
        <li>
          <strong>Improve Team Efficiency:</strong> Keep track of puzzle assignments and progress to
          ensure everyone is on the same page.
        </li>
        <li>
          <strong>Streamline Puzzle Management:</strong> Organize your puzzles into rounds and
          categories for easy navigation.
        </li>
        <li>
          <strong>Enhance Collaboration:</strong> Coordinate with your team members by assigning
          puzzles and tracking their status.
        </li>
      </ul>

      <p>
        <strong>
          Experience the benefits of Blackboard and elevate your puzzle hunt experience.
        </strong>
      </p>
    </>
  );
}
