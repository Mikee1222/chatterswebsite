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
  BarChart3,
  Building2,
  ChevronDown,
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
import { AdminSopOverviewPanel } from "@/components/admin-sop-overview-panel";
import { AdminSopQuizInsightsPanel } from "@/components/admin-sop-quiz-insights-panel";
import { useToast } from "@/contexts/toast-context";
import {
  Checkbox,
  ButtonPrimary,
  ButtonSecondary,
  SubmitButton,
} from "@/components/ui/form";
import { SopModalShell } from "@/components/sop/sop-modal-shell";
import { SopModalFooter } from "@/components/sop/sop-modal-footer";
import { SopFormSection } from "@/components/sop/sop-form-section";
import { SopFormLabel } from "@/components/sop/sop-form-label";
import { SopMarkdownField } from "@/components/sop/sop-markdown-field";
import { SopSegmentedToggle } from "@/components/sop/sop-segmented-toggle";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { SopSelect } from "@/components/sop/sop-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FilePreview } from "@/components/ui/file-preview";
import { Spinner } from "@/components/ui/spinner";
import { SopShell } from "@/components/sop/sop-shell";
import { SopEmptyState } from "@/components/sop/sop-empty-state";
import { SopGlowBadge } from "@/components/sop/sop-glow-badge";
import {
  CADENCE_LABELS,
  CADENCE_STYLES,
  CADENCE_TYPES,
  SOP_COLOR_STYLES,
} from "@/components/sop/sop-colors";
import { SopFunctionInfoCard } from "@/components/sop/sop-function-info-card";
import { SopIconPicker, SopRoleIcon, normalizeSopIconName } from "@/components/sop/sop-icons";
import { useSopMotion } from "@/components/sop/sop-motion";
import { SopCertificationMiniBadge } from "@/components/sop-certification-shelf";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types";
import type {
  SopCascadeDeleteImpact,
  SopDepartment,
  SopDepartmentDeleteImpact,
  SopRole,
  SopFunction,
  SopColor,
  SopAuthRole,
  CadenceType,
  StandardType,
  SopProgressUserSummary,
  SopQuizQuestion,
  SopQuizCorrectOption,
  SopFeedbackSummary,
  RoleRecord,
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

function sortRbacRolesForAccess(roles: RoleRecord[]): RoleRecord[] {
  return [...roles].sort((a, b) => {
    if (a.is_system_role !== b.is_system_role) {
      return a.is_system_role ? -1 : 1;
    }
    return a.label.localeCompare(b.label);
  });
}

type PickUser = { id: string; name: string; role: string };

function formatCascadeImpactLines(impact: SopCascadeDeleteImpact): string[] {
  const lines: string[] = [];
  if (impact.functions > 0) {
    lines.push(`${impact.functions} function${impact.functions === 1 ? "" : "s"}`);
  }
  if (impact.progress > 0) {
    lines.push(`${impact.progress} progress record${impact.progress === 1 ? "" : "s"}`);
  }
  if (impact.signoffs > 0) {
    lines.push(`${impact.signoffs} sign-off record${impact.signoffs === 1 ? "" : "s"}`);
  }
  if (impact.feedback > 0) {
    lines.push(`${impact.feedback} feedback record${impact.feedback === 1 ? "" : "s"}`);
  }
  if (impact.quiz_questions > 0) {
    lines.push(`${impact.quiz_questions} quiz question${impact.quiz_questions === 1 ? "" : "s"}`);
  }
  return lines;
}

function formatDepartmentBlockedMessage(impact: SopDepartmentDeleteImpact): string {
  const parts: string[] = [];
  if (impact.roles > 0) {
    parts.push(`${impact.roles} role${impact.roles === 1 ? "" : "s"}`);
  }
  if (impact.functions > 0) {
    parts.push(`${impact.functions} function${impact.functions === 1 ? "" : "s"}`);
  }
  return `Department in use by ${parts.join(" and ")}. Reassign or remove those links before deleting.`;
}

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

const NO_DEPT_GROUP_KEY = "__none__";

type RoleDeptGroup = {
  key: string;
  department: SopDepartment | null;
  roles: SopRole[];
};

type FnDeptGroup = {
  key: string;
  department: SopDepartment | undefined;
  functions: SopFunction[];
};

function groupRolesByDepartment(
  roles: SopRole[],
  departments: SopDepartment[],
  deptById: Map<string, SopDepartment>
): RoleDeptGroup[] {
  const sorted = sortRoles(roles);
  const byDept = new Map<string, SopRole[]>();
  const noDept: SopRole[] = [];

  for (const role of sorted) {
    const deptId = role.department_id?.trim();
    if (deptId) {
      const list = byDept.get(deptId) ?? [];
      list.push(role);
      byDept.set(deptId, list);
    } else {
      noDept.push(role);
    }
  }

  const groups: RoleDeptGroup[] = [];
  const seen = new Set<string>();

  for (const dept of sortDepartments(departments)) {
    const deptRoles = byDept.get(dept.id);
    if (deptRoles?.length) {
      groups.push({ key: dept.id, department: dept, roles: deptRoles });
      seen.add(dept.id);
    }
  }

  for (const [deptId, deptRoles] of byDept) {
    if (seen.has(deptId)) continue;
    groups.push({
      key: deptId,
      department: deptById.get(deptId) ?? null,
      roles: deptRoles,
    });
  }

  if (noDept.length > 0) {
    groups.push({ key: NO_DEPT_GROUP_KEY, department: null, roles: noDept });
  }

  return groups;
}

function flattenRoleGroups(groups: RoleDeptGroup[]): SopRole[] {
  return groups.flatMap((g) => g.roles);
}

function groupFunctionsForRole(
  functions: SopFunction[],
  role: SopRole | null,
  deptById: Map<string, SopDepartment>
): FnDeptGroup[] {
  const sorted = sortFunctions(functions);
  if (sorted.length === 0) return [];

  const deptId = role?.department_id?.trim() ?? "";
  const department = deptId ? deptById.get(deptId) : undefined;
  return [{ key: deptId || NO_DEPT_GROUP_KEY, department, functions: sorted }];
}

function flattenFnGroups(groups: FnDeptGroup[]): SopFunction[] {
  return groups.flatMap((g) => g.functions);
}

function findRoleGroupKey(roleId: string, groups: RoleDeptGroup[]): string | null {
  for (const g of groups) {
    if (g.roles.some((r) => r.id === roleId)) return g.key;
  }
  return null;
}

function findFnGroupKey(fnId: string, groups: FnDeptGroup[]): string | null {
  for (const g of groups) {
    if (g.functions.some((f) => f.id === fnId)) return g.key;
  }
  return null;
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
    <SopSelect
      id={id}
      value={value}
      onChange={(v) => onChange(v as SopColor)}
      options={SOP_COLORS.map((c) => ({
        value: c,
        label: c.charAt(0).toUpperCase() + c.slice(1),
      }))}
    />
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
        className="shrink-0 cursor-grab touch-none text-white/10 transition-colors hover:text-white/45 active:cursor-grabbing group-hover:text-white/25"
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
  department,
  onEdit,
  onDelete,
  onOpen,
}: {
  role: SopRole;
  department?: SopDepartment;
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
        className="shrink-0 cursor-grab touch-none text-white/10 transition-colors hover:text-white/45 active:cursor-grabbing group-hover:text-white/25"
        aria-label="Drag to reorder role"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center", cfg.text)}>
        <SopRoleIcon name={role.icon} size="md" className="opacity-75" />
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
        className="shrink-0 cursor-grab touch-none text-white/10 transition-colors hover:text-white/45 active:cursor-grabbing group-hover:text-white/25"
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
      <SopGlowBadge
        className={CADENCE_STYLES[fn.cadence_type].badge}
        glowClassName={CADENCE_STYLES[fn.cadence_type].glow}
      >
        {CADENCE_LABELS[fn.cadence_type]}
      </SopGlowBadge>
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
  department_id: string;
  auth_roles: SopAuthRole[];
  assigned_user_ids: string[];
  academy_mode: boolean;
  is_active: boolean;
};
type FunctionForm = {
  name: string;
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
    icon: "BookOpen",
    color: "blue",
    department_id: "",
    auth_roles: [],
    assigned_user_ids: [],
    academy_mode: false,
    is_active: true,
  };
}

function roleToForm(r: SopRole): RoleForm {
  return {
    name: r.name,
    slug: r.slug,
    slugManual: true,
    description: r.description,
    icon: normalizeSopIconName(r.icon),
    color: r.color,
    department_id: r.department_id,
    auth_roles: [...r.auth_roles],
    assigned_user_ids: [...r.assigned_user_ids],
    academy_mode: r.academy_mode,
    is_active: r.is_active,
  };
}

function emptyFunctionForm(): FunctionForm {
  return {
    name: "",
    kpi: "",
    standard_type: "text",
    sop_content: "",
    sop_file_url: "",
    sop_file_name: "",
    loom_url: "",
    cadence_type: "weekly",
    cadence_note: "",
    is_active: true,
  };
}

function fnToForm(f: SopFunction): FunctionForm {
  return {
    name: f.name,
    kpi: f.kpi,
    standard_type: f.standard_type,
    sop_content: f.sop_content,
    sop_file_url: f.sop_file_url,
    sop_file_name: f.sop_file_name,
    loom_url: f.loom_url,
    cadence_type: CADENCE_TYPES.includes(f.cadence_type) ? f.cadence_type : "weekly",
    cadence_note: f.cadence_note,
    is_active: f.is_active,
  };
}

function standardSnapshot(form: FunctionForm): string {
  return JSON.stringify({
    standard_type: form.standard_type,
    sop_content: form.sop_content,
    sop_file_url: form.sop_file_url,
    sop_file_name: form.sop_file_name,
  });
}

function emptyQuizDraft() {
  return {
    id: null as string | null,
    question: "",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_option: "a" as SopQuizCorrectOption,
  };
}

type Props = {
  initialDepartments: SopDepartment[];
  initialRoles: SopRole[];
  rbacRoles: RoleRecord[];
};

export function AdminSopLibraryClient({ initialDepartments, initialRoles, rbacRoles }: Props) {
  const { addToast } = useToast();
  const [mainTab, setMainTab] = React.useState<"overview" | "library">("overview");
  const [departments, setDepartments] = React.useState(() => sortDepartments(initialDepartments));
  const [roles, setRoles] = React.useState(() => sortRoles(initialRoles));
  const [deptOpen, setDeptOpen] = React.useState(true);
  const [selectedRole, setSelectedRole] = React.useState<SopRole | null>(null);
  const [functions, setFunctions] = React.useState<SopFunction[]>([]);
  const [collapsedFnGroups, setCollapsedFnGroups] = React.useState<Set<string>>(() => new Set());
  const [loadingFunctions, setLoadingFunctions] = React.useState(false);
  const [roleDetailTab, setRoleDetailTab] = React.useState<"functions" | "progress">("functions");
  const [progressRows, setProgressRows] = React.useState<SopProgressUserSummary[]>([]);
  const [loadingProgress, setLoadingProgress] = React.useState(false);
  const [progressTotalFunctions, setProgressTotalFunctions] = React.useState(0);
  const [feedbackSummaries, setFeedbackSummaries] = React.useState<SopFeedbackSummary[]>([]);
  const [loadingFeedback, setLoadingFeedback] = React.useState(false);

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
  const [fnInitialStandard, setFnInitialStandard] = React.useState("");
  const [quizQuestions, setQuizQuestions] = React.useState<SopQuizQuestion[]>([]);
  const [loadingQuiz, setLoadingQuiz] = React.useState(false);
  const [quizDraft, setQuizDraft] = React.useState<{
    id: string | null;
    question: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: SopQuizCorrectOption;
  } | null>(null);
  const [quizSaving, setQuizSaving] = React.useState(false);

  const [confirmDelete, setConfirmDelete] = React.useState<
    | { type: "department"; item: SopDepartment }
    | { type: "role"; item: SopRole }
    | { type: "function"; item: SopFunction }
    | null
  >(null);
  const [deleteImpact, setDeleteImpact] = React.useState<
    | { type: "department"; impact: SopDepartmentDeleteImpact }
    | { type: "role" | "function"; impact: SopCascadeDeleteImpact }
    | null
  >(null);
  const [deleteImpactLoading, setDeleteImpactLoading] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const accessRoles = React.useMemo(() => sortRbacRolesForAccess(rbacRoles), [rbacRoles]);

  React.useEffect(() => {
    setDepartments(sortDepartments(initialDepartments));
  }, [initialDepartments]);

  React.useEffect(() => {
    setRoles(sortRoles(initialRoles));
  }, [initialRoles]);

  React.useEffect(() => {
    if (!selectedRole) {
      setFunctions([]);
      setProgressRows([]);
      setRoleDetailTab("functions");
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
    if (!selectedRole || roleDetailTab !== "functions") {
      if (roleDetailTab !== "functions") setFeedbackSummaries([]);
      return;
    }
    setLoadingFeedback(true);
    fetch(`/api/admin/sops/feedback?role_id=${encodeURIComponent(selectedRole.id)}`)
      .then((r) => r.json())
      .then((d: { summaries?: SopFeedbackSummary[] }) => {
        if (Array.isArray(d.summaries)) setFeedbackSummaries(d.summaries);
        else setFeedbackSummaries([]);
      })
      .catch(() => setFeedbackSummaries([]))
      .finally(() => setLoadingFeedback(false));
  }, [selectedRole?.id, roleDetailTab]);

  React.useEffect(() => {
    if (!selectedRole || roleDetailTab !== "progress" || !selectedRole.academy_mode) {
      return;
    }
    setLoadingProgress(true);
    fetch(`/api/admin/sops/progress?role_id=${encodeURIComponent(selectedRole.id)}`)
      .then((r) => r.json())
      .then(
        (d: {
          users?: SopProgressUserSummary[];
          total_functions?: number;
        }) => {
          if (Array.isArray(d.users)) setProgressRows(d.users);
          else setProgressRows([]);
          setProgressTotalFunctions(
            typeof d.total_functions === "number" ? d.total_functions : 0
          );
        }
      )
      .catch(() => {
        setProgressRows([]);
        setProgressTotalFunctions(0);
      })
      .finally(() => setLoadingProgress(false));
  }, [selectedRole?.id, selectedRole?.academy_mode, roleDetailTab]);

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

  const roleGroups = React.useMemo(
    () => groupRolesByDepartment(roles, departments, deptById),
    [roles, departments, deptById]
  );

  const fnGroups = React.useMemo(
    () => groupFunctionsForRole(functions, selectedRole, deptById),
    [functions, selectedRole, deptById]
  );

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

    const activeGroupKey = findRoleGroupKey(String(active.id), roleGroups);
    const overGroupKey = findRoleGroupKey(String(over.id), roleGroups);
    if (!activeGroupKey || activeGroupKey !== overGroupKey) return;

    const group = roleGroups.find((g) => g.key === activeGroupKey);
    if (!group) return;

    const oldIndex = group.roles.findIndex((r) => r.id === active.id);
    const newIndex = group.roles.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reorderedGroupRoles = arrayMove(group.roles, oldIndex, newIndex);
    const nextGroups = roleGroups.map((g) =>
      g.key === activeGroupKey ? { ...g, roles: reorderedGroupRoles } : g
    );
    const reordered = flattenRoleGroups(nextGroups).map((r, i) => ({
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

    const activeGroupKey = findFnGroupKey(String(active.id), fnGroups);
    const overGroupKey = findFnGroupKey(String(over.id), fnGroups);
    if (!activeGroupKey || activeGroupKey !== overGroupKey) return;

    const group = fnGroups.find((g) => g.key === activeGroupKey);
    if (!group) return;

    const oldIndex = group.functions.findIndex((f) => f.id === active.id);
    const newIndex = group.functions.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reorderedGroupFns = arrayMove(group.functions, oldIndex, newIndex);
    const nextGroups = fnGroups.map((g) =>
      g.key === activeGroupKey ? { ...g, functions: reorderedGroupFns } : g
    );
    const reordered = flattenFnGroups(nextGroups).map((f, i) => ({
      ...f,
      sort_order: i + 1,
    }));
    const prev = functions;
    setFunctions(reordered);
    void reorderItems("/api/admin/sops/functions/reorder", reordered.map((f) => f.id), () =>
      setFunctions(prev)
    );
  }

  function toggleFnGroupCollapsed(key: string) {
    setCollapsedFnGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
        icon: normalizeSopIconName(roleForm.icon),
        color: roleForm.color,
        auth_roles: roleForm.auth_roles,
        assigned_user_ids: roleForm.assigned_user_ids,
        academy_mode: roleForm.academy_mode,
        department_id: roleForm.department_id,
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

  async function loadQuizQuestions(functionId: string) {
    setLoadingQuiz(true);
    try {
      const res = await fetch(
        `/api/admin/sops/quiz?function_id=${encodeURIComponent(functionId)}`
      );
      const data = (await res.json().catch(() => ({}))) as { questions?: SopQuizQuestion[] };
      setQuizQuestions(
        Array.isArray(data.questions)
          ? [...data.questions].sort((a, b) => a.sort_order - b.sort_order)
          : []
      );
    } catch {
      setQuizQuestions([]);
    } finally {
      setLoadingQuiz(false);
    }
  }

  function openFnCreate() {
    setFnEditing(null);
    setFnForm(emptyFunctionForm());
    setFnInitialStandard("");
    setQuizQuestions([]);
    setQuizDraft(null);
    setFnFileUploading(false);
    setFnFileUploadError("");
    setFnModalOpen(true);
  }

  function openFnEdit(f: SopFunction) {
    const form = fnToForm(f);
    setFnEditing(f);
    setFnForm(form);
    setFnInitialStandard(standardSnapshot(form));
    setQuizDraft(null);
    setFnFileUploading(false);
    setFnFileUploadError("");
    setFnModalOpen(true);
    void loadQuizQuestions(f.id);
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

  async function saveQuizQuestion() {
    if (!fnEditing || !quizDraft) return;
    if (!quizDraft.question.trim()) {
      addToast(localToast("sop-quiz-val", "Question required", "Enter the quiz question.", "normal"));
      return;
    }
    setQuizSaving(true);
    try {
      const payload = {
        sop_function_id: fnEditing.id,
        question: quizDraft.question.trim(),
        option_a: quizDraft.option_a.trim(),
        option_b: quizDraft.option_b.trim(),
        option_c: quizDraft.option_c.trim(),
        option_d: quizDraft.option_d.trim(),
        correct_option: quizDraft.correct_option,
      };
      if (quizDraft.id) {
        const res = await fetch(`/api/admin/sops/quiz/${quizDraft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as { question?: SopQuizQuestion };
        if (!res.ok) throw new Error("fail");
        if (data.question) {
          setQuizQuestions((p) =>
            [...p.map((q) => (q.id === data.question!.id ? data.question! : q))].sort(
              (a, b) => a.sort_order - b.sort_order
            )
          );
        }
      } else {
        const res = await fetch("/api/admin/sops/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as { question?: SopQuizQuestion };
        if (!res.ok) throw new Error("fail");
        if (data.question) {
          setQuizQuestions((p) => [...p, data.question!].sort((a, b) => a.sort_order - b.sort_order));
        }
      }
      setQuizDraft(null);
    } catch {
      addToast(localToast("sop-quiz-e", "Save failed", "Could not save quiz question.", "high"));
    } finally {
      setQuizSaving(false);
    }
  }

  async function deleteQuizQuestion(id: string) {
    try {
      const res = await fetch(`/api/admin/sops/quiz/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("fail");
      setQuizQuestions((p) => p.filter((q) => q.id !== id));
    } catch {
      addToast(localToast("sop-quiz-del", "Delete failed", "Could not delete question.", "high"));
    }
  }

  async function moveQuizQuestion(id: string, direction: "up" | "down") {
    const idx = quizQuestions.findIndex((q) => q.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= quizQuestions.length) return;
    const reordered = [...quizQuestions];
    const tmp = reordered[idx];
    reordered[idx] = reordered[swapIdx];
    reordered[swapIdx] = tmp;
    setQuizQuestions(reordered);
    try {
      await fetch("/api/admin/sops/quiz/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordered_ids: reordered.map((q) => q.id) }),
      });
    } catch {
      void loadQuizQuestions(fnEditing!.id);
    }
  }

  async function saveFunction(e: React.FormEvent, bumpVersion = false) {
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
        kpi: fnForm.kpi,
        standard_type: fnForm.standard_type,
        sop_content: fnForm.standard_type === "text" ? fnForm.sop_content : "",
        sop_file_url: fnForm.standard_type === "file" ? fnForm.sop_file_url : "",
        sop_file_name: fnForm.standard_type === "file" ? fnForm.sop_file_name : "",
        loom_url: fnForm.loom_url.trim(),
        cadence_type: fnForm.cadence_type,
        cadence_note: fnForm.cadence_note.trim(),
        is_active: fnForm.is_active,
        ...(fnEditing && bumpVersion ? { bumpVersion: true } : {}),
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

  async function openDeleteConfirm(
    target:
      | { type: "department"; item: SopDepartment }
      | { type: "role"; item: SopRole }
      | { type: "function"; item: SopFunction }
  ) {
    setConfirmDelete(target);
    setDeleteImpact(null);
    setDeleteImpactLoading(true);
    try {
      const path =
        target.type === "department"
          ? `/api/admin/sops/departments/${target.item.id}`
          : target.type === "role"
            ? `/api/admin/sops/roles/${target.item.id}`
            : `/api/admin/sops/functions/${target.item.id}`;
      const res = await fetch(path);
      const data = (await res.json().catch(() => ({}))) as {
        impact?: SopDepartmentDeleteImpact | SopCascadeDeleteImpact;
      };
      if (res.ok && data.impact) {
        if (target.type === "department") {
          setDeleteImpact({
            type: "department",
            impact: data.impact as SopDepartmentDeleteImpact,
          });
        } else {
          setDeleteImpact({
            type: target.type,
            impact: data.impact as SopCascadeDeleteImpact,
          });
        }
      }
    } catch {
      // Confirm still works without impact counts.
    } finally {
      setDeleteImpactLoading(false);
    }
  }

  function closeDeleteConfirm() {
    if (deleteLoading) return;
    setConfirmDelete(null);
    setDeleteImpact(null);
    setDeleteImpactLoading(false);
  }

  const departmentDeleteBlocked =
    confirmDelete?.type === "department" &&
    deleteImpact?.type === "department" &&
    deleteImpact.impact.blocked;

  const deleteConfirmDescription = React.useMemo(() => {
    if (!confirmDelete) return "";
    const name = confirmDelete.item.name;
    if (deleteImpactLoading) {
      return `Checking linked records for “${name}”…`;
    }
    if (confirmDelete.type === "department") {
      if (deleteImpact?.type === "department" && deleteImpact.impact.blocked) {
        return formatDepartmentBlockedMessage(deleteImpact.impact);
      }
      return `Remove “${name}”? This cannot be undone.`;
    }
    const cascade =
      deleteImpact && deleteImpact.type !== "department"
        ? formatCascadeImpactLines(deleteImpact.impact)
        : [];
    const cascadeText =
      cascade.length > 0
        ? ` This will also permanently delete ${cascade.join(", ")}.`
        : "";
    return `Remove “${name}”?${cascadeText} This cannot be undone.`;
  }, [confirmDelete, deleteImpact, deleteImpactLoading]);

  async function handleConfirmDelete() {
    if (!confirmDelete || departmentDeleteBlocked) return;
    setDeleteLoading(true);
    try {
      if (confirmDelete.type === "department") {
        const res = await fetch(`/api/admin/sops/departments/${confirmDelete.item.id}`, {
          method: "DELETE",
        });
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "Delete failed");
        }
        setDepartments((p) => p.filter((d) => d.id !== confirmDelete.item.id));
        addToast(localToast("sop-del-dept", "Deleted", "Department removed.", "normal"));
      } else if (confirmDelete.type === "role") {
        const res = await fetch(`/api/admin/sops/roles/${confirmDelete.item.id}`, {
          method: "DELETE",
        });
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "Delete failed");
        }
        setRoles((p) => p.filter((r) => r.id !== confirmDelete.item.id));
        if (selectedRole?.id === confirmDelete.item.id) setSelectedRole(null);
        addToast(localToast("sop-del-role", "Deleted", "Role removed.", "normal"));
      } else {
        const res = await fetch(`/api/admin/sops/functions/${confirmDelete.item.id}`, {
          method: "DELETE",
        });
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "Delete failed");
        }
        setFunctions((p) => p.filter((f) => f.id !== confirmDelete.item.id));
        addToast(localToast("sop-del-fn", "Deleted", "Function removed.", "normal"));
      }
      closeDeleteConfirm();
    } catch (e) {
      addToast(
        localToast(
          "sop-del-e",
          "Delete failed",
          e instanceof Error ? e.message : "Could not delete. Try again.",
          "high"
        )
      );
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
                <SopRoleIcon name={selectedRole.icon} size="lg" className="opacity-80" />
                {selectedRole.name}
              </h1>
              <p className="mt-1.5 text-sm text-white/45">{selectedRole.slug}</p>
            </div>
            {roleDetailTab === "functions" ? (
              <ButtonPrimary type="button" onClick={openFnCreate}>
                <Plus className="mr-1.5 inline h-4 w-4" />
                New function
              </ButtonPrimary>
            ) : null}
          </motion.div>

          <motion.div variants={motionCfg.reveal} className="mb-6 flex gap-2">
            <button
              type="button"
              onClick={() => setRoleDetailTab("functions")}
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-semibold transition",
                roleDetailTab === "functions"
                  ? "border-pink-500/35 bg-pink-500/15 text-pink-200"
                  : "border-white/10 bg-white/[0.04] text-white/50 hover:text-white/80"
              )}
            >
              Functions
            </button>
            <button
              type="button"
              onClick={() => setRoleDetailTab("progress")}
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-semibold transition",
                roleDetailTab === "progress"
                  ? "border-pink-500/35 bg-pink-500/15 text-pink-200"
                  : "border-white/10 bg-white/[0.04] text-white/50 hover:text-white/80"
              )}
            >
              Progress
            </button>
          </motion.div>

          {roleDetailTab === "progress" ? (
            !selectedRole.academy_mode ? (
              <SopEmptyState
                icon={Users}
                title="Academy mode off"
                description="Enable Academy mode on this role to track gated step-by-step training progress per user."
              />
            ) : loadingProgress ? (
              <div className="flex items-center justify-center py-20">
                <Spinner className="h-8 w-8 border-white/20 border-t-pink-400" />
              </div>
            ) : progressRows.length === 0 ? (
              <SopEmptyState
                icon={Users}
                title="No progress yet"
                description={`No users have completed steps for this role (${progressTotalFunctions} active functions).`}
              />
            ) : (
              <div className="space-y-6">
                <AdminSopQuizInsightsPanel roleId={selectedRole.id} />
                <div className="sop-glass-panel overflow-hidden rounded-2xl">
                <div className="sop-table-scroll overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-white/40">
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Completed</th>
                        <th className="px-4 py-3">%</th>
                        <th className="px-4 py-3">Quiz scores</th>
                        <th className="px-4 py-3">Sign-off</th>
                        <th className="px-4 py-3">Last activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressRows.map((row) => (
                        <tr
                          key={row.user_id}
                          className="border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.04]"
                        >
                          <td className="px-4 py-3 font-medium text-white/85">
                            {row.user_name}
                            {row.signoff_at || row.percent >= 100 ? (
                              <SopCertificationMiniBadge label="Certified" />
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-white/65">
                            {row.completed_count} / {row.total_functions}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                row.percent >= 100
                                  ? "bg-emerald-500/15 text-emerald-200"
                                  : "bg-white/10 text-white/70"
                              )}
                            >
                              {row.percent}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-white/50">
                            {row.quiz_scores.length > 0
                              ? row.quiz_scores.map((q) => `${q.score}%`).join(", ")
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-white/55">
                            {row.signoff_at ? (
                              <span className="inline-flex items-center gap-1 text-emerald-200/90">
                                ✓ {new Date(row.signoff_at).toLocaleDateString()}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-white/45">
                            {row.last_completed_at
                              ? new Date(row.last_completed_at).toLocaleString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
              </div>
            )
          ) : loadingFunctions ? (
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
              <motion.div className="space-y-5" variants={motionCfg.stagger} initial="hidden" animate="show">
                {fnGroups.map((group) => {
                  const deptCfg = group.department
                    ? SOP_COLOR_STYLES[group.department.color]
                    : SOP_COLOR_STYLES.gray;
                  const collapsed = collapsedFnGroups.has(group.key);
                  return (
                    <div key={group.key} className="space-y-2.5">
                      <button
                        type="button"
                        onClick={() => toggleFnGroupCollapsed(group.key)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition hover:bg-white/[0.03]",
                          group.department ? deptCfg.border : "border-white/10"
                        )}
                      >
                        {group.department ? (
                          <>
                            <div className={cn("h-2 w-2 shrink-0 rounded-full", deptCfg.dot)} />
                            <SopGlowBadge className={deptCfg.badge} glowClassName={deptCfg.glow}>
                              {group.department.name}
                            </SopGlowBadge>
                          </>
                        ) : (
                          <SopGlowBadge className="border-white/12 bg-white/[0.05] text-white/55">
                            No department
                          </SopGlowBadge>
                        )}
                        <span className="text-xs text-white/40">
                          {group.functions.length} function{group.functions.length !== 1 ? "s" : ""}
                        </span>
                        <ChevronDown
                          className={cn(
                            "ml-auto h-4 w-4 shrink-0 text-white/40 transition-transform duration-300",
                            !collapsed && "rotate-180"
                          )}
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {!collapsed ? (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: motionCfg.tabTransition.duration }}
                            className="overflow-hidden"
                          >
                            <SortableContext
                              items={group.functions.map((f) => f.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-3 pt-0.5">
                                {group.functions.map((fn) => (
                                  <SortableFunctionRow
                                    key={fn.id}
                                    fn={fn}
                                    department={
                                      selectedRole.department_id
                                        ? deptById.get(selectedRole.department_id)
                                        : undefined
                                    }
                                    onEdit={openFnEdit}
                                    onDelete={(f) => void openDeleteConfirm({ type: "function", item: f })}
                                  />
                                ))}
                              </div>
                            </SortableContext>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </motion.div>
            </DndContext>
          )}

          {roleDetailTab === "functions" && !loadingFeedback && feedbackSummaries.some((s) => s.total > 0) ? (
            <div className="sop-glass-panel mt-6 rounded-2xl p-5">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-white/40">
                Member feedback
              </p>
              <div className="space-y-3">
                {feedbackSummaries
                  .filter((s) => s.total > 0)
                  .map((summary) => {
                    const fn = functions.find((f) => f.id === summary.function_id);
                    return (
                      <div
                        key={summary.function_id}
                        className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-white/85">
                            {fn?.name ?? summary.function_id}
                          </p>
                          <span className="text-xs text-white/50">
                            {summary.helpful_pct}% helpful ({summary.helpful_yes}/{summary.total})
                          </span>
                        </div>
                        {summary.comments.length > 0 ? (
                          <ul className="mt-2 space-y-1.5 border-t border-white/[0.06] pt-2">
                            {summary.comments.slice(0, 3).map((c, i) => (
                              <li key={i} className="text-xs text-white/55">
                                <span className="text-white/35">{c.helpful === "yes" ? "👍" : "👎"}</span>{" "}
                                {c.comment}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}

          <AnimatePresence>
            {fnModalOpen ? (
              <SopModalShell
                onClose={() => !fnSaving && setFnModalOpen(false)}
                closeDisabled={fnSaving || fnFileUploading}
                title={fnEditing ? "Edit function" : "New function"}
                subtitle="Define the SOP steps, KPI, and cadence for this role."
                size="xl"
                className={SOP_MODAL_CLASS}
                footer={
                  <SopModalFooter>
                    <ButtonSecondary
                      type="button"
                      className="min-h-[44px] flex-1 sm:min-w-[120px]"
                      disabled={fnSaving || fnFileUploading}
                      onClick={() => setFnModalOpen(false)}
                    >
                      Cancel
                    </ButtonSecondary>
                    {fnEditing && standardSnapshot(fnForm) !== fnInitialStandard ? (
                      <>
                        <SubmitButton
                          form="sop-fn-form"
                          className="min-h-[44px] flex-1 !w-auto min-w-0"
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
                        <ButtonPrimary
                          type="button"
                          className="min-h-[44px] flex-1 min-w-0"
                          disabled={fnSaving || fnFileUploading}
                          onClick={(e) => void saveFunction(e as unknown as React.FormEvent, true)}
                        >
                          Save & require re-training
                        </ButtonPrimary>
                      </>
                    ) : (
                      <SubmitButton
                        form="sop-fn-form"
                        className="min-h-[44px] flex-1 !w-auto min-w-0"
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
                    )}
                  </SopModalFooter>
                }
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
                <div className="space-y-4 px-4 py-4 md:px-5 md:py-5">
                  <form id="sop-fn-form" onSubmit={saveFunction} className="space-y-4">
                    <SopFormSection
                      title="Basics"
                      description="Name, cadence, and KPI (department inherited from role)"
                      defaultOpen
                    >
                      <div>
                        <SopFormLabel htmlFor="sop-fn-name">Function</SopFormLabel>
                        <FormInput
                          id="sop-fn-name"
                          value={fnForm.name}
                          onChange={(e) => setFnForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="e.g. Morning inbox sweep"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <SopFormLabel htmlFor="sop-fn-cadence">Cadence</SopFormLabel>
                          <SopSelect
                            id="sop-fn-cadence"
                            value={fnForm.cadence_type}
                            onChange={(v) =>
                              setFnForm((f) => ({
                                ...f,
                                cadence_type: v as CadenceType,
                              }))
                            }
                            options={CADENCE_TYPES.map((c) => ({
                              value: c,
                              label: CADENCE_LABELS[c],
                            }))}
                          />
                        </div>
                        <div>
                          <SopFormLabel htmlFor="sop-fn-cadence-note">Cadence note</SopFormLabel>
                          <FormInput
                            id="sop-fn-cadence-note"
                            value={fnForm.cadence_note}
                            onChange={(e) => setFnForm((f) => ({ ...f, cadence_note: e.target.value }))}
                            placeholder="e.g. Mon & Thu"
                          />
                        </div>
                      </div>
                      <div>
                        <SopFormLabel htmlFor="sop-fn-kpi">KPI</SopFormLabel>
                        <FormTextarea
                          id="sop-fn-kpi"
                          value={fnForm.kpi}
                          onChange={(e) => setFnForm((f) => ({ ...f, kpi: e.target.value }))}
                          rows={3}
                          placeholder="How success is measured…"
                        />
                      </div>
                      {fnEditing ? (
                        <SopFunctionInfoCard
                          fn={{
                            ...fnEditing,
                            name: fnForm.name.trim() || fnEditing.name,
                            kpi: fnForm.kpi,
                            cadence_type: fnForm.cadence_type,
                            cadence_note: fnForm.cadence_note,
                          }}
                          department={
                            selectedRole?.department_id
                              ? deptById.get(selectedRole.department_id)
                              : undefined
                          }
                          compact
                        />
                      ) : null}
                      <Checkbox
                        checked={fnForm.is_active}
                        onChange={(e) => setFnForm((f) => ({ ...f, is_active: e.target.checked }))}
                        label="Active"
                      />
                    </SopFormSection>

                    <SopFormSection
                      title="Standard"
                      description="SOP content as markdown or file, plus optional Loom"
                      defaultOpen={false}
                    >
                      <div>
                        <SopFormLabel className="mb-3">Content type</SopFormLabel>
                        <SopSegmentedToggle
                          name="sop-standard-type"
                          value={fnForm.standard_type}
                          onChange={(v) => setFnForm((f) => ({ ...f, standard_type: v }))}
                          options={[
                            { value: "text", label: "Text (markdown)" },
                            { value: "file", label: "File upload" },
                          ]}
                        />
                      </div>
                      {fnForm.standard_type === "text" ? (
                        <SopMarkdownField
                          label="SOP content"
                          value={fnForm.sop_content}
                          onChange={(v) => setFnForm((f) => ({ ...f, sop_content: v }))}
                          rows={10}
                          placeholder="Step-by-step instructions (markdown)…"
                        />
                      ) : (
                        <div className="space-y-3">
                          <SopFormLabel>SOP file</SopFormLabel>
                          {fnFileUploading ? (
                            <div className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                              <Spinner className="h-5 w-5 border-white/40 border-t-white" />
                              Uploading…
                            </div>
                          ) : fnForm.sop_file_url.trim() ? (
                            <div className="space-y-3">
                              <div className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <span className="min-w-0 flex-1 truncate text-sm text-white/80">
                                  {fnForm.sop_file_name || "Uploaded file"}
                                </span>
                                <button
                                  type="button"
                                  onClick={clearFnFile}
                                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/45 transition hover:bg-white/10 hover:text-white"
                                  aria-label="Remove file"
                                >
                                  <X className="h-5 w-5" />
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
                              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-4 text-sm font-medium text-white/70 transition hover:border-pink-400/30 hover:bg-white/[0.06] hover:text-white"
                            >
                              <Upload className="h-5 w-5 text-pink-300/80" />
                              Choose file
                            </button>
                          )}
                          {fnFileUploadError ? (
                            <p className="text-xs text-rose-300/95" role="alert">
                              {fnFileUploadError}
                            </p>
                          ) : null}
                          {fnForm.sop_file_url.trim() && !fnFileUploading ? (
                            <button
                              type="button"
                              onClick={() => fnFileInputRef.current?.click()}
                              className="min-h-[44px] text-sm font-medium text-pink-300/80 hover:text-pink-200"
                            >
                              Replace file
                            </button>
                          ) : null}
                        </div>
                      )}
                      <div>
                        <SopFormLabel htmlFor="sop-fn-loom">Loom URL</SopFormLabel>
                        <FormInput
                          id="sop-fn-loom"
                          type="url"
                          inputMode="url"
                          autoComplete="url"
                          value={fnForm.loom_url}
                          onChange={(e) => setFnForm((f) => ({ ...f, loom_url: e.target.value }))}
                          placeholder="https://www.loom.com/share/…"
                        />
                      </div>
                    </SopFormSection>
                  </form>

                  <SopFormSection
                    title="Quiz"
                    description="Optional questions — members can complete without a quiz"
                    defaultOpen={false}
                  >
                    {fnEditing ? (
                      <>
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => setQuizDraft(emptyQuizDraft())}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white/65 transition hover:border-pink-500/25 hover:text-white/90"
                        >
                          <Plus className="h-4 w-4" />
                          Add question
                        </button>
                      </div>
                      {loadingQuiz ? (
                        <div className="flex justify-center py-6">
                          <Spinner className="h-6 w-6 border-white/20 border-t-pink-400" />
                        </div>
                      ) : quizQuestions.length === 0 ? (
                        <p className="text-sm text-white/40">
                          No quiz questions — members can complete without a quiz.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {quizQuestions.map((q, idx) => (
                            <div
                              key={q.id}
                              className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium leading-snug text-white/85">
                                  {q.question}
                                </p>
                                <p className="mt-1 text-xs text-white/40">
                                  Correct: {q.correct_option.toUpperCase()}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => void moveQuizQuestion(q.id, "up")}
                                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white/45 transition hover:bg-white/10 disabled:opacity-30"
                                  aria-label="Move up"
                                >
                                  <ChevronDown className="h-5 w-5 rotate-180" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === quizQuestions.length - 1}
                                  onClick={() => void moveQuizQuestion(q.id, "down")}
                                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white/45 transition hover:bg-white/10 disabled:opacity-30"
                                  aria-label="Move down"
                                >
                                  <ChevronDown className="h-5 w-5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQuizDraft({
                                      id: q.id,
                                      question: q.question,
                                      option_a: q.option_a,
                                      option_b: q.option_b,
                                      option_c: q.option_c,
                                      option_d: q.option_d,
                                      correct_option: q.correct_option,
                                    })
                                  }
                                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/10"
                                  aria-label="Edit question"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteQuizQuestion(q.id)}
                                  className="flex h-11 w-11 items-center justify-center rounded-xl text-rose-300/80 transition hover:bg-rose-500/15"
                                  aria-label="Delete question"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {quizDraft ? (
                        <div className="space-y-4 rounded-xl border border-pink-500/25 bg-pink-500/[0.06] p-4">
                          <FormTextarea
                            value={quizDraft.question}
                            onChange={(e) =>
                              setQuizDraft((d) => (d ? { ...d, question: e.target.value } : d))
                            }
                            rows={3}
                            placeholder="Question text…"
                          />
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
                            Tap the correct answer
                          </p>
                          <div className="space-y-3">
                            {(["a", "b", "c", "d"] as const).map((opt) => (
                              <label
                                key={opt}
                                className={cn(
                                  "flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition",
                                  quizDraft.correct_option === opt
                                    ? "border-pink-500/40 bg-pink-500/10"
                                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                                )}
                              >
                                <input
                                  type="radio"
                                  name="quiz-correct"
                                  checked={quizDraft.correct_option === opt}
                                  onChange={() =>
                                    setQuizDraft((d) => (d ? { ...d, correct_option: opt } : d))
                                  }
                                  className="h-5 w-5 shrink-0 accent-pink-500"
                                />
                                <span className="w-5 text-xs font-bold uppercase text-white/45">
                                  {opt}
                                </span>
                                <FormInput
                                  value={quizDraft[`option_${opt}`]}
                                  onChange={(e) =>
                                    setQuizDraft((d) =>
                                      d ? { ...d, [`option_${opt}`]: e.target.value } : d
                                    )
                                  }
                                  placeholder={`Option ${opt.toUpperCase()}`}
                                  className="flex-1"
                                />
                              </label>
                            ))}
                          </div>
                          <div className="flex flex-col gap-3 sm:flex-row">
                            <ButtonSecondary
                              type="button"
                              className="min-h-[44px] flex-1"
                              onClick={() => setQuizDraft(null)}
                            >
                              Cancel
                            </ButtonSecondary>
                            <ButtonPrimary
                              type="button"
                              className="min-h-[44px] flex-1"
                              disabled={quizSaving}
                              onClick={() => void saveQuizQuestion()}
                            >
                              {quizSaving ? "Saving…" : quizDraft.id ? "Update question" : "Add question"}
                            </ButtonPrimary>
                          </div>
                        </div>
                      ) : null}
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4">
                        <p className="text-sm leading-relaxed text-white/45">
                          Αποθήκευσε πρώτα τη function για να προσθέσεις ερωτήσεις quiz.
                        </p>
                        <button
                          type="button"
                          disabled
                          className="mt-3 inline-flex min-h-[44px] cursor-not-allowed items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white/30"
                        >
                          <Plus className="h-4 w-4" />
                          Add question
                        </button>
                      </div>
                    )}
                  </SopFormSection>
                </div>
              </SopModalShell>
            ) : null}
          </AnimatePresence>

          <ConfirmDialog
            open={confirmDelete?.type === "function"}
            onClose={closeDeleteConfirm}
            onConfirm={departmentDeleteBlocked ? closeDeleteConfirm : handleConfirmDelete}
            title="Delete function?"
            description={deleteConfirmDescription}
            confirmLabel={departmentDeleteBlocked ? "OK" : "Delete"}
            confirmVariant={departmentDeleteBlocked ? "default" : "danger"}
            loading={deleteLoading || deleteImpactLoading}
          />
        </motion.div>
      </SopShell>
    );
  }

  return (
    <SopShell>
      <motion.div
        className={cn(
          "mx-auto px-4 py-8 md:py-10",
          mainTab === "overview" ? "max-w-5xl" : "max-w-3xl"
        )}
        initial="hidden"
        animate="show"
        variants={motionCfg.stagger}
      >
        <motion.div variants={motionCfg.reveal} className="mb-8">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-pink-400/55">Administration</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">SOP Library</h1>
          <p className="mt-2 text-sm text-white/45">
            Academy overview, departments, roles, and per-role functions
          </p>
        </motion.div>

        <motion.div variants={motionCfg.reveal} className="mb-8 flex gap-2">
          <button
            type="button"
            onClick={() => setMainTab("overview")}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition",
              mainTab === "overview"
                ? "border-pink-500/35 bg-pink-500/15 text-pink-200"
                : "border-white/10 bg-white/[0.04] text-white/50 hover:text-white/80"
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Overview
          </button>
          <button
            type="button"
            onClick={() => setMainTab("library")}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition",
              mainTab === "library"
                ? "border-pink-500/35 bg-pink-500/15 text-pink-200"
                : "border-white/10 bg-white/[0.04] text-white/50 hover:text-white/80"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            Library
          </button>
        </motion.div>

        {mainTab === "overview" ? (
          <motion.div variants={motionCfg.reveal}>
            <AdminSopOverviewPanel />
          </motion.div>
        ) : (
          <>
        <motion.section variants={motionCfg.reveal} className="sop-glass-panel mb-8 overflow-hidden rounded-2xl">
          <div className="flex w-full items-center justify-between gap-3 px-4 py-4 md:px-5">
            <button
              type="button"
              onClick={() => setDeptOpen((o) => !o)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-90"
            >
              <Building2 className="h-5 w-5 shrink-0 text-white/40" />
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
                              onDelete={(d) => void openDeleteConfirm({ type: "department", item: d })}
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
              <Users className="h-5 w-5 shrink-0 text-white/40" />
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
              <motion.div className="space-y-6" variants={motionCfg.stagger} initial="hidden" animate="show">
                {roleGroups.map((group) => {
                  const deptCfg = group.department
                    ? SOP_COLOR_STYLES[group.department.color]
                    : SOP_COLOR_STYLES.gray;
                  return (
                    <div key={group.key} className="space-y-3">
                      <div className="flex items-center gap-2.5 px-1">
                        {group.department ? (
                          <>
                            <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full", deptCfg.dot)} />
                            <SopGlowBadge className={deptCfg.badge} glowClassName={deptCfg.glow}>
                              {group.department.name}
                            </SopGlowBadge>
                          </>
                        ) : (
                          <SopGlowBadge className="border-white/12 bg-white/[0.05] text-white/55">
                            No department
                          </SopGlowBadge>
                        )}
                        <span className="text-xs text-white/35">
                          {group.roles.length} role{group.roles.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <SortableContext
                        items={group.roles.map((r) => r.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {group.roles.map((role) => (
                            <SortableRoleRow
                              key={role.id}
                              role={role}
                              department={
                                role.department_id
                                  ? deptById.get(role.department_id)
                                  : undefined
                              }
                              onEdit={openRoleEdit}
                              onDelete={(r) => void openDeleteConfirm({ type: "role", item: r })}
                              onOpen={setSelectedRole}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </div>
                  );
                })}
              </motion.div>
            </DndContext>
          )}
        </motion.section>

        <AnimatePresence>
          {deptModalOpen ? (
            <SopModalShell
              onClose={() => !deptSaving && setDeptModalOpen(false)}
              closeDisabled={deptSaving}
              title={deptEditing ? "Edit department" : "New department"}
              subtitle="Group functions by department with a color badge."
              size="sm"
              className={SOP_MODAL_CLASS}
              footer={
                <SopModalFooter>
                  <ButtonSecondary
                    type="button"
                    className="min-h-[44px] flex-1"
                    disabled={deptSaving}
                    onClick={() => setDeptModalOpen(false)}
                  >
                    Cancel
                  </ButtonSecondary>
                  <SubmitButton
                    form="sop-dept-form"
                    className="min-h-[44px] flex-1 !w-auto min-w-0"
                    disabled={deptSaving}
                  >
                    {deptSaving ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Spinner className="h-4 w-4 border-white/40 border-t-white" />
                        Saving…
                      </span>
                    ) : (
                      "Save"
                    )}
                  </SubmitButton>
                </SopModalFooter>
              }
            >
              <form
                id="sop-dept-form"
                onSubmit={saveDept}
                className="space-y-5 px-4 py-4 md:px-5 md:py-5"
              >
                <div>
                  <SopFormLabel htmlFor="sop-dept-name">Name</SopFormLabel>
                  <FormInput
                    id="sop-dept-name"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <SopFormLabel htmlFor="sop-dept-color">Color</SopFormLabel>
                  <ColorSelect
                    id="sop-dept-color"
                    value={deptForm.color}
                    onChange={(c) => setDeptForm((f) => ({ ...f, color: c }))}
                  />
                </div>
                <Checkbox
                  checked={deptForm.is_active}
                  onChange={(e) => setDeptForm((f) => ({ ...f, is_active: e.target.checked }))}
                  label="Active"
                />
              </form>
            </SopModalShell>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {roleModalOpen ? (
            <SopModalShell
              onClose={() => !roleSaving && setRoleModalOpen(false)}
              closeDisabled={roleSaving}
              title={roleEditing ? "Edit role" : "New role"}
              subtitle="Who sees this SOP role and which users it applies to."
              size="lg"
              className={SOP_MODAL_CLASS}
              footer={
                <SopModalFooter>
                  <ButtonSecondary
                    type="button"
                    className="min-h-[44px] flex-1"
                    disabled={roleSaving}
                    onClick={() => setRoleModalOpen(false)}
                  >
                    Cancel
                  </ButtonSecondary>
                  <SubmitButton
                    form="sop-role-form"
                    className="min-h-[44px] flex-1 !w-auto min-w-0"
                    disabled={roleSaving}
                  >
                    {roleSaving ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Spinner className="h-4 w-4 border-white/40 border-t-white" />
                        Saving…
                      </span>
                    ) : (
                      "Save"
                    )}
                  </SubmitButton>
                </SopModalFooter>
              }
            >
              <form id="sop-role-form" onSubmit={saveRole} className="space-y-4 px-4 py-4 md:px-5 md:py-5">
                <SopFormSection title="Identity" description="Icon, name, slug, and description" defaultOpen>
                  <div>
                    <SopFormLabel>Icon</SopFormLabel>
                    <SopIconPicker
                      value={roleForm.icon}
                      onChange={(icon) => setRoleForm((f) => ({ ...f, icon }))}
                    />
                  </div>
                  <div>
                    <SopFormLabel htmlFor="sop-role-name">Name</SopFormLabel>
                    <FormInput
                      id="sop-role-name"
                      value={roleForm.name}
                      onChange={(e) => updateRoleName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <SopFormLabel htmlFor="sop-role-slug">Slug</SopFormLabel>
                    <FormInput
                      id="sop-role-slug"
                      value={roleForm.slug}
                      onChange={(e) =>
                        setRoleForm((f) => ({ ...f, slug: e.target.value, slugManual: true }))
                      }
                      placeholder="auto-from-name"
                      required
                    />
                  </div>
                  <SopMarkdownField
                    label="Description"
                    value={roleForm.description}
                    onChange={(v) => setRoleForm((f) => ({ ...f, description: v }))}
                    rows={4}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <SopFormLabel htmlFor="sop-role-color">Color</SopFormLabel>
                      <ColorSelect
                        id="sop-role-color"
                        value={roleForm.color}
                        onChange={(c) => setRoleForm((f) => ({ ...f, color: c }))}
                      />
                    </div>
                    <div>
                      <SopFormLabel htmlFor="sop-role-dept">Department</SopFormLabel>
                      <SopSelect
                        id="sop-role-dept"
                        value={roleForm.department_id}
                        onChange={(v) => setRoleForm((f) => ({ ...f, department_id: v }))}
                        options={[
                          { value: "", label: "— None —" },
                          ...departments.map((d) => ({ value: d.id, label: d.name })),
                        ]}
                      />
                    </div>
                  </div>
                </SopFormSection>

                <SopFormSection
                  title="Access"
                  description="Auth roles and assigned users"
                  defaultOpen={false}
                >
                  <div>
                    <SopFormLabel className="mb-3">Auth roles (who can see)</SopFormLabel>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {accessRoles.map((rbacRole) => (
                        <Checkbox
                          key={rbacRole.role_id}
                          className="min-h-[44px] rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5"
                          checked={roleForm.auth_roles.some(
                            (ar) => ar.toLowerCase() === rbacRole.role_id.toLowerCase()
                          )}
                          onChange={(e) => {
                            setRoleForm((f) => ({
                              ...f,
                              auth_roles: e.target.checked
                                ? [...f.auth_roles.filter(
                                    (x) => x.toLowerCase() !== rbacRole.role_id.toLowerCase()
                                  ), rbacRole.role_id]
                                : f.auth_roles.filter(
                                    (x) => x.toLowerCase() !== rbacRole.role_id.toLowerCase()
                                  ),
                            }));
                          }}
                          label={rbacRole.label}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <SopFormLabel htmlFor="sop-role-user-search">Assigned users</SopFormLabel>
                    <FormInput
                      id="sop-role-user-search"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search users…"
                      className="mb-3"
                    />
                    <div className="max-h-48 overflow-y-auto rounded-2xl border border-white/10 bg-black/25 p-3 sm:max-h-56">
                      {loadingUsers ? (
                        <p className="py-6 text-center text-sm text-white/40">Loading users…</p>
                      ) : filteredUsers.length === 0 ? (
                        <p className="py-6 text-center text-sm text-white/40">No users match</p>
                      ) : (
                        filteredUsers.map((u) => (
                          <Checkbox
                            key={u.id}
                            className="mb-2 min-h-[44px] rounded-xl px-2 py-2 last:mb-0 hover:bg-white/[0.03]"
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
                </SopFormSection>

                <SopFormSection title="Settings" defaultOpen={false}>
                  <Checkbox
                    checked={roleForm.academy_mode}
                    onChange={(e) => setRoleForm((f) => ({ ...f, academy_mode: e.target.checked }))}
                    label="Academy mode"
                  />
                  <p className="text-xs leading-relaxed text-white/40">
                    Gated step-by-step training: members complete one function at a time in sort
                    order. Progress is tracked per user for this role.
                  </p>
                  <Checkbox
                    checked={roleForm.is_active}
                    onChange={(e) => setRoleForm((f) => ({ ...f, is_active: e.target.checked }))}
                    label="Active"
                  />
                </SopFormSection>
              </form>
            </SopModalShell>
          ) : null}
        </AnimatePresence>

        <ConfirmDialog
          open={confirmDelete?.type === "department" || confirmDelete?.type === "role"}
          onClose={closeDeleteConfirm}
          onConfirm={departmentDeleteBlocked ? closeDeleteConfirm : handleConfirmDelete}
          title={
            departmentDeleteBlocked
              ? "Cannot delete department"
              : confirmDelete?.type === "department"
                ? "Delete department?"
                : confirmDelete?.type === "role"
                  ? "Delete role?"
                  : "Delete?"
          }
          description={deleteConfirmDescription}
          confirmLabel={departmentDeleteBlocked ? "OK" : "Delete"}
          confirmVariant={departmentDeleteBlocked ? "default" : "danger"}
          loading={deleteLoading || deleteImpactLoading}
        />
          </>
        )}
      </motion.div>
    </SopShell>
  );
}
