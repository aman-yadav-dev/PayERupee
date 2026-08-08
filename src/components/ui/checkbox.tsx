"use client";

import React, { useId, useState, useCallback } from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cn } from "@/lib/utils";
import { Check, CheckIcon } from "lucide-react";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

interface CustomCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  children?: React.ReactNode;
  labelClassName?: string;
}

const CustomCheckbox = React.forwardRef<HTMLInputElement, CustomCheckboxProps>(
  (
    {
      className,
      label,
      children,
      labelClassName,
      id: propId,
      checked,
      defaultChecked,
      onChange,
      ...props
    },
    ref
  ) => {
    const autoId = useId();
    const id = propId ?? autoId;

    const isControlled = checked !== undefined;
    const [internalChecked, setInternalChecked] = useState<boolean>(
      !!defaultChecked
    );
    const isChecked = isControlled ? !!checked : internalChecked;

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isControlled) setInternalChecked(e.target.checked);
        onChange?.(e);
      },
      [isControlled, onChange]
    );

    return (
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer select-none items-start gap-2",
          className
        )}
      >
        <span
          className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded border transition-all duration-150 focus-within:ring-2 focus-within:ring-indigo-300 focus-within:ring-offset-1"
          style={{
            backgroundColor: isChecked ? "rgb(79 70 229)" : "white",
            borderColor: isChecked ? "rgb(79 70 229)" : "rgb(212 212 216)",
          }}
        >
          <input
            id={id}
            type="checkbox"
            ref={ref}
            checked={isChecked}
            onChange={handleChange}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
            {...props}
          />
          <Check
            className={cn(
              "pointer-events-none relative z-10 h-2.5 w-2.5 text-white transition-opacity duration-100",
              isChecked ? "opacity-100" : "opacity-0"
            )}
            strokeWidth={3}
          />
        </span>

        {(label != null || children != null) && (
          <span
            className={cn(
              "text-[12.5px] leading-[1.6] text-zinc-500",
              labelClassName
            )}
          >
            {label ?? children}
          </span>
        )}
      </label>
    );
  }
);
CustomCheckbox.displayName = "CustomCheckbox";

export { Checkbox, CustomCheckbox };
