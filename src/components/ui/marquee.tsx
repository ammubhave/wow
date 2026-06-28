import * as React from "react";
import {cn} from "tailwind-variants";

function Marquee({className, children, ...props}: React.ComponentProps<"div">) {
  return (
    <div data-slot="label" className={cn("overflow-x-hidden relative", className)} {...props}>
      <div className="animate-marquee px-1 whitespace-nowrap">{children}</div>
      <div className="animate-marquee-alt absolute top-0 px-1 whitespace-nowrap">{children}</div>
    </div>
  );
}

export {Marquee};
