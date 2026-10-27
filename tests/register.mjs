import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      context.parentURL?.includes("/node_modules/") ||
      (!specifier.startsWith("@/") && /\.[cm]?[jt]s$/.test(specifier))
    ) {
      return nextResolve(specifier, context);
    }
    const base = specifier.startsWith("@/")
      ? `${root}${specifier.slice(2)}`
      : specifier.startsWith(".") && context.parentURL?.startsWith("file:")
        ? fileURLToPath(new URL(specifier, context.parentURL))
        : null;
    if (base) {
      for (const suffix of ["", ".ts", ".js"]) {
        if (existsSync(base + suffix) && !base.endsWith("/")) {
          return nextResolve(pathToFileURL(base + suffix).href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
