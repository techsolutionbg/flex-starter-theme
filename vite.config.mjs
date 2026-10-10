import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const theme = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(
  path.resolve(theme, "../../resources/admin-react/package.json"),
);
export default {
  publicDir: false,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  resolve: {
    alias: [
      { find: /^react$/, replacement: require.resolve("react") },
      {
        find: /^react-dom\/client$/,
        replacement: require.resolve("react-dom/client"),
      },
      { find: /^react-dom$/, replacement: require.resolve("react-dom") },
      { find: /^scheduler$/, replacement: require.resolve("scheduler") },
    ],
  },
  build: {
    outDir: path.resolve(theme, "assets/react"),
    emptyOutDir: true,
    lib: {
      entry: path.resolve(theme, "src/storefront.js"),
      formats: ["es"],
      fileName: () => "storefront.js",
    },
    sourcemap: false,
    minify: true,
  },
};
