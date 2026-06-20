"use client";

import dynamic from "next/dynamic";

// The editor is fully client-side (uses localStorage, file downloads, caret
// APIs), so render it client-only — no SSR pass, no hydration mismatch.
const EactMaker = dynamic(() => import("./EactMaker"), { ssr: false });

export default function EactMakerClient() {
  return <EactMaker />;
}
