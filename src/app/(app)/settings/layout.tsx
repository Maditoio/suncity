import { AdminGate } from "@/components/AdminGate";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
