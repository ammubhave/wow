import {Button, Chip, Kbd as HeroKbd} from "@heroui/react";
import {Link} from "@tanstack/react-router";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CompassIcon,
  CrownIcon,
  InfoIcon,
  LightbulbIcon,
  LinkIcon,
  SmartphoneIcon,
  TriangleAlertIcon,
} from "lucide-react";
import {Children, isValidElement} from "react";
import {cn} from "tailwind-variants";

import {useTour} from "@/features/tour/tour-provider";
import {GOOGLE_FORMULAS, PUZZLE_FORMULA_GROUPS} from "@/lib/formula-docs";
import {getPuzzleImportances} from "@/lib/puzzleImportances";
import {getPuzzleStatusGroups} from "@/lib/puzzleStatuses";

import {useDocHref} from "./docs-base";

/**
 * The building blocks docs pages are written with (MDX), and how plain Markdown renders. Links to
 * /docs/… stay inside whichever docs the reader is in (public, or a workspace's Help tab).
 */

function Anchor({href = "", children, ...props}: React.ComponentProps<"a">) {
  const docHref = useDocHref();
  if (href.startsWith("/docs")) {
    return (
      <Link to={docHref(href)} className="text-accent underline-offset-4 hover:underline">
        {children}
      </Link>
    );
  }
  if (href.startsWith("#") || href.startsWith("/")) {
    return (
      <a href={href} className="text-accent underline-offset-4 hover:underline" {...props}>
        {children}
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent inline-flex items-baseline gap-0.5 underline-offset-4 hover:underline"
      {...props}>
      {children}
      <ArrowUpRightIcon className="size-3 self-center" aria-hidden="true" />
    </a>
  );
}

/** A section heading that links to itself (hover to see the link). */
function heading(Tag: "h2" | "h3") {
  return function Heading({id, children}: React.ComponentProps<"h2">) {
    return (
      <Tag id={id} className="group scroll-mt-6">
        {children}
        {id && (
          <a
            href={`#${id}`}
            aria-label="Link to this section"
            className="text-muted ms-2 inline-block align-middle opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
            <LinkIcon className="size-4" />
          </a>
        )}
      </Tag>
    );
  };
}

function Table(props: React.ComponentProps<"table">) {
  return (
    <div className="border-separator overflow-x-auto rounded-xl border">
      <table
        className="[&_tr]:border-separator w-full border-collapse text-sm [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_th]:font-semibold [&_thead]:bg-[var(--surface-secondary)] [&_tr+tr]:border-t"
        {...props}
      />
    </div>
  );
}

function InlineCode(props: React.ComponentProps<"code">) {
  return (
    <code
      className="bg-default rounded px-1.5 py-0.5 font-mono text-[0.85em] font-medium"
      {...props}
    />
  );
}

/** Tips, notes and warnings set apart from the text. */
export function Callout({
  type = "note",
  title,
  children,
}: {
  type?: "note" | "tip" | "warning" | "phone";
  title?: string;
  children: React.ReactNode;
}) {
  const {Icon, tone} = {
    note: {Icon: InfoIcon, tone: "border-accent/30 bg-accent/5 [&_svg]:text-accent"},
    tip: {Icon: LightbulbIcon, tone: "border-success/30 bg-success/5 [&_svg]:text-success"},
    warning: {Icon: TriangleAlertIcon, tone: "border-warning/40 bg-warning/5 [&_svg]:text-warning"},
    phone: {Icon: SmartphoneIcon, tone: "border-separator bg-default/40 [&_svg]:text-muted"},
  }[type];
  return (
    <aside className={cn("not-prose flex gap-3 rounded-xl border p-4 text-sm", tone)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1.5 [&_p]:m-0">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </aside>
  );
}

/** Numbered steps: wrap a Markdown numbered list. */
export function Steps({children}: {children: React.ReactNode}) {
  return (
    <div className="[&_ol]:ms-0 [&_ol]:list-none [&_ol]:ps-0 [&_ol]:[counter-reset:step] [&_ol>li]:relative [&_ol>li]:ps-10 [&_ol>li]:[counter-increment:step] [&_ol>li]:before:absolute [&_ol>li]:before:start-0 [&_ol>li]:before:top-0 [&_ol>li]:before:flex [&_ol>li]:before:size-7 [&_ol>li]:before:items-center [&_ol>li]:before:justify-center [&_ol>li]:before:rounded-full [&_ol>li]:before:bg-[var(--accent)] [&_ol>li]:before:text-xs [&_ol>li]:before:font-bold [&_ol>li]:before:text-[var(--accent-foreground)] [&_ol>li]:before:content-[counter(step)] [&_ol>li+li]:mt-4">
      {children}
    </div>
  );
}

/** A key, or keys pressed together: <Kbd>⌘ K</Kbd>. */
export function Kbd({children}: {children: React.ReactNode}) {
  return <HeroKbd>{children}</HeroKbd>;
}

/** Where something is in the app: <UiPath path="Settings > General > Look" />. */
export function UiPath({path}: {path: string}) {
  const parts = path.split(">").map(part => part.trim());
  return (
    <span className="bg-default inline-flex flex-wrap items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.9em] font-medium">
      {parts.map((part, i) => (
        <span key={part} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-muted">›</span>}
          {part}
        </span>
      ))}
    </span>
  );
}

/** Marks something only workspace owners can do. */
export function OwnerOnly() {
  return (
    <Chip size="sm" variant="soft" color="warning" className="align-middle">
      <CrownIcon className="size-3" aria-hidden="true" />
      <Chip.Label>Owners only</Chip.Label>
    </Chip>
  );
}

/** A screenshot with a caption. */
export function Screenshot({
  src,
  alt,
  caption,
  narrow,
}: {
  src: string;
  alt: string;
  caption?: string;
  /** A phone screenshot (shown smaller). */
  narrow?: boolean;
}) {
  return (
    <figure className="not-prose flex flex-col gap-2">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn(
          "border-separator rounded-xl border shadow-sm",
          narrow ? "mx-auto w-72 max-w-full" : "w-full"
        )}
      />
      {caption && <figcaption className="text-muted text-center text-xs">{caption}</figcaption>}
    </figure>
  );
}

/**
 * Starts the guided tour of the workspace. In a workspace's Help tab only (the public docs have no
 * workspace to tour).
 */
export function TakeTheTour() {
  const tour = useTour();
  if (!tour) return null;
  return (
    <aside className="not-prose border-accent/30 bg-accent/5 flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm">
      <CompassIcon className="text-accent size-5 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">New here?</span>
        <span className="text-muted">
          A few minutes' guided tour of this workspace, pointing at the real thing.
        </span>
      </div>
      <Button size="sm" onPress={() => tour.start()}>
        {tour.isRunning ? "Restart the tour" : "Take the tour"}
      </Button>
    </aside>
  );
}

/** Cards linking to other pages ("pick your path"). */
export function Cards({children}: {children: React.ReactNode}) {
  return <div className="not-prose grid gap-3 sm:grid-cols-2">{children}</div>;
}

export function Card({
  to,
  title,
  children,
}: {
  to: string;
  title: string;
  children: React.ReactNode;
}) {
  const docHref = useDocHref();
  return (
    <Link
      to={docHref(to)}
      className="group border-separator hover:border-accent/50 hover:bg-accent/5 flex flex-col gap-1 rounded-xl border p-4 transition-colors">
      <span className="flex items-center justify-between gap-2 font-semibold">
        {title}
        <ArrowRightIcon
          className="text-muted group-hover:text-accent size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
      <span className="text-muted text-sm">{children}</span>
    </Link>
  );
}

/** The puzzle formulas, from the same list the sheet's Puzzle tools dialog uses. */
export function PuzzleFormulas() {
  return (
    <div className="not-prose flex flex-col gap-8">
      {PUZZLE_FORMULA_GROUPS.map(group => (
        <section key={group.title} className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold">{group.title}</h3>
          {group.formulas.map(formula => (
            <article
              key={formula.name}
              id={formula.name.toLowerCase()}
              className="border-separator flex scroll-mt-6 flex-col gap-2 rounded-xl border p-4">
              <code className="font-mono text-sm font-semibold">{formula.signature}</code>
              <p className="text-sm">{formula.what}</p>
              {formula.details && (
                <ul className="text-muted list-disc ps-5 text-sm">
                  {formula.details.map(detail => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
              <p className="text-sm">
                <span className="text-muted">Example: </span>
                <InlineCode>{formula.example}</InlineCode>
                <span className="text-muted"> → {formula.gives}</span>
              </p>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

/** The Google Sheets functions the built-in sheet adds. */
export function GoogleFormulas() {
  return (
    <Table>
      <thead>
        <tr>
          <th>Function</th>
          <th>What it does</th>
        </tr>
      </thead>
      <tbody>
        {GOOGLE_FORMULAS.map(formula => (
          <tr key={formula.name}>
            <td>
              <InlineCode>{formula.signature}</InlineCode>
            </td>
            <td>{formula.what}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** Every puzzle status, grouped, in the board's colours. */
export function StatusTable({meanings}: {meanings: Record<string, string>}) {
  return (
    <Table>
      <thead>
        <tr>
          <th>Status</th>
          <th>Group</th>
          <th>Use it when</th>
        </tr>
      </thead>
      <tbody>
        {getPuzzleStatusGroups().flatMap(group =>
          group.values.map(status => (
            <tr key={status.label}>
              <td>
                <span
                  className={cn(
                    "inline-block rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                    "bgColorNoHover" in group && group.bgColorNoHover
                  )}>
                  {status.label}
                </span>
              </td>
              <td className="text-muted">{group.groupLabel}</td>
              <td>{meanings[status.value ?? "none"] ?? ""}</td>
            </tr>
          ))
        )}
      </tbody>
    </Table>
  );
}

/** Every importance level, with its icon. */
export function ImportanceTable({meanings}: {meanings: Record<string, string>}) {
  return (
    <Table>
      <thead>
        <tr>
          <th>Importance</th>
          <th>Use it when</th>
        </tr>
      </thead>
      <tbody>
        {getPuzzleImportances().map(importance => (
          <tr key={importance.value}>
            <td>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5",
                  importance.color
                )}>
                {importance.icon}
                {importance.label}
              </span>
            </td>
            <td>{meanings[importance.value] ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** Markdown elements, and the components pages use, for MDX. */
export const MDX_COMPONENTS = {
  a: Anchor,
  h2: heading("h2"),
  h3: heading("h3"),
  table: Table,
  code: InlineCode,
  // A Markdown image on its own is a screenshot.
  img: ({src = "", alt = ""}: React.ComponentProps<"img">) => (
    <Screenshot src={String(src)} alt={alt} />
  ),
  Callout,
  Steps,
  Kbd,
  UiPath,
  OwnerOnly,
  Screenshot,
  Cards,
  Card,
  TakeTheTour,
  PuzzleFormulas,
  GoogleFormulas,
  StatusTable,
  ImportanceTable,
};

/** The text of a heading's children (for the table of contents). */
export const textOf = (children: React.ReactNode): string =>
  Children.toArray(children)
    .map(child =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : isValidElement<{children?: React.ReactNode}>(child)
          ? textOf(child.props.children)
          : ""
    )
    .join("");
