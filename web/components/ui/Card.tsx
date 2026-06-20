import { HTMLAttributes, ReactNode } from "react";

export function Card({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={["rounded-xl border border-line bg-paper shadow-card", className ?? ""].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-5 py-3">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{title}</p>
      {action}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={["p-5", className ?? ""].join(" ")}>{children}</div>;
}
