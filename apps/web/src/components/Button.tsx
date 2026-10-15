import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

export function Button({ children, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return <button className="button primary" {...props}>{children}</button>
}
