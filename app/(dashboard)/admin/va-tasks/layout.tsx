import { VaTasksDesignShell } from "@/components/va-tasks-design-shell";

export default function AdminVaTasksLayout({ children }: { children: React.ReactNode }) {
  return <VaTasksDesignShell>{children}</VaTasksDesignShell>;
}
