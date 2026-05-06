import { getModelContext } from "@/lib/model-context-server";
import { listModelTasks } from "@/services/model-tasks";

export default async function ModelTasksPage() {
  const { user, linkedModelId, modelRecord, language } = await getModelContext();

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Tasks</h1>
        <p className="text-white/70">Please log in.</p>
      </div>
    );
  }

  if (!linkedModelId || !modelRecord) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Tasks</h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Your account is not linked to a model profile. Contact an admin to link your account.
        </p>
      </div>
    );
  }

  const tasks = await listModelTasks(linkedModelId);

  return (
    <div className="space-y-8 pb-8 md:space-y-10 md:pb-10">
      <header className="max-md:pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          {language === "es" ? "Tareas" : "Tasks"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          {language === "es" ? "Tus tareas" : "Your tasks"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55 md:text-[15px]">
          {language === "es"
            ? "Lista de tareas asignadas a tu perfil."
            : "Tasks assigned to your model profile."}
        </p>
      </header>

      {tasks.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/55">
          {language === "es" ? "No hay tareas por ahora." : "No tasks yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-white">{t.title || "Task"}</span>
                <span className="rounded-lg border border-pink-400/25 bg-pink-500/10 px-2 py-0.5 text-xs font-medium capitalize text-pink-100">
                  {t.status}
                </span>
              </div>
              {t.type ? <p className="mt-1 text-xs text-white/45">{t.type}</p> : null}
              {t.description ? <p className="mt-2 text-sm text-white/70">{t.description}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
