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

const ccgProgram = new Command("ccg")

ccgProgram
  .command(ChangeCommandName)
  .description(ChangeCommandDescription)
  .option(ChangeCommandOptionFlag.verify, ChangeCommandOptionDescription.verify)
  .action(change)

ccgProgram
  .command(PublishCommandName)
  .description(PublishCommandDescription)
  .option(PublishCommandOptionFlag.apply, PublishCommandOptionDescription.apply)
  .action(publish)

ccgProgram.parse(process.argv)
