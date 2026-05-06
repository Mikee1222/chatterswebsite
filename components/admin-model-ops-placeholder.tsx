import Link from "next/link";

type LinkItem = { href: string; label: string };

export function AdminModelOpsPlaceholder({
  title,
  description,
  links,
}: {
  title: string;
  description: string;
  links: LinkItem[];
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-2 text-sm text-white/60">{description}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/75">
        <p className="font-medium text-white/90">Quick links</p>
        <ul className="mt-3 list-inside list-disc space-y-2">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-pink-300/90 underline underline-offset-2 hover:text-pink-200">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
