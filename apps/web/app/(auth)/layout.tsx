export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-surface text-on-surface min-h-dvh">{children}</div>;
}
