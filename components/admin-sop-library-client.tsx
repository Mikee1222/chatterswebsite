"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  Eye,
  GripVertical,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Users,
  Video,
  X,
} from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import {
  GlassModal,
  Checkbox,
  ButtonPrimary,
  ButtonSecondary,
  SubmitButton,
} from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSelect } from "@/components/ui/form-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Markdown } from "@/components/ui/markdown";
import { FilePreview } from "@/components/ui/file-preview";
import { Spinner } from "@/components/ui/spinner";
import { SopShell } from "@/components/sop/sop-shell";
import { SopEmptyState } from "@/components/sop/sop-empty-state";
import { SopGlowBadge } from "@/components/sop/sop-glow-badge";
import { CADENCE_STYLES, SOP_COLOR_STYLES } from "@/components/sop/sop-colors";
import { useSopMotion } from "@/components/sop/sop-motion";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types";
import type {
  SopDepartment,
  SopRole,
  SopFunction,
  SopColor,
  SopAuthRole,
  CadenceType,
  StandardType,
} from "@/types";

function localToast(
  id: string,
  title: string,
  body: string,
  priority: "normal" | "high"
): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system",
    event_type: "system_alert",
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

const SOP_COLORS: SopColor[] = ["blue", "pink", "green", "orange", "purple", "gray"];

const SOP_MODAL_CLASS = "sop-modal-panel md:rounded-2xl";

const AUTH_ROLES: SopAuthRole[] = [
  "admin",
  "manager",
  "chatter",
  "virtual_assistant",
  "model",
  "client",
];

const AUTH_ROLE_LABELS: Record<SopAuthRole, string> = {
  admin: "Admin",
  manager: "Manager",
  chatter: "Chatter",
  virtual_assistant: "Virtual assistant",
  model: "Model",
  client: "Client",
};

const CADENCE_TYPES: CadenceType[] = [
  "daily",
  "per_shift",
  "weekly",
  "biweekly",
  "monthly",
  "ad_hoc",
];

const CADENCE_LABELS: Record<CadenceType, string> = {
  daily: "Daily",
  per_shift: "Per shift",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  ad_hoc: "Ad hoc",
};

type PickUser = { id: string; name: string; role: string };

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sortDepartments(items: SopDepartment[]): SopDepartment[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

function sortRoles(items: SopRole[]): SopRole[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

function sortFunctions(items: SopFunction[]): SopFunction[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

function ColorSelect({
  value,
  onChange,
  id,
}: {
  value: SopColor;
  onChange: (c: SopColor) => void;
  id?: string;
}) {
  return (
    <FormSelect id={id} value={value} onChange={(e) => onChange(e.target.value as SopColor)}>
      {SOP_COLORS.map((c) => (
        <option key={c} value={c}>
          {c.charAt(0).toUpperCase() + c.slice(1)}
        </option>
      ))}
    </FormSelect>
  );
}

function MarkdownField({
  label,
  value,
  onChange,
  rows = 8,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const [showPreview, setShowPreview] = React.useState(false);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/55 transition hover:border-pink-500/25 hover:bg-white/10 hover:text-white/85"
        >
          <Eye className="h-3 w-3" />
          {showPreview ? "Edit" : "Preview"}
        </button>
      </div>
      {showPreview ? (
        <div className="min-h-[160px]">
          <Markdown framed>{value}</Markdown>
        </div>
      ) : (
        <FormTextarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function SortableDepartmentRow({
  dept,
  onEdit,
  onDelete,
}: {
  dept: SopDepartment;
  onEdit: (d: SopDepartment) => void;
  onDelete: (d: SopDepartment) => void;
}) {
  const motionCfg = useSopMotion();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dept.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  const cfg = SOP_COLOR_STYLES[dept.color];

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      variants={motionCfg.item}
      whileHover={isDragging ? undefined : motionCfg.hoverLift}
      className={cn(
        "sop-glass-card group flex items-center gap-3 rounded-xl px-3.5 py-3 transition-[border-color,box-shadow]",
        isDragging && "scale-[1.01] shadow-2xl",
        dept.is_active ? cfg.border : "border-white/8 opacity-50"
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="shrink-0 cursor-grab touch-none text-white/25 hover:text-white/55 active:cursor-grabbing"
        aria-label="Drag to reorder department"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full", cfg.dot)} />
      <span className={cn("flex-1 text-sm font-medium", dept.is_active ? "text-white" : "text-white/35 line-through")}>
        {dept.name}
      </span>
      <SopGlowBadge className={cfg.badge} glowClassName={cfg.glow}>
        {dept.color}
      </SopGlowBadge>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onEdit(dept)}
          className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
          aria-label="Edit department"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(dept)}
          className="rounded-lg p-1.5 text-rose-300/70 hover:bg-rose-500/15"
          aria-label="Delete department"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

function SortableRoleRow({
  role,
  onEdit,
  onDelete,
  onOpen,
}: {
  role: SopRole;
  onEdit: (r: SopRole) => void;
  onDelete: (r: SopRole) => void;
  onOpen: (r: SopRole) => void;
}) {
  const motionCfg = useSopMotion();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: role.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  const cfg = SOP_COLOR_STYLES[role.color];

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      variants={motionCfg.item}
      whileHover={isDragging ? undefined : motionCfg.hoverLift}
      className={cn(
        "sop-glass-card group flex items-center gap-3 rounded-2xl px-4 py-4 transition-[border-color,box-shadow] hover:shadow-[0_0_40px_-12px_hsl(330_80%_55%_/_0.1)]",
        isDragging && "scale-[1.02] shadow-2xl",
        role.is_active ? cfg.border : "border-white/8 opacity-50"
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="shrink-0 cursor-grab touch-none text-white/25 hover:text-white/55 active:cursor-grabbing"
        aria-label="Drag to reorder role"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg">
        {role.icon || "📋"}
      </span>
      <button type="button" onClick={() => onOpen(role)} className="min-w-0 flex-1 text-left">
        <span className={cn("block text-sm font-semibold", role.is_active ? "text-white" : "text-white/35 line-through")}>
          {role.name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-white/40">{role.slug}</span>
      </button>
      {role.auth_roles.length > 0 ? (
        <SopGlowBadge className="hidden border-white/12 bg-white/[0.05] text-white/55 sm:inline-flex">
          {role.auth_roles.length} role{role.auth_roles.length !== 1 ? "s" : ""}
        </SopGlowBadge>
      ) : null}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onEdit(role)}
          className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
          aria-label="Edit role"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(role)}
          className="rounded-lg p-1.5 text-rose-300/70 hover:bg-rose-500/15"
          aria-label="Delete role"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

function SortableFunctionRow({
  fn,
  department,
  onEdit,
  onDelete,
}: {
  fn: SopFunction;
  department: SopDepartment | undefined;
  onEdit: (f: SopFunction) => void;
  onDelete: (f: SopFunction) => void;
}) {
  const motionCfg = useSopMotion();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: fn.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  const deptCfg = department ? SOP_COLOR_STYLES[department.color] : SOP_COLOR_STYLES.gray;
  const cadenceCfg = CADENCE_STYLES[fn.cadence_type];

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      variants={motionCfg.item}
      whileHover={isDragging ? undefined : motionCfg.hoverLift}
      className={cn(
        "sop-glass-card group flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3.5 transition-[border-color,box-shadow] sm:flex-nowrap sm:gap-3",
        isDragging && "scale-[1.01] shadow-xl",
        !fn.is_active && "opacity-50"
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="shrink-0 cursor-grab touch-none text-white/25 hover:text-white/55 active:cursor-grabbing"
        aria-label="Drag to reorder function"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className={cn("min-w-0 flex-1 text-sm font-semibold", fn.is_active ? "text-white" : "text-white/35 line-through")}>
        {fn.name}
      </span>
      {department ? (
        <SopGlowBadge className={deptCfg.badge} glowClassName={deptCfg.glow}>
          {department.name}
        </SopGlowBadge>
      ) : null}
      <SopGlowBadge className={cadenceCfg.badge} glowClassName={cadenceCfg.glow}>
        {CADENCE_LABELS[fn.cadence_type]}
        {fn.cadence_note ? ` · ${fn.cadence_note}` : ""}
      </SopGlowBadge>
      {fn.kpi.trim() ? (
        <span className="hidden max-w-[200px] truncate text-xs text-white/45 lg:inline" title={fn.kpi}>
          KPI: {fn.kpi}
        </span>
      ) : null}
      {fn.loom_url.trim() ? (
        <SopGlowBadge className="border-violet-500/30 bg-violet-500/12 text-violet-200" glowClassName="shadow-[0_0_14px_-5px_rgba(139,92,246,0.35)]">
          <Video className="mr-1 inline h-3 w-3" />
          Loom
        </SopGlowBadge>
      ) : null}
      <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onEdit(fn)}
          className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
          aria-label="Edit function"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(fn)}
          className="rounded-lg p-1.5 text-rose-300/70 hover:bg-rose-500/15"
          aria-label="Delete function"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

type DeptForm = { name: string; color: SopColor; is_active: boolean };
type RoleForm = {
  name: string;
  slug: string;
  slugManual: boolean;
  description: string;
  icon: string;
  color: SopColor;
  auth_roles: SopAuthRole[];
  assigned_user_ids: string[];
  is_active: boolean;
};
type FunctionForm = {
  name: string;
  department_id: string;
  kpi: string;
  standard_type: StandardType;
  sop_content: string;
  sop_file_url: string;
  sop_file_name: string;
  loom_url: string;
  cadence_type: CadenceType;
  cadence_note: string;
  is_active: boolean;
};

function emptyDeptForm(): DeptForm {
  return { name: "", color: "gray", is_active: true };
}

function deptToForm(d: SopDepartment): DeptForm {
  return { name: d.name, color: d.color, is_active: d.is_active };
}

function emptyRoleForm(): RoleForm {
  return {
    name: "",
    slug: "",
    slugManual: false,
    description: "",
    icon: "",
    color: "blue",
    auth_roles: [],
    assigned_user_ids: [],
    is_active: true,
  };
}

function roleToForm(r: SopRole): RoleForm {
  return {
    name: r.name,
    slug: r.slug,
    slugManual: true,
    description: r.description,
    icon: r.icon,
    color: r.color,
    auth_roles: [...r.auth_roles],
    assigned_user_ids: [...r.assigned_user_ids],
    is_active: r.is_active,
  };
}

function emptyFunctionForm(deptId = ""): FunctionForm {
  return {
    name: "",
    department_id: deptId,
    kpi: "",
    standard_type: "text",
    sop_content: "",
    sop_file_url: "",
    sop_file_name: "",
    loom_url: "",
    cadence_type: "ad_hoc",
    cadence_note: "",
    is_active: true,
  };
}

function fnToForm(f: SopFunction): FunctionForm {
  return {
    name: f.name,
    department_id: f.department_id,
    kpi: f.kpi,
    standard_type: f.standard_type,
    sop_content: f.sop_content,
    sop_file_url: f.sop_file_url,
    sop_file_name: f.sop_file_name,
    loom_url: f.loom_url,
    cadence_type: f.cadence_type,
    cadence_note: f.cadence_note,
    is_active: f.is_active,
  };
}

type Props = {
  initialDepartments: SopDepartment[];
  initialRoles: SopRole[];
};

export function AdminSopLibraryClient({ initialDepartments, initialRoles }: Props) {
  const { addToast } = useToast();
  const [departments, setDepartments] = React.useState(() => sortDepartments(initialDepartments));
  const [roles, setRoles] = React.useState(() => sortRoles(initialRoles));
  const [deptOpen, setDeptOpen] = React.useState(true);
  const [selectedRole, setSelectedRole] = React.useState<SopRole | null>(null);
  const [functions, setFunctions] = React.useState<SopFunction[]>([]);
  const [loadingFunctions, setLoadingFunctions] = React.useState(false);

  const [deptModalOpen, setDeptModalOpen] = React.useState(false);
  const [deptEditing, setDeptEditing] = React.useState<SopDepartment | null>(null);
  const [deptForm, setDeptForm] = React.useState<DeptForm>(emptyDeptForm);
  const [deptSaving, setDeptSaving] = React.useState(false);

  const [roleModalOpen, setRoleModalOpen] = React.useState(false);
  const [roleEditing, setRoleEditing] = React.useState<SopRole | null>(null);
  const [roleForm, setRoleForm] = React.useState<RoleForm>(emptyRoleForm);
  const [roleSaving, setRoleSaving] = React.useState(false);
  const [users, setUsers] = React.useState<PickUser[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [userSearch, setUserSearch] = React.useState("");

  const [fnModalOpen, setFnModalOpen] = React.useState(false);
  const [fnEditing, setFnEditing] = React.useState<SopFunction | null>(null);
  const [fnForm, setFnForm] = React.useState<FunctionForm>(emptyFunctionForm());
  const [fnSaving, setFnSaving] = React.useState(false);
  const [fnFileUploading, setFnFileUploading] = React.useState(false);
  const [fnFileUploadError, setFnFileUploadError] = React.useState("");
  const fnFileInputRef = React.useRef<HTMLInputElement>(null);

  const [confirmDelete, setConfirmDelete] = React.useState<
    | { type: "department"; item: SopDepartment }
    | { type: "role"; item: SopRole }
    | { type: "function"; item: SopFunction }
    | null
  >(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  React.useEffect(() => {
    setDepartments(sortDepartments(initialDepartments));
  }, [initialDepartments]);

  React.useEffect(() => {
    setRoles(sortRoles(initialRoles));
  }, [initialRoles]);

  React.useEffect(() => {
    if (!selectedRole) {
      setFunctions([]);
      return;
    }
    setLoadingFunctions(true);
    fetch(`/api/admin/sops/functions?role_id=${encodeURIComponent(selectedRole.id)}`)
      .then((r) => r.json())
      .then((d: { functions?: SopFunction[] }) => {
        if (Array.isArray(d.functions)) setFunctions(sortFunctions(d.functions));
        else setFunctions([]);
      })
      .catch(() => setFunctions([]))
      .finally(() => setLoadingFunctions(false));
  }, [selectedRole?.id]);

  React.useEffect(() => {
    if (!roleModalOpen) return;
    setLoadingUsers(true);
    fetch("/api/admin/sops/users")
      .then((r) => r.json())
      .then((d: { users?: PickUser[] }) => {
        if (Array.isArray(d.users)) setUsers(d.users);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, [roleModalOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const deptById = React.useMemo(() => {
    const m = new Map<string, SopDepartment>();
    for (const d of departments) m.set(d.id, d);
    return m;
  }, [departments]);

  const filteredUsers = React.useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  async function reorderItems(
    endpoint: string,
    orderedIds: string[],
    onRollback: () => void
  ) {
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      if (!res.ok) throw new Error("reorder");
      addToast(localToast("sop-order", "Order saved", "Sort order updated.", "normal"));
    } catch {
      onRollback();
      addToast(localToast("sop-order-e", "Reorder failed", "Could not save order. Try again.", "high"));
    }
  }

  function handleDeptDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = departments.findIndex((d) => d.id === active.id);
    const newIndex = departments.findIndex((d) => d.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(departments, oldIndex, newIndex).map((d, i) => ({
      ...d,
      sort_order: i + 1,
    }));
    const prev = departments;
    setDepartments(reordered);
    void reorderItems("/api/admin/sops/departments/reorder", reordered.map((d) => d.id), () =>
      setDepartments(prev)
    );
  }

  function handleRoleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = roles.findIndex((r) => r.id === active.id);
    const newIndex = roles.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(roles, oldIndex, newIndex).map((r, i) => ({
      ...r,
      sort_order: i + 1,
    }));
    const prev = roles;
    setRoles(reordered);
    void reorderItems("/api/admin/sops/roles/reorder", reordered.map((r) => r.id), () => setRoles(prev));
  }

  function handleFnDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = functions.findIndex((f) => f.id === active.id);
    const newIndex = functions.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(functions, oldIndex, newIndex).map((f, i) => ({
      ...f,
      sort_order: i + 1,
    }));
    const prev = functions;
    setFunctions(reordered);
    void reorderItems("/api/admin/sops/functions/reorder", reordered.map((f) => f.id), () =>
      setFunctions(prev)
    );
  }

  function openDeptCreate() {
    setDeptEditing(null);
    setDeptForm(emptyDeptForm());
    setDeptModalOpen(true);
  }

  function openDeptEdit(d: SopDepartment) {
    setDeptEditing(d);
    setDeptForm(deptToForm(d));
    setDeptModalOpen(true);
  }

  async function saveDept(e: React.FormEvent) {
    e.preventDefault();
    if (!deptForm.name.trim()) {
      addToast(localToast("sop-dept-val", "Name required", "Enter a department name.", "normal"));
      return;
    }
    setDeptSaving(true);
    try {
      const payload = {
        name: deptForm.name.trim(),
        color: deptForm.color,
        is_active: deptForm.is_active,
      };
      if (deptEditing) {
        const res = await fetch(`/api/admin/sops/departments/${deptEditing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as {
          department?: SopDepartment;
          error?: unknown;
        };
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "fail");
        if (data.department) {
          setDepartments((p) => sortDepartments(p.map((d) => (d.id === data.department!.id ? data.department! : d))));
        }
        addToast(localToast("sop-dept-upd", "Saved", "Department updated.", "normal"));
      } else {
        const res = await fetch("/api/admin/sops/departments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as {
          department?: SopDepartment;
          error?: unknown;
        };
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "fail");
        if (data.department) setDepartments((p) => sortDepartments([...p, data.department!]));
        addToast(localToast("sop-dept-add", "Created", "Department added.", "normal"));
      }
      setDeptModalOpen(false);
      setDeptEditing(null);
    } catch {
      addToast(localToast("sop-dept-e", "Save failed", "Could not save department.", "high"));
    } finally {
      setDeptSaving(false);
    }
  }

  function openRoleCreate() {
    setRoleEditing(null);
    setRoleForm(emptyRoleForm());
    setUserSearch("");
    setRoleModalOpen(true);
  }

  function openRoleEdit(r: SopRole) {
    setRoleEditing(r);
    setRoleForm(roleToForm(r));
    setUserSearch("");
    setRoleModalOpen(true);
  }

  function updateRoleName(name: string) {
    setRoleForm((f) => ({
      ...f,
      name,
      slug: f.slugManual ? f.slug : slugFromName(name),
    }));
  }

  async function saveRole(e: React.FormEvent) {
    e.preventDefault();
    const name = roleForm.name.trim();
    const slug = (roleForm.slugManual ? roleForm.slug : slugFromName(name)).trim();
    if (!name || !slug) {
      addToast(localToast("sop-role-val", "Check form", "Name and slug are required.", "normal"));
      return;
    }
    setRoleSaving(true);
    try {
      const payload = {
        name,
        slug,
        description: roleForm.description,
        icon: roleForm.icon.trim(),
        color: roleForm.color,
        auth_roles: roleForm.auth_roles,
        assigned_user_ids: roleForm.assigned_user_ids,
        is_active: roleForm.is_active,
      };
      if (roleEditing) {
        const res = await fetch(`/api/admin/sops/roles/${roleEditing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as { role?: SopRole; error?: unknown };
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "fail");
        if (data.role) {
          setRoles((p) => sortRoles(p.map((r) => (r.id === data.role!.id ? data.role! : r))));
          if (selectedRole?.id === data.role.id) setSelectedRole(data.role);
        }
        addToast(localToast("sop-role-upd", "Saved", "Role updated.", "normal"));
      } else {
        const res = await fetch("/api/admin/sops/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as { role?: SopRole; error?: unknown };
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "fail");
        if (data.role) setRoles((p) => sortRoles([...p, data.role!]));
        addToast(localToast("sop-role-add", "Created", "Role created.", "normal"));
      }
      setRoleModalOpen(false);
      setRoleEditing(null);
    } catch {
      addToast(localToast("sop-role-e", "Save failed", "Could not save role.", "high"));
    } finally {
      setRoleSaving(false);
    }
  }

  function openFnCreate() {
    const defaultDept = departments.find((d) => d.is_active)?.id ?? "";
    setFnEditing(null);
    setFnForm(emptyFunctionForm(defaultDept));
    setFnFileUploading(false);
    setFnFileUploadError("");
    setFnModalOpen(true);
  }

  function openFnEdit(f: SopFunction) {
    setFnEditing(f);
    setFnForm(fnToForm(f));
    setFnFileUploading(false);
    setFnFileUploadError("");
    setFnModalOpen(true);
  }

  async function handleFnFileSelect(file: File | null) {
    setFnFileUploadError("");
    if (!file) return;

    setFnFileUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/sops/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { url?: string; name?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Upload failed");
      }
      setFnForm((f) => ({
        ...f,
        sop_file_url: data.url!,
        sop_file_name: data.name ?? file.name,
      }));
    } catch (err) {
      setFnFileUploadError(err instanceof Error ? err.message : "Upload failed");
      if (fnFileInputRef.current) fnFileInputRef.current.value = "";
    } finally {
      setFnFileUploading(false);
    }
  }

  function clearFnFile() {
    setFnForm((f) => ({ ...f, sop_file_url: "", sop_file_name: "" }));
    setFnFileUploadError("");
    if (fnFileInputRef.current) fnFileInputRef.current.value = "";
  }

  async function saveFunction(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRole) return;
    if (!fnForm.name.trim()) {
      addToast(localToast("sop-fn-val", "Name required", "Enter a function name.", "normal"));
      return;
    }
    if (fnForm.standard_type === "file" && !fnForm.sop_file_url.trim()) {
      addToast(localToast("sop-fn-file", "File required", "Upload a file for this standard.", "normal"));
      return;
    }
    if (fnFileUploading) {
      addToast(localToast("sop-fn-upload", "Upload in progress", "Wait for the file upload to finish.", "normal"));
      return;
    }
    setFnSaving(true);
    try {
      const payload = {
        sop_role_id: selectedRole.id,
        name: fnForm.name.trim(),
        department_id: fnForm.department_id,
        kpi: fnForm.kpi,
        standard_type: fnForm.standard_type,
        sop_content: fnForm.standard_type === "text" ? fnForm.sop_content : "",
        sop_file_url: fnForm.standard_type === "file" ? fnForm.sop_file_url : "",
        sop_file_name: fnForm.standard_type === "file" ? fnForm.sop_file_name : "",
        loom_url: fnForm.loom_url.trim(),
        cadence_type: fnForm.cadence_type,
        cadence_note: fnForm.cadence_note.trim(),
        is_active: fnForm.is_active,
      };
      if (fnEditing) {
        const res = await fetch(`/api/admin/sops/functions/${fnEditing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as {
          function?: SopFunction;
          error?: unknown;
        };
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "fail");
        if (data.function) {
          setFunctions((p) => sortFunctions(p.map((f) => (f.id === data.function!.id ? data.function! : f))));
        }
        addToast(localToast("sop-fn-upd", "Saved", "Function updated.", "normal"));
      } else {
        const res = await fetch("/api/admin/sops/functions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as {
          function?: SopFunction;
          error?: unknown;
        };
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "fail");
        if (data.function) setFunctions((p) => sortFunctions([...p, data.function!]));
        addToast(localToast("sop-fn-add", "Created", "Function created.", "normal"));
      }
      setFnModalOpen(false);
      setFnEditing(null);
    } catch {
      addToast(localToast("sop-fn-e", "Save failed", "Could not save function.", "high"));
    } finally {
      setFnSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    try {
      if (confirmDelete.type === "department") {
        const res = await fetch(`/api/admin/sops/departments/${confirmDelete.item.id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("fail");
        setDepartments((p) => p.filter((d) => d.id !== confirmDelete.item.id));
        addToast(localToast("sop-del-dept", "Deleted", "Department removed.", "normal"));
      } else if (confirmDelete.type === "role") {
        const res = await fetch(`/api/admin/sops/roles/${confirmDelete.item.id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("fail");
        setRoles((p) => p.filter((r) => r.id !== confirmDelete.item.id));
        if (selectedRole?.id === confirmDelete.item.id) setSelectedRole(null);
        addToast(localToast("sop-del-role", "Deleted", "Role removed.", "normal"));
      } else {
        const res = await fetch(`/api/admin/sops/functions/${confirmDelete.item.id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("fail");
        setFunctions((p) => p.filter((f) => f.id !== confirmDelete.item.id));
        addToast(localToast("sop-del-fn", "Deleted", "Function removed.", "normal"));
      }
      setConfirmDelete(null);
    } catch {
      addToast(localToast("sop-del-e", "Delete failed", "Could not delete. Try again.", "high"));
    } finally {
      setDeleteLoading(false);
    }
  }

  const motionCfg = useSopMotion();

  if (selectedRole) {
    const roleCfg = SOP_COLOR_STYLES[selectedRole.color];

    return (
      <SopShell>
        <motion.div
          className="mx-auto max-w-4xl px-4 py-8 md:py-10"
          initial="hidden"
          animate="show"
          variants={motionCfg.stagger}
        >
          <motion.button
            type="button"
            variants={motionCfg.reveal}
            onClick={() => setSelectedRole(null)}
            className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-sm font-medium text-white/70 transition hover:border-white/16 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to roles
          </motion.button>

          <motion.div
            variants={motionCfg.reveal}
            className="sop-glass-panel mb-8 flex flex-wrap items-start justify-between gap-4 rounded-2xl p-5 md:p-6"
          >
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-pink-400/55">SOP role</p>
              <h1 className={cn("flex items-center gap-3 text-2xl font-bold md:text-3xl", roleCfg.text)}>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-xl">
                  {selectedRole.icon || "📋"}
                </span>
                {selectedRole.name}
              </h1>
              <p className="mt-1.5 text-sm text-white/45">{selectedRole.slug}</p>
            </div>
            <ButtonPrimary type="button" onClick={openFnCreate}>
              <Plus className="mr-1.5 inline h-4 w-4" />
              New function
            </ButtonPrimary>
          </motion.div>

          {loadingFunctions ? (
            <div className="flex items-center justify-center py-20">
              <Spinner className="h-8 w-8 border-white/20 border-t-pink-400" />
            </div>
          ) : functions.length === 0 ? (
            <SopEmptyState
              icon={Layers}
              title="No functions yet"
              description="Add the first function for this role to define standards and KPIs."
            />
          ) : (
            <DndContext
              id="sop-functions"
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleFnDragEnd(e)}
            >
              <SortableContext items={functions.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <motion.div className="space-y-3" variants={motionCfg.stagger} initial="hidden" animate="show">
                  {functions.map((fn) => (
                    <SortableFunctionRow
                      key={fn.id}
                      fn={fn}
                      department={deptById.get(fn.department_id)}
                      onEdit={openFnEdit}
                      onDelete={(f) => setConfirmDelete({ type: "function", item: f })}
                    />
                  ))}
                </motion.div>
              </SortableContext>
            </DndContext>
          )}

          <AnimatePresence>
            {fnModalOpen ? (
              <GlassModal
                onClose={() => !fnSaving && setFnModalOpen(false)}
                title={fnEditing ? "Edit function" : "New function"}
                subtitle="Define the SOP steps, KPI, and cadence for this role."
                className={cn(SOP_MODAL_CLASS, "md:max-w-3xl")}
              >
            <input
              ref={fnFileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                void handleFnFileSelect(file);
              }}
            />
            <div className="space-y-4 px-4 pb-5 pt-2 md:px-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form id="sop-fn-form" onSubmit={saveFunction} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                      Function
                    </label>
                    <FormInput
                      value={fnForm.name}
                      onChange={(e) => setFnForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Morning inbox sweep"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                      Department
                    </label>
                    <FormSelect
                      value={fnForm.department_id}
                      onChange={(e) => setFnForm((f) => ({ ...f, department_id: e.target.value }))}
                    >
                      <option value="">— None —</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </FormSelect>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                      KPI
                    </label>
                    <FormTextarea
                      value={fnForm.kpi}
                      onChange={(e) => setFnForm((f) => ({ ...f, kpi: e.target.value }))}
                      rows={3}
                      placeholder="How success is measured…"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                        Cadence
                      </label>
                      <FormSelect
                        value={fnForm.cadence_type}
                        onChange={(e) =>
                          setFnForm((f) => ({
                            ...f,
                            cadence_type: e.target.value as CadenceType,
                          }))
                        }
                      >
                        {CADENCE_TYPES.map((c) => (
                          <option key={c} value={c}>
                            {CADENCE_LABELS[c]}
                          </option>
                        ))}
                      </FormSelect>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                        Cadence note
                      </label>
                      <FormInput
                        value={fnForm.cadence_note}
                        onChange={(e) => setFnForm((f) => ({ ...f, cadence_note: e.target.value }))}
                        placeholder="e.g. Mon & Thu"
                      />
                    </div>
                  </div>
                  <Checkbox
                    checked={fnForm.is_active}
                    onChange={(e) => setFnForm((f) => ({ ...f, is_active: e.target.checked }))}
                    label="Active"
                  />
                </form>
                <div className="space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Standard</p>
                  <div className="flex flex-wrap gap-4">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-white/75">
                      <input
                        type="radio"
                        name="sop-standard-type"
                        checked={fnForm.standard_type === "text"}
                        onChange={() => setFnForm((f) => ({ ...f, standard_type: "text" }))}
                        className="accent-pink-500"
                      />
                      Text (markdown)
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-white/75">
                      <input
                        type="radio"
                        name="sop-standard-type"
                        checked={fnForm.standard_type === "file"}
                        onChange={() => setFnForm((f) => ({ ...f, standard_type: "file" }))}
                        className="accent-pink-500"
                      />
                      File
                    </label>
                  </div>
                  {fnForm.standard_type === "text" ? (
                    <MarkdownField
                      label="SOP content"
                      value={fnForm.sop_content}
                      onChange={(v) => setFnForm((f) => ({ ...f, sop_content: v }))}
                      rows={10}
                      placeholder="Step-by-step instructions (markdown)…"
                    />
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
                        SOP file
                      </p>
                      {fnFileUploading ? (
                        <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                          <Spinner className="h-4 w-4 border-white/40 border-t-white" />
                          Uploading…
                        </div>
                      ) : fnForm.sop_file_url.trim() ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                            <span className="min-w-0 flex-1 truncate text-sm text-white/80">
                              {fnForm.sop_file_name || "Uploaded file"}
                            </span>
                            <button
                              type="button"
                              onClick={clearFnFile}
                              className="shrink-0 rounded-lg p-1.5 text-white/45 hover:bg-white/10 hover:text-white"
                              aria-label="Remove file"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <FilePreview
                            url={fnForm.sop_file_url}
                            name={fnForm.sop_file_name}
                            compact
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fnFileInputRef.current?.click()}
                          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/70 transition hover:border-pink-400/30 hover:bg-white/[0.06] hover:text-white"
                        >
                          <Upload className="h-4 w-4 text-pink-300/80" />
                          Choose file
                        </button>
                      )}
                      {fnFileUploadError ? (
                        <p className="text-xs text-rose-300/90">{fnFileUploadError}</p>
                      ) : null}
                      {fnForm.sop_file_url.trim() && !fnFileUploading ? (
                        <button
                          type="button"
                          onClick={() => fnFileInputRef.current?.click()}
                          className="text-xs font-medium text-pink-300/80 hover:text-pink-200"
                        >
                          Replace file
                        </button>
                      ) : null}
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                      Loom URL
                    </label>
                    <FormInput
                      value={fnForm.loom_url}
                      onChange={(e) => setFnForm((f) => ({ ...f, loom_url: e.target.value }))}
                      placeholder="https://www.loom.com/share/…"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <ButtonSecondary
                  type="button"
                  className="flex-1"
                  disabled={fnSaving || fnFileUploading}
                  onClick={() => setFnModalOpen(false)}
                >
                  Cancel
                </ButtonSecondary>
                <SubmitButton
                  form="sop-fn-form"
                  className="flex-1 !w-auto min-w-0"
                  disabled={fnSaving || fnFileUploading}
                >
                  {fnSaving ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Spinner className="h-4 w-4 border-white/40 border-t-white" />
                      Saving…
                    </span>
                  ) : (
                    "Save"
                  )}
                </SubmitButton>
              </div>
            </div>
              </GlassModal>
            ) : null}
          </AnimatePresence>

          <ConfirmDialog
            open={confirmDelete?.type === "function"}
            onClose={() => !deleteLoading && setConfirmDelete(null)}
            onConfirm={handleConfirmDelete}
            title="Delete function?"
            description={`Remove “${confirmDelete?.type === "function" ? confirmDelete.item.name : ""}”? This cannot be undone.`}
            confirmLabel="Delete"
            confirmVariant="danger"
            loading={deleteLoading}
          />
        </motion.div>
      </SopShell>
    );
  }

  return (
    <SopShell>
      <motion.div
        className="mx-auto max-w-3xl px-4 py-8 md:py-10"
        initial="hidden"
        animate="show"
        variants={motionCfg.stagger}
      >
        <motion.div variants={motionCfg.reveal} className="mb-8">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-pink-400/55">Administration</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">SOP Library</h1>
          <p className="mt-2 text-sm text-white/45">
            Manage departments, roles, and per-role functions · Drag to reorder
          </p>
        </motion.div>

        <motion.section variants={motionCfg.reveal} className="sop-glass-panel mb-8 overflow-hidden rounded-2xl">
          <div className="flex w-full items-center justify-between gap-3 px-4 py-4 md:px-5">
            <button
              type="button"
              onClick={() => setDeptOpen((o) => !o)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-90"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <Building2 className="h-4 w-4 text-white/50" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-white">Departments</h2>
                <p className="text-xs text-white/40">{departments.length} total</p>
              </div>
              <ChevronDown
                className={cn(
                  "ml-auto h-4 w-4 shrink-0 text-white/40 transition-transform duration-300",
                  deptOpen && "rotate-180"
                )}
              />
            </button>
            <button
              type="button"
              onClick={openDeptCreate}
              className="shrink-0 rounded-lg border border-pink-500/30 bg-pink-500/15 px-2.5 py-1.5 text-xs font-semibold text-pink-200 shadow-[0_0_16px_-6px_rgba(236,72,153,0.35)] transition hover:bg-pink-500/25"
            >
              <Plus className="inline h-3.5 w-3.5" />
              <span className="ml-1">Add</span>
            </button>
          </div>
          <AnimatePresence initial={false}>
            {deptOpen ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: motionCfg.tabTransition.duration }}
                className="overflow-hidden border-t border-white/[0.08]"
              >
                <div className="px-4 pb-4 pt-3 md:px-5">
                  {departments.length === 0 ? (
                    <p className="py-8 text-center text-sm text-white/35">No departments yet</p>
                  ) : (
                    <DndContext
                      id="sop-departments"
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) => handleDeptDragEnd(e)}
                    >
                      <SortableContext
                        items={departments.map((d) => d.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <motion.div className="space-y-2.5" variants={motionCfg.stagger} initial="hidden" animate="show">
                          {departments.map((dept) => (
                            <SortableDepartmentRow
                              key={dept.id}
                              dept={dept}
                              onEdit={openDeptEdit}
                              onDelete={(d) => setConfirmDelete({ type: "department", item: d })}
                            />
                          ))}
                        </motion.div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.section>

        <motion.section variants={motionCfg.reveal}>
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <Users className="h-4 w-4 text-white/50" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-white">Roles</h2>
                <p className="text-xs text-white/40">Click a role to manage its functions</p>
              </div>
            </div>
            <button
              type="button"
              onClick={openRoleCreate}
              className="flex items-center gap-1.5 rounded-xl border border-pink-500/30 bg-pink-500/15 px-3 py-2 text-xs font-semibold text-pink-200 shadow-[0_0_16px_-6px_rgba(236,72,153,0.35)] transition hover:bg-pink-500/25"
            >
              <Plus className="h-3.5 w-3.5" />
              New role
            </button>
          </div>

          {roles.length === 0 ? (
            <SopEmptyState icon={Users} title="No roles yet" description="Create a role to start building your SOP library." />
          ) : (
            <DndContext
              id="sop-roles"
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleRoleDragEnd(e)}
            >
              <SortableContext items={roles.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <motion.div className="space-y-3" variants={motionCfg.stagger} initial="hidden" animate="show">
                  {roles.map((role) => (
                    <SortableRoleRow
                      key={role.id}
                      role={role}
                      onEdit={openRoleEdit}
                      onDelete={(r) => setConfirmDelete({ type: "role", item: r })}
                      onOpen={setSelectedRole}
                    />
                  ))}
                </motion.div>
              </SortableContext>
            </DndContext>
          )}
        </motion.section>

        <AnimatePresence>
          {deptModalOpen ? (
            <GlassModal
              onClose={() => !deptSaving && setDeptModalOpen(false)}
              title={deptEditing ? "Edit department" : "New department"}
              subtitle="Group functions by department with a color badge."
              className={cn(SOP_MODAL_CLASS, "md:max-w-md")}
            >
          <form onSubmit={saveDept} className="space-y-4 px-4 pb-5 pt-2 md:px-5">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Name
              </label>
              <FormInput
                value={deptForm.name}
                onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Color
              </label>
              <ColorSelect
                value={deptForm.color}
                onChange={(c) => setDeptForm((f) => ({ ...f, color: c }))}
              />
            </div>
            <Checkbox
              checked={deptForm.is_active}
              onChange={(e) => setDeptForm((f) => ({ ...f, is_active: e.target.checked }))}
              label="Active"
            />
            <div className="flex gap-3 pt-2">
              <ButtonSecondary
                type="button"
                className="flex-1"
                disabled={deptSaving}
                onClick={() => setDeptModalOpen(false)}
              >
                Cancel
              </ButtonSecondary>
              <SubmitButton className="flex-1 !w-auto min-w-0" disabled={deptSaving}>
                {deptSaving ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Spinner className="h-4 w-4 border-white/40 border-t-white" />
                    Saving…
                  </span>
                ) : (
                  "Save"
                )}
              </SubmitButton>
            </div>
          </form>
            </GlassModal>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {roleModalOpen ? (
            <GlassModal
              onClose={() => !roleSaving && setRoleModalOpen(false)}
              title={roleEditing ? "Edit role" : "New role"}
              subtitle="Who sees this SOP role and which users it applies to."
              className={cn(SOP_MODAL_CLASS, "md:max-w-lg")}
            >
          <form onSubmit={saveRole} className="max-h-[70vh] space-y-4 overflow-y-auto px-4 pb-5 pt-2 md:px-5">
            <div className="grid grid-cols-[auto_1fr] gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  Icon
                </label>
                <FormInput
                  value={roleForm.icon}
                  onChange={(e) => setRoleForm((f) => ({ ...f, icon: e.target.value }))}
                  className="max-w-[4.5rem] text-center text-lg"
                  placeholder="📋"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  Name
                </label>
                <FormInput
                  value={roleForm.name}
                  onChange={(e) => updateRoleName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Slug
              </label>
              <FormInput
                value={roleForm.slug}
                onChange={(e) =>
                  setRoleForm((f) => ({ ...f, slug: e.target.value, slugManual: true }))
                }
                placeholder="auto-from-name"
                required
              />
            </div>
            <MarkdownField
              label="Description"
              value={roleForm.description}
              onChange={(v) => setRoleForm((f) => ({ ...f, description: v }))}
              rows={4}
            />
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Color
              </label>
              <ColorSelect
                value={roleForm.color}
                onChange={(c) => setRoleForm((f) => ({ ...f, color: c }))}
              />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Auth roles (who can see)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {AUTH_ROLES.map((ar) => (
                  <Checkbox
                    key={ar}
                    checked={roleForm.auth_roles.includes(ar)}
                    onChange={(e) => {
                      setRoleForm((f) => ({
                        ...f,
                        auth_roles: e.target.checked
                          ? [...f.auth_roles, ar]
                          : f.auth_roles.filter((x) => x !== ar),
                      }));
                    }}
                    label={AUTH_ROLE_LABELS[ar]}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Assigned users
              </p>
              <FormInput
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users…"
                className="mb-2"
              />
              <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2">
                {loadingUsers ? (
                  <p className="py-4 text-center text-xs text-white/40">Loading users…</p>
                ) : filteredUsers.length === 0 ? (
                  <p className="py-4 text-center text-xs text-white/40">No users match</p>
                ) : (
                  filteredUsers.map((u) => (
                    <Checkbox
                      key={u.id}
                      className="mb-1.5 last:mb-0"
                      checked={roleForm.assigned_user_ids.includes(u.id)}
                      onChange={(e) => {
                        setRoleForm((f) => ({
                          ...f,
                          assigned_user_ids: e.target.checked
                            ? [...f.assigned_user_ids, u.id]
                            : f.assigned_user_ids.filter((id) => id !== u.id),
                        }));
                      }}
                      label={
                        <span>
                          {u.name}{" "}
                          <span className="text-white/35">({u.role})</span>
                        </span>
                      }
                    />
                  ))
                )}
              </div>
            </div>
            <Checkbox
              checked={roleForm.is_active}
              onChange={(e) => setRoleForm((f) => ({ ...f, is_active: e.target.checked }))}
              label="Active"
            />
            <div className="flex gap-3 pt-2">
              <ButtonSecondary
                type="button"
                className="flex-1"
                disabled={roleSaving}
                onClick={() => setRoleModalOpen(false)}
              >
                Cancel
              </ButtonSecondary>
              <SubmitButton className="flex-1 !w-auto min-w-0" disabled={roleSaving}>
                {roleSaving ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Spinner className="h-4 w-4 border-white/40 border-t-white" />
                    Saving…
                  </span>
                ) : (
                  "Save"
                )}
              </SubmitButton>
            </div>
          </form>
            </GlassModal>
          ) : null}
        </AnimatePresence>

        <ConfirmDialog
          open={confirmDelete?.type === "department" || confirmDelete?.type === "role"}
          onClose={() => !deleteLoading && setConfirmDelete(null)}
          onConfirm={handleConfirmDelete}
          title={
            confirmDelete?.type === "department"
              ? "Delete department?"
              : confirmDelete?.type === "role"
                ? "Delete role?"
                : "Delete?"
          }
          description={
            confirmDelete
              ? `Remove “${confirmDelete.item.name}”? Linked functions may lose their department reference.`
              : ""
          }
          confirmLabel="Delete"
          confirmVariant="danger"
          loading={deleteLoading}
        />
      </motion.div>
    </SopShell>
  );
}
