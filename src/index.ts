#!/usr/bin/env node
// Copyright 2024 MFB Technologies, Inc.

import { change } from "./commands/change.js"
import { Command } from "commander"
import {
  ChangeCommandDescription,
  ChangeCommandName,
  ChangeCommandOptionDescription,
  ChangeCommandOptionFlag,
  PublishCommandDescription,
  PublishCommandName,
  PublishCommandOptionDescription,
  PublishCommandOptionFlag
} from "./constants.js"
import { publish } from "./commands/publish.js"

// Add global handler for unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled promise rejection:", promise, "reason: ", reason)
  process.exit(1)
})

const ccgProgram = new Command("ccg")

ccgProgram
  .command(ChangeCommandName)
  .description(ChangeCommandDescription)
  .option(ChangeCommandOptionFlag.verify, ChangeCommandOptionDescription.verify)
  .action(args => {
    change(args).catch(e => {
      console.error(e)
      process.exit(1)
    })
  })

ccgProgram
  .command(PublishCommandName)
  .description(PublishCommandDescription)
  .option(PublishCommandOptionFlag.apply, PublishCommandOptionDescription.apply)
  .action(args => {
    publish(args).catch(e => {
      console.error(e)
      process.exit(1)
    })
  })

ccgProgram.parse(process.argv)
