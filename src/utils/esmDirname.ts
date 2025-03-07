// Copyright 2024 MFB Technologies, Inc.

import path from "path"
import { fileURLToPath } from "url"

/* https://bobbyhadz.com/blog/javascript-dirname-is-not-defined-in-es-module-scope */

export const __filename = fileURLToPath(import.meta.url)
export const __dirname = path.dirname(__filename)
