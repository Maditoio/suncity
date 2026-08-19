import { AdminGate } from "@/components/AdminGate";

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
