// Copyright 2024 MFB Technologies, Inc.

import { spawn } from "child_process"
import { hasToStringMethod } from "../utils/objects.js"

/** Runs a command and returns its output. */
export async function runCommand(args: {
  command: string
  args?: readonly string[]
}): Promise<string> {
  const command = spawn(args.command, args.args)
  return new Promise((resolve, reject) => {
    let result = ""
    command.on("error", err => {
      reject(
        new Error(
          "command failed: failed to start the subprocess: " +
            err.message +
            "\ncommand: " +
            args.command +
            " " +
            args.args?.join(" ")
        )
      )
    })
    command.on("close", code => {
      if (code !== 0) {
        reject(
          new Error(
            "command failed with exit code " +
              code +
              "\ncommand: " +
              args.command +
              " " +
              args.args?.join(" ")
          )
        )
      } else {
        resolve(result)
      }
    })
    command.stdout.on("data", (data: unknown) => {
      if (!hasToStringMethod(data)) {
        reject(
          new Error(
            "unknown response data: " +
              JSON.stringify(data) +
              "\ncommand: " +
              args.command +
              " " +
              args.args?.join(" ")
          )
        )
        command.kill(1)
        return
      }
      result += data.toString().trim()
    })
    command.stderr.on("data", data => {
      reject(
        new Error(
          `command failed: ${data}` +
            "\ncommand: " +
            args.command +
            " " +
            args.args?.join(" ")
        )
      )
      command.kill(1)
    })
  })
}
