import { resolveConfig } from "vite"

// The router plugin writes src/routeTree.gen.ts when Vite resolves its config,
// so typechecking sees routes added or removed since the last dev or build run.
await resolveConfig({}, "build")
