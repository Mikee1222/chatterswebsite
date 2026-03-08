"use client";

import * as React from "react";
import Link from "next/link";
import type { UserRecord } from "@/types";
import { toggleCanLogin, deleteUserAction } from "@/app/actions/accounts";
import { ROUTES } from "@/lib/routes";

export function AccountsTable({ users }: { users: UserRecord[] }) {
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleConfirmDelete() {
    if (!deleteConfirmId) return;
    setDeletingId(deleteConfirmId);
    try {
      await deleteUserAction(deleteConfirmId);
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  }

  return (
    <>
      {/* Delete confirmation modal */}
      {deleteConfirmId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f0f] p-6 shadow-xl" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06)" }}>
            <h2 id="delete-user-title" className="text-lg font-semibold text-white">Delete user?</h2>
            <p className="mt-2 text-sm text-white/70">This action cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deletingId !== null}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId !== null}
                className="rounded-xl bg-red-600/90 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deletingId ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile: stacked cards */}
      <div className="space-y-4 md:hidden">
        {users.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/50">No users yet. Create one below.</p>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04)" }}
            >
              <p className="text-base font-semibold text-white/95">{u.full_name}</p>
              <p className="mt-0.5 text-sm text-white/70">{u.email}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="capitalize text-white/80">Role: {u.role.replace("_", " ")}</span>
                <span className="text-white/60">·</span>
                <span className="text-white/80">Status: {u.status || "—"}</span>
                <span className="text-white/60">·</span>
                <span className="text-white/80">Can login: {u.can_login ? "Yes" : "No"}</span>
              </div>
              {u.notes && <p className="mt-2 text-sm text-white/60 line-clamp-2">{u.notes}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={ROUTES.accountEdit(u.id)} className="min-h-[44px] rounded-xl bg-[hsl(330,80%,55%)]/20 px-4 py-2.5 text-sm font-medium text-[hsl(330,90%,65%)] hover:bg-[hsl(330,80%,55%)]/30">
                  Edit
                </Link>
                <Link href={ROUTES.accountResetPassword(u.id)} className="min-h-[44px] rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10">
                  Reset password
                </Link>
                <form action={toggleCanLogin} className="inline-block">
                  <input type="hidden" name="recordId" value={u.id} />
                  <input type="hidden" name="can_login" value={u.can_login ? "false" : "true"} />
                  <button type="submit" className="min-h-[44px] rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10">
                    {u.can_login ? "Disable login" : "Enable login"}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(u.id)}
                  disabled={deletingId !== null}
                  className="min-h-[44px] rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-white/60">
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Can login</th>
              <th className="p-3 font-medium">Notes</th>
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-white/50">
                  No users yet. Create one below.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 font-medium text-white/90">{u.full_name}</td>
                  <td className="p-3 text-white/80">{u.email}</td>
                  <td className="p-3">
                    <span className="capitalize text-white/80">{u.role.replace("_", " ")}</span>
                  </td>
                  <td className="p-3 text-white/80">{u.status || "—"}</td>
                  <td className="p-3 text-white/80">{u.can_login ? "Yes" : "No"}</td>
                  <td className="max-w-[200px] truncate p-3 text-white/60" title={u.notes || undefined}>
                    {u.notes || "—"}
                  </td>
                  <td className="p-3 text-right">
                    <span className="flex items-center justify-end gap-2">
                      <Link
                        href={ROUTES.accountEdit(u.id)}
                        className="rounded-lg px-2 py-1.5 text-xs font-medium text-[hsl(330,90%,65%)] hover:bg-white/10"
                      >
                        Edit
                      </Link>
                      <Link
                        href={ROUTES.accountResetPassword(u.id)}
                        className="rounded-lg px-2 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10"
                      >
                        Reset password
                      </Link>
                      <form action={toggleCanLogin} className="inline-block">
                        <input type="hidden" name="recordId" value={u.id} />
                        <input type="hidden" name="can_login" value={u.can_login ? "false" : "true"} />
                        <button
                          type="submit"
                          className="rounded-lg px-2 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10"
                        >
                          {u.can_login ? "Disable login" : "Enable login"}
                        </button>
                      </form>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(u.id)}
                        disabled={deletingId !== null}
                        className="rounded-lg px-2 py-1.5 text-xs font-medium text-red-300/90 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
