import React from 'react';
import './Card.css';

interface CardProps {
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

const Card: React.FC<CardProps> = ({ title, subtitle, headerAction, children, footer, className = '', noPadding = false }) => (
  <div className={`goc-card ${className}`}>
    {(title || headerAction) && (
      <div className="goc-card-header">
        <div className="goc-card-header-text">
          {title && <h3 className="goc-card-title">{title}</h3>}
          {subtitle && <p className="goc-card-subtitle">{subtitle}</p>}
        </div>
        {headerAction && <div className="goc-card-header-action">{headerAction}</div>}
      </div>
    )}
    <div className={`goc-card-body ${noPadding ? 'goc-card-body--flush' : ''}`}>
      {children}
    </div>
    {footer && <div className="goc-card-footer">{footer}</div>}
  </div>
);

export default Card;
