import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MobileLayout } from '@/components/MobileLayout';
import { cn } from '@/lib/utils';
import { ArrowLeft, Settings, User, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBreakpoint } from '@/components/MobileLayout';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
  sidebar?: React.ReactNode;
  headerContent?: React.ReactNode;
}

export function PageLayout({
  children,
  title,
  description,
  className = '',
  showBackButton = false,
  onBack,
  actions,
  sidebar,
  headerContent
}: PageLayoutProps) {
  const { isMobile } = useBreakpoint();

  const header = (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="touch-target"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          {title && (
            <h1 className="text-responsive-xl font-semibold text-foreground">
              {title}
            </h1>
          )}
          {description && (
            <p className="text-responsive-sm text-muted-foreground mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
      
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <ErrorBoundary>
        <MobileLayout header={header}>
          <div className={cn('mobile-container py-4', className)}>
            {headerContent}
            {children}
          </div>
        </MobileLayout>
      </ErrorBoundary>
    );
  }

  // Desktop layout with optional sidebar
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
          <div className="container mx-auto px-4">
            {header}
            {headerContent}
          </div>
        </header>

        {/* Main content */}
        <div className="container mx-auto px-4 py-6">
          <div className="flex gap-6">
            {/* Sidebar */}
            {sidebar && (
              <aside className="w-64 shrink-0">
                <div className="sticky top-24">
                  {sidebar}
                </div>
              </aside>
            )}
            
            {/* Content */}
            <main className={cn('flex-1 min-w-0', className)}>
              {children}
            </main>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function DashboardLayout({
  children,
  title,
  subtitle,
  actions,
  className = ''
}: DashboardLayoutProps) {
  const { isMobile } = useBreakpoint();

  const header = (
    <div className="flex items-center justify-between py-4">
      <div>
        <h1 className="text-responsive-2xl font-bold text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="text-responsive-base text-muted-foreground mt-1">
            {subtitle}
          </p>
        )}
      </div>
      
      {actions && !isMobile && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );

  return (
    <ErrorBoundary>
      <MobileLayout header={header}>
        <div className={cn('mobile-container py-4', className)}>
          {/* Mobile actions */}
          {actions && isMobile && (
            <div className="flex flex-wrap gap-2 mb-4">
              {actions}
            </div>
          )}
          
          {children}
        </div>
      </MobileLayout>
    </ErrorBoundary>
  );
}

interface FormLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  onBack?: () => void;
  onSave?: () => void;
  saveLabel?: string;
  isLoading?: boolean;
  className?: string;
}

export function FormLayout({
  children,
  title,
  description,
  onBack,
  onSave,
  saveLabel = 'Save',
  isLoading = false,
  className = ''
}: FormLayoutProps) {
  const actions = (
    <div className="flex gap-2">
      {onBack && (
        <Button variant="outline" onClick={onBack}>
          Cancel
        </Button>
      )}
      {onSave && (
        <Button onClick={onSave} disabled={isLoading}>
          {isLoading ? 'Saving...' : saveLabel}
        </Button>
      )}
    </div>
  );

  return (
    <PageLayout
      title={title}
      description={description}
      showBackButton={!!onBack}
      onBack={onBack}
      actions={actions}
      className={className}
    >
      <div className="mobile-form max-w-2xl">
        {children}
      </div>
    </PageLayout>
  );
}

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  className?: string;
}

export function AdminLayout({ 
  children, 
  title, 
  subtitle,
  className = '' 
}: AdminLayoutProps) {
  const adminSidebar = (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
        <Shield className="h-5 w-5 text-primary" />
        <span className="font-medium text-primary">Admin Panel</span>
      </div>
      
      <nav className="space-y-2">
        <Button variant="ghost" className="w-full justify-start gap-2">
          <User className="h-4 w-4" />
          Users
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-2">
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </nav>
    </div>
  );

  return (
    <PageLayout
      title={title}
      description={subtitle}
      sidebar={adminSidebar}
      className={className}
    >
      {children}
    </PageLayout>
  );
}

interface LoadingLayoutProps {
  title?: string;
  message?: string;
}

export function LoadingLayout({ 
  title = 'Loading...', 
  message = 'Please wait while we load your data' 
}: LoadingLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <div>
          <h2 className="text-responsive-lg font-semibold text-foreground">
            {title}
          </h2>
          <p className="text-responsive-sm text-muted-foreground mt-1">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

interface EmptyLayoutProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function EmptyLayout({
  title,
  description,
  action,
  icon
}: EmptyLayoutProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      
      <h3 className="text-responsive-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      
      <p className="text-responsive-sm text-muted-foreground mb-6 max-w-md">
        {description}
      </p>
      
      {action}
    </div>
  );
}