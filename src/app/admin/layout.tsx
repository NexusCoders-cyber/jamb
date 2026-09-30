import AdminShell from "@/components/AdminShell";

export const metadata = { title: "Admin | Qubit", robots: { index: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
