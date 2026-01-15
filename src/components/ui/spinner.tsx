import {Loader2Icon} from "lucide-react";
import {cn} from "tailwind-variants";

function Spinner({className, ...props}: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export {Spinner};
