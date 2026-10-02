import {FloatingToc} from "@heroui-pro/react";
import {Typography} from "@heroui/react";
import {Link} from "@tanstack/react-router";
import {useEffect, useRef, useState} from "react";
import {cn} from "tailwind-variants";

import {PROSE_FLOW} from "@/lib/prose";

type Section = {id: string; label: string};

/**
 * Layout for long legal documents: header, themed prose, and a floating table of contents built
 * from the content's `h2[id]` headings that follows the section being read.
 */
export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [activeId, setActiveId] = useState<string>();

  useEffect(() => {
    const headings = [...(contentRef.current?.querySelectorAll<HTMLElement>("h2[id]") ?? [])];
    setSections(
      headings.map(h => ({id: h.id, label: h.textContent?.replace(/^\d+\.\s*/, "") ?? ""}))
    );
    setActiveId(headings[0]?.id);
    // The section whose heading most recently crossed the upper part of the viewport is "current".
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.find(e => e.isIntersecting);
        if (visible) setActiveId(visible.target.id);
      },
      {rootMargin: "0px 0px -70% 0px"}
    );
    headings.forEach(h => observer.observe(h));
    return () => observer.disconnect();
  }, []);

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({behavior: "smooth", block: "start"});
    history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  };

  return (
    <div className="mx-auto w-full max-w-3xl py-4 md:py-8">
      <header className="border-separator flex flex-col gap-3 border-b pb-8">
        <span className="text-accent text-xs font-semibold tracking-wider uppercase">Legal</span>
        <Typography type="h1">{title}</Typography>
        <Typography color="muted" type="body-sm">
          Effective {effectiveDate} ·{" "}
          {title === "Privacy Policy" ? (
            <Link to="/tos" className="text-foreground underline underline-offset-4">
              Terms of Service
            </Link>
          ) : (
            <Link to="/privacy-policy" className="text-foreground underline underline-offset-4">
              Privacy Policy
            </Link>
          )}
        </Typography>
      </header>
      <div ref={contentRef}>
        <Typography.Prose className={cn("pt-8", PROSE_FLOW)}>{children}</Typography.Prose>
      </div>
      {sections.length > 0 && (
        <div className="fixed top-1/2 right-6 hidden -translate-y-1/2 lg:block">
          <FloatingToc>
            <FloatingToc.Trigger aria-label="Table of contents">
              {sections.map(section => (
                <FloatingToc.Bar key={section.id} active={section.id === activeId} />
              ))}
            </FloatingToc.Trigger>
            <FloatingToc.Content>
              {sections.map(section => (
                <FloatingToc.Item
                  key={section.id}
                  active={section.id === activeId}
                  onClick={() => goTo(section.id)}>
                  {section.label}
                </FloatingToc.Item>
              ))}
            </FloatingToc.Content>
          </FloatingToc>
        </div>
      )}
    </div>
  );
}
