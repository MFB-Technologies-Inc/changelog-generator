// Copyright 2024 MFB Technologies, Inc.

import { input, select, confirm } from "@inquirer/prompts"

/** Prompt the user for some text input. */
export async function textPrompt(args: { message: string }): Promise<string> {
  const response = await input({
    message: args.message
  })
  return response
}

/** Prompt the user to select an option. */
export async function selectionPrompt<T>(args: {
  message: string
  options: {
    /** The value to be returned if this option is selected. */
    value: T
    /** Name of the option, which is displayed in the list. */
    name: string
    /** A longer description that appears under the name when this option is highlighted. */
    description?: string
  }[]
}): Promise<T> {
  return select<T>({
    message: args.message,
    choices: args.options
  })
}

/** Prompt the user for a yes/no response. */
export async function booleanPrompt(args: {
  message: string
}): Promise<boolean> {
  return confirm({
    message: args.message
  })
}
