interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export default function PageHeader({ title, description, action, compact }: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 animate-fade-up shrink-0 ${compact ? "" : "mb-1"}`}>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
