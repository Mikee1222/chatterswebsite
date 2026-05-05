"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type Props = {
  to: string;
  replace?: boolean;
};

export function ClientRedirect({ to, replace = true }: Props) {
  const router = useRouter();

  React.useEffect(() => {
    if (!to) return;
    if (replace) router.replace(to);
    else router.push(to);
  }, [router, replace, to]);

  return null;
}

export default ClientRedirect;
