import typescript from "@rollup/plugin-typescript"

export default {
  input: "src/index.ts",
  output: {
    file: "out/index.cjs",
    format: "cjs"
  },
  plugins: [
    typescript({
      tsconfig: "./tsconfig.prod.json"
    })
  ]
}
