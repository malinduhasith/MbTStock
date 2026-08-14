import { ReactNode } from "react";

export type IconName =
  | "dashboard"
  | "tools"
  | "out"
  | "usage"
  | "users"
  | "info"
  | "search"
  | "up"
  | "down"
  | "clock";

const paths: Record<IconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  tools: <path d="M14 6a4 4 0 0 0-5-5L7 3l3 3 2-2a4 4 0 0 0 2 5l-9 9-2 3 3-2 9-9a4 4 0 0 0 5-5l-2 2z"/>,
  out: <path d="M5 12h14M13 6l6 6-6 6M5 5v14"/>,
  usage: <path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/>,
  users: <><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M17 14a5 5 0 0 1 5 5v2"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  up: <path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>,
  down: <path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
