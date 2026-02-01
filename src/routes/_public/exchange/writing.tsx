import {createFileRoute, Link} from "@tanstack/react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {Card} from "@/components/ui/card";

export const Route = createFileRoute("/_public/exchange/writing")({component: RouteComponent});

function RouteComponent() {
  return (
    <div className="flex flex-1 flex-col gap-4 items-stretch justify-center max-w-5xl">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/exchange">Hunts</Link>} />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Writing</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <h1 className="text-2xl font-bold mb-4 text-center">Wafflehaüs's Guide to Writing Puzzles</h1>
      <Card className="flex-1 p-8">
        <div className="prose max-w-full">
          <p>
            <i>Congratulations on writing a puzzle for the Wafflehaüs Puzzle Exchange!</i>
          </p>
          <p>
            Your job is to write one <b>approachable, short, and hunt-length puzzle</b> in the next
            month.
          </p>
          <ul>
            <li>
              <b>Approachable:</b> It’s easy to get started!
            </li>
            <li>
              <b>Short:</b> It’s relatively short for Mystery Hunt…
            </li>
            <li>
              <b>Hunt-length:</b> ... but it’s still a Mystery Hunt puzzle!
            </li>
          </ul>
          <p>
            You’ll have a puzzle ~editor~ who is more experienced with writing puzzles. They will
            help with anything! Please let them help you! Seriously, it’s so much easier to bounce
            ideas off of someone than to do it all yourself. Ask for help!
          </p>
          <p>
            <h1>Puzzle Writing Process</h1>
          </p>
          <p>
            <h2>Getting Started</h2>
          </p>
          <i>Aim for finishing this by the 7th of the month.</i>
          <p>
            First, pick something about a puzzle that inspires you. This can be a theme, a mechanic,
            an extraction method, or a fun (relatively accessible) rabbit hole that you enjoy.
          </p>
          <p>
            Then, flesh out the high-level steps of the puzzle. Talk to your ~editor~ about this.
            They’ll help make sure it makes sense as a puzzle before you start on the hard work.
          </p>
          <p>
            Decide whether you want to aim for an answer or not. You can either see what answer pops
            out or you can have an answer chosen beforehand (hard mode!)
          </p>
          <p>
            <h2>Construction</h2>
          </p>
          <i>Aim for finishing the first iteration by the 14th of the month.</i>
          <p>
            Construction is usually the hard time-consuming part and where you’ll learn the most.
            Depending on your puzzle, you may have to do a lot of research!
          </p>
          <p>
            If you think you’re going too deep, talk to your ~editor~! If you get stuck, talk to
            your ~editor~! If it’s getting complicated, talk to your ~editor~! Most puzzles can be
            constructed to work for an answer. However, it’s really hard to make it work{" "}
            <i>nicely</i>.
          </p>
          <p>After finishing construction, write a quick and minimal solution.</p>
          <p>
            <h2>Test Solving Loop</h2>
          </p>
          <i>Aim for finishing this by the 28th of the month - ideally before.</i>
          <p>
            After you’ve constructed your puzzle, your ~editor~ will test solve your puzzle. They
            will have feedback for you, which may or may not require reconstructing your entire
            puzzle. Yup, this is normal and expected. Loop back to the Construction phase.
          </p>
          <p>
            Once you’re done with test solving, usually over multiple rounds of feedback, then you
            can move on.
          </p>
          <p>
            <h2>Polishing</h2>
          </p>
          <i>Finish by the last day of the month!</i>
          <p>
            Create a polished version of the puzzle. Usually, this means moving the puzzle from a
            spreadsheet into a presentable PDF - your ~editor~ can help with this.
          </p>
          <p>Write up a complete solution.</p>
          <p>
            <h1>Puzzle Writing Advice</h1>
          </p>
          <p>
            The first tenet of writing puzzles: <b>You want your solvers to solve your puzzles!</b>
          </p>
          <p>
            Your puzzles should have a <b>“theming”</b> and a <b>“mechanic”.</b> Usually, these can
            be separate aha moments!
          </p>
          <p>Try to have at least three of these qualities:</p>
          <ul>
            <li>Mechanics motivated by the theme</li>
            <li>Theme that isn’t the obvious theme</li>
            <li>Data viewed not the obvious way</li>
            <li>Data that isn’t words in grids</li>
            <li>Indexing that isn’t “read the first letters”</li>
            <li>Re-ordering of clues</li>
            <li>Do the same thing but deeper</li>
            <li>One moment that makes your solver chuckle</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
