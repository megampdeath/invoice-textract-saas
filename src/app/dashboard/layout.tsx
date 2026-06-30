import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/session";
import { SignOutButton } from "@/components/SignOutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getOptionalUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-bold text-brand">
              InvoiceIQ
            </Link>
            <nav className="flex gap-4 text-sm text-slate-600">
              <Link href="/dashboard" className="hover:text-slate-900">
                Invoices
              </Link>
              <Link href="/dashboard/documents" className="hover:text-slate-900">
                Documents
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-xs text-slate-500">
              <div className="font-medium text-slate-700">
                {user.organizationName}
              </div>
              <div>{user.email}</div>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
