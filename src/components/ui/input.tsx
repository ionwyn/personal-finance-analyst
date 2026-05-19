import clsx from "clsx";
import type { InputHTMLAttributes } from "react";

import styles from "./input.module.scss";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** Styled text/number input — replaces inline-styled raw `<input>` elements. */
export function Input({ className, ...props }: InputProps) {
  return <input className={clsx(styles.input, className)} {...props} />;
}
