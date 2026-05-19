import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import styles from "./button.module.scss";

type ButtonVariant = "default" | "primary" | "ghost" | "danger";
type ButtonSize = "md" | "sm";

const VARIANT_CLASS: Record<ButtonVariant, string | false> = {
  default: false,
  primary: "btn-primary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon, rendered before children. */
  icon?: ReactNode;
};

/** App button — wraps the shared `.btn` design-system classes. */
export function Button({
  variant = "default",
  size = "md",
  icon,
  className,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx("btn", VARIANT_CLASS[variant], size === "sm" && "btn-sm", className)}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  /** Accessible name — required since the button has no visible text. */
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

/** Icon-only button with a required accessible label. */
export function IconButton({
  label,
  variant = "ghost",
  size = "sm",
  className,
  type = "button",
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={clsx(
        "btn",
        VARIANT_CLASS[variant],
        size === "sm" && "btn-sm",
        styles.iconButton,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
