import {Command} from "@heroui-pro/react";
import {useNavigate} from "@tanstack/react-router";
import GithubSlugger from "github-slugger";
import {FileTextIcon, HashIcon} from "lucide-react";
import {useEffect, useState} from "react";

import {DOC_PAGES, DOC_SECTIONS, RAW_CONTENT, contentPath} from "../registry";
import {useDocHref} from "./docs-base";

type Heading = {slug: string; page: string; id: string; text: string};

/** A heading's text as the page shows it (Markdown links, code and emphasis stripped). */
const plain = (markdown: string) =>
  markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();

/** Every page's section headings, with the ids the page gives them (as rehype-slug does). */
async function loadHeadings(): Promise<Heading[]> {
  const pages = await Promise.all(
    DOC_PAGES.map(async page => {
      const load = RAW_CONTENT[contentPath(page.slug)];
      if (!load) return [];
      const raw = await load();
      const slugger = new GithubSlugger();
      return raw.split("\n").flatMap(line => {
        const match = line.match(/^#{2,3}\s+(.+?)\s*$/);
        if (!match) return [];
        const text = plain(match[1]!);
        return [{slug: page.slug, page: page.title, id: slugger.slug(text), text}];
      });
    })
  );
  return pages.flat();
}

let headingsPromise: Promise<Heading[]> | undefined;

/**
 * Searches the docs: page titles and descriptions, and every section heading (loaded the first
 * time it opens). Opens with / (or ⌘K on the public docs, where it isn't the workspace's palette).
 */
export function DocsSearch({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const navigate = useNavigate();
  const docHref = useDocHref();
  const [headings, setHeadings] = useState<Heading[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    headingsPromise ??= loadHeadings();
    void headingsPromise.then(setHeadings);
  }, [isOpen]);
  const go = (slug: string, id?: string) => {
    onOpenChange(false);
    void navigate({to: docHref(slug), hash: id});
  };
  return (
    <Command>
      <Command.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Command.Container>
          <Command.Dialog>
            <Command.InputGroup>
              <Command.InputGroup.Input placeholder="Search the docs…" />
              <Command.InputGroup.ClearButton />
            </Command.InputGroup>
            <Command.List
              renderEmptyState={() => (
                <div className="text-muted flex h-12 items-center justify-center text-sm">
                  Nothing found. Try another word, or browse the sidebar.
                </div>
              )}>
              {DOC_SECTIONS.map(section => (
                <Command.Group key={section} heading={section}>
                  {DOC_PAGES.filter(page => page.section === section).map(page => (
                    <Command.Item
                      key={page.slug || "welcome"}
                      textValue={`${page.title} ${page.description}`}
                      onAction={() => go(page.slug)}>
                      <FileTextIcon />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{page.title}</span>
                        <span className="text-muted truncate text-xs">{page.description}</span>
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
              {headings.length > 0 && (
                <Command.Group heading="Sections">
                  {headings.map(heading => (
                    <Command.Item
                      key={`${heading.slug}#${heading.id}`}
                      textValue={`${heading.text} ${heading.page}`}
                      onAction={() => go(heading.slug, heading.id)}>
                      <HashIcon />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{heading.text}</span>
                        <span className="text-muted truncate text-xs">{heading.page}</span>
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command.Dialog>
        </Command.Container>
      </Command.Backdrop>
    </Command>
  );
}
