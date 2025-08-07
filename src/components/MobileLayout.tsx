import React from 'react';
import { cn } from '@/lib/utils';

interface MobileLayoutProps {
  children: React.ReactNode;
  className?: string;
  hasNavigation?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function MobileLayout({ 
  children, 
  className = '', 
  hasNavigation = false,
  header,
  footer 
}: MobileLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Safe area for status bar */}
      <div className="safe-area-inset-top" />
      
      {/* Header */}
      {header && (
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mobile-container">
            {header}
          </div>
        </header>
      )}
      
      {/* Main content */}
      <main className={cn(
        'flex-1 w-full mx-auto',
        hasNavigation && 'pb-20', // Space for bottom navigation
        className
      )}>
        {children}
      </main>
      
      {/* Footer */}
      {footer && (
        <footer className="w-full border-t bg-background">
          <div className="mobile-container py-4">
            {footer}
          </div>
        </footer>
      )}
      
      {/* Safe area for home indicator */}
      <div className="safe-area-inset-bottom" />
    </div>
  );
}

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function ResponsiveContainer({ 
  children, 
  className = '',
  size = 'lg' 
}: ResponsiveContainerProps) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md', 
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full'
  };

  return (
    <div className={cn(
      'w-full mx-auto px-4',
      sizeClasses[size],
      'sm:px-6 lg:px-8', // Responsive padding
      className
    )}>
      {children}
    </div>
  );
}

interface MobileGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: 'sm' | 'md' | 'lg';
}

export function MobileGrid({ 
  children, 
  className = '',
  cols = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 'md'
}: MobileGridProps) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  };

  const colClasses = [
    `grid-cols-${cols.mobile}`,
    cols.tablet && `sm:grid-cols-${cols.tablet}`,
    cols.desktop && `lg:grid-cols-${cols.desktop}`
  ].filter(Boolean).join(' ');

  return (
    <div className={cn(
      'grid',
      colClasses,
      gapClasses[gap],
      'p-4',
      className
    )}>
      {children}
    </div>
  );
}

interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function MobileCard({ 
  children, 
  className = '',
  header,
  footer,
  padding = 'md'
}: MobileCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };

  return (
    <div className={cn('mobile-card', className)}>
      {header && (
        <div className="mobile-card-header">
          {header}
        </div>
      )}
      
      <div className={cn('mobile-card-content', paddingClasses[padding])}>
        {children}
      </div>
      
      {footer && (
        <div className="px-4 pb-4">
          {footer}
        </div>
      )}
    </div>
  );
}

interface MobileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  fullWidth?: boolean;
  loading?: boolean;
}

export function MobileButton({ 
  children, 
  className = '',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  ...props 
}: MobileButtonProps) {
  const baseClasses = 'mobile-button inline-flex items-center justify-center gap-2 relative overflow-hidden';
  
  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground'
  };
  
  const sizeClasses = {
    sm: 'h-10 px-3 text-sm',
    md: 'h-12 px-4 text-base',
    lg: 'h-14 px-6 text-lg',
    icon: 'h-12 w-12'
  };

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        (disabled || loading) && 'opacity-50 pointer-events-none',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-inherit">
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <span className={loading ? 'opacity-0' : ''}>
        {children}
      </span>
    </button>
  );
}

interface MobileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  fullWidth?: boolean;
}

export function MobileInput({ 
  label,
  error,
  helper,
  fullWidth = true,
  className = '',
  id,
  ...props 
}: MobileInputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={cn('space-y-2', fullWidth && 'w-full')}>
      {label && (
        <label htmlFor={inputId} className="mobile-label">
          {label}
        </label>
      )}
      
      <input
        id={inputId}
        className={cn(
          'mobile-input',
          error && 'border-destructive focus:border-destructive focus:ring-destructive',
          className
        )}
        {...props}
      />
      
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}
      
      {helper && !error && (
        <p className="text-sm text-muted-foreground mt-1">{helper}</p>
      )}
    </div>
  );
}

// Responsive breakpoint hook
export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = React.useState<'mobile' | 'tablet' | 'desktop'>('mobile');

  React.useEffect(() => {
    const checkBreakpoint = () => {
      if (window.innerWidth >= 1024) {
        setBreakpoint('desktop');
      } else if (window.innerWidth >= 640) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('mobile');
      }
    };

    checkBreakpoint();
    window.addEventListener('resize', checkBreakpoint);

    return () => window.removeEventListener('resize', checkBreakpoint);
  }, []);

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop'
  };
}