import { GitHubLink } from "./GitHubLink";

export function Header() {
  return (
    <header className="flex flex-col gap-2 border-b border-black/10 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-white/10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Eact <span className="text-emerald-600">Maker</span>
        </h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          Write LaTeX-style math, get CASIO eActivity files (.g2e · .g1e · .g3e)
          for fx-9860G and fx-CG calculators.
        </p>
      </div>
      <GitHubLink />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-black/10 pt-4 text-xs text-black/45 dark:border-white/10 dark:text-white/45">
      A modern re-creation of the original{" "}
      <a
        className="underline"
        href="https://tools.planet-casio.com/EactMaker/"
        target="_blank"
        rel="noreferrer"
      >
        EactMaker
      </a>{" "}
      by Helder7 &amp; Ziqumu. Output is byte-identical to EactMaker (G1E / G2E
      / G3E), generated entirely client-side from a reverse-engineered file
      format.
    </footer>
  );
}
