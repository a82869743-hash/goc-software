import React from 'react';
import './Input.css';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, inputSize = 'md', fullWidth = true, className = '', id, ...props }, ref) => {
    const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;

    return (
      <div className={`goc-input-group ${fullWidth ? 'goc-input-group--full' : ''} ${error ? 'goc-input-group--error' : ''}`}>
        {label && (
          <label htmlFor={inputId} className="goc-input-label">{label}</label>
        )}
        <div className={`goc-input-wrap goc-input-wrap--${inputSize}`}>
          {icon && <span className="goc-input-icon">{icon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={`goc-input ${icon ? 'goc-input--has-icon' : ''} ${className}`}
            {...props}
          />
        </div>
        {error && <span className="goc-input-error">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
