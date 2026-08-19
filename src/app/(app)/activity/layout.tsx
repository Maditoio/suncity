import { AdminGate } from "@/components/AdminGate";

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
