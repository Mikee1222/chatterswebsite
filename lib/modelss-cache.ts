import { unstable_cache } from "next/cache";
import { listAllModelss } from "@/services/modelss";

/** Full modelss list cached 60s — use on heavy admin pages instead of listAllModelss(). */
export const getCachedModelss = unstable_cache(
  async () => listAllModelss(),
  ["all-modelss-v1"],
  { revalidate: 60 }
);
