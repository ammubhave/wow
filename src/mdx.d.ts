// MDX pages (src/docs/content): a component taking the components to render elements with.
declare module "*.mdx" {
  import type {ComponentType, ReactNode} from "react";

  const MDXContent: ComponentType<{
    components?: Record<string, ComponentType<{children?: ReactNode}> | ComponentType<never>>;
  }>;
  export default MDXContent;
}
