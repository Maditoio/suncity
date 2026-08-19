import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/auth";

export async function AdminGate({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/");
  return children;
}
