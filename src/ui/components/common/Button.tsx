/**
 * Button — themed button component with variants.
 */

import { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type Variant = 'default' | 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children?: ReactNode;
}

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  children,
  className,
  ...rest
}: ButtonProps) {
  const variantClass = {
    default: '',
    primary: 'el-btn--primary',
    ghost: 'el-btn--ghost',
    danger: 'el-btn--danger'
  }[variant];

  const sizeClass = {
    sm: 'el-btn--sm',
    md: '',
    lg: 'el-btn--lg',
    icon: 'el-btn--icon'
  }[size];

  return (
    <button className={clsx('el-btn', variantClass, sizeClass, className)} {...rest}>
      {icon && <span className="flex">{icon}</span>}
      {children}
    </button>
  );
}
