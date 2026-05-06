"use client";

import * as React from "react";
import { Calendar, Filter, Users } from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { selectOptionClass } from "@/components/ui/form";

type Props = {
  period: string;
  role: string;
  user: string;
  showAdminRoleFilter: boolean;
};

/**
 * Hours / report view filters (GET) — same shell controls as other dashboard forms.
 */
export function HoursFiltersClient({ period, role, user, showAdminRoleFilter }: Props) {
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:flex-wrap lg:items-end">
      <form method="get" className="flex w-full min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="user" value={user} />
        <div className="min-w-[min(100%,220px)] flex-1 sm:max-w-xs">
          <FormField label="Period" icon={<Calendar />} htmlFor="hours-period-filter" staggerIndex={0}>
            <FormSelect name="period" id="hours-period-filter" defaultValue={period}>
              <option value="today" className={selectOptionClass}>
                Today
              </option>
              <option value="week" className={selectOptionClass}>
                This week
              </option>
              <option value="month" className={selectOptionClass}>
                This month
              </option>
            </FormSelect>
          </FormField>
        </div>
        <FormSubmitButton className="w-full shrink-0 sm:w-auto sm:min-w-[140px]">Apply</FormSubmitButton>
      </form>

      {showAdminRoleFilter ? (
        <form method="get" className="flex w-full min-w-0 flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:flex-wrap sm:items-end lg:border-t-0 lg:pt-0 lg:pl-8 lg:border-l">
          <input type="hidden" name="period" value={period} />
          <div className="min-w-[min(100%,220px)] flex-1 sm:max-w-xs">
            <FormField label="Role" icon={<Users />} htmlFor="hours-role-filter" staggerIndex={0}>
              <FormSelect name="role" id="hours-role-filter" defaultValue={role}>
                <option value="" className={selectOptionClass}>
                  All roles
                </option>
                <option value="chatter" className={selectOptionClass}>
                  Chatter
                </option>
                <option value="virtual_assistant" className={selectOptionClass}>
                  Virtual assistant
                </option>
              </FormSelect>
            </FormField>
          </div>
          <FormSubmitButton className="w-full shrink-0 sm:w-auto sm:min-w-[140px]">
            <span className="inline-flex items-center justify-center gap-2">
              <Filter className="h-4 w-4 opacity-90" aria-hidden />
              Filter
            </span>
          </FormSubmitButton>
        </form>
      ) : null}
    </div>
  );
}
