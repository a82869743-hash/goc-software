import React from 'react';
import './Button.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...props
}) => {
  return (
    <button
      className={`goc-btn goc-btn--${variant} goc-btn--${size} ${fullWidth ? 'goc-btn--full' : ''} ${loading ? 'goc-btn--loading' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="goc-btn-spinner" />}
      {icon && !loading && <span className="goc-btn-icon">{icon}</span>}
      {children && <span className="goc-btn-label">{children}</span>}
    </button>
  );
};

export default Button;
