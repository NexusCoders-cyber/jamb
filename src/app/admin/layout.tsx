import AdminShell from "@/components/AdminShell";

export const metadata = { title: "Admin | Orbit Prep", robots: { index: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
