import { cn } from "#/lib/utils.ts"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-shimmer rounded-md bg-muted/60 bg-[length:200%_100%] bg-gradient-to-r from-transparent via-muted/40 to-transparent", className)}
      {...props}
    />
  )
}

export { Skeleton }