import * as React from "react";
import {cn} from "tailwind-variants";

function Marquee({className, children, ...props}: React.ComponentProps<"div">) {
  return (
    <div data-slot="label" className={cn("overflow-x-hidden relative", className)} {...props}>
      <div className="animate-marquee whitespace-nowrap px-1">{children}</div>
      <div className="absolute top-0 animate-marquee-alt whitespace-nowrap px-1">{children}</div>
    </div>
  );
}

export {Marquee};
