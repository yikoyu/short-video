import Package from "./package.json";
import path from "node:path";
import { defineConfig } from "vite";
import { builtinModules } from "node:module";

import esmodule from "vite-plugin-esmodule";

const pickList = [
  "@ffmpeg-installer/ffmpeg",
  "@ffprobe-installer/ffprobe",
  // "execa",
  "fluent-ffmpeg",
  // "fs-extra",
  // "get-video-duration",
  // "js-yaml",
  // "listr2",
  // "lodash-es",
  // "minimist",
  // "ora",
  // "prompts"
];

const dependencies = Object.keys(Package.dependencies).filter((k) => pickList.includes(k));

function majorVersion(): number {
  const major = process.version.split(".")[0];
  if (!major) return 16;
  return Number(major.replace("v", ""));
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [esmodule(["ora", "listr2"])],
  build: {
    target: `node${majorVersion()}`,
    lib: {
      entry: path.resolve(__dirname, "./src/index.ts"),
      name: "main",
      formats: ["cjs"],
      fileName: "main",
    },
    rollupOptions: {
      external: [...dependencies, ...builtinModules, ...builtinModules.map((k) => `node:${k}`)],
    },
  },
});

