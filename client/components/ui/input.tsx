import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        style={{
          backgroundColor: '#2c313a',
          borderColor: '#2c313a',
          color: '#ffffff',
          ...props.style
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#1e3a8a'
          e.target.style.boxShadow = '0 0 0 2px rgba(30, 58, 138, 0.2)'
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#2c313a'
          e.target.style.boxShadow = 'none'
        }}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }