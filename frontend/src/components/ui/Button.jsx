import { forwardRef } from 'react';
import './button.css';

const Button = forwardRef(function Button({ variant = 'primary', loading = false, disabled = false, className = '', type = 'button', children, ...props }, ref) {
  return <button {...props} ref={ref} type={type} className={`btn btn-${variant} ${className}`.trim()} disabled={disabled || loading} aria-busy={loading || undefined}>{loading && <span className="button-spinner" aria-hidden="true" />}{children}</button>;
});

export default Button;
