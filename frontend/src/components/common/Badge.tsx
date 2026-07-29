type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  success: 'bg-green-500/15 text-green-600 dark:text-green-400',
  warning: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  destructive: 'bg-destructive/15 text-destructive',
  outline: 'border border-border text-foreground',
};

export const Badge = ({ variant = 'default', children, className = '' }: BadgeProps) => {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
};
