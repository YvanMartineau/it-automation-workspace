// frontend/src/components/ui/button.tsx
import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"

import { cn } from "#/lib/utils"
import { buttonVariants, type ButtonVariantProps } from "./button-variants"

const Button = React.forwardRef<HTMLButtonElement, ButtonPrimitive.Props & ButtonVariantProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <ButtonPrimitive
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }