// Copyright 2025 MFB Technologies, Inc.

import jsonToMd from "json2md"

export type MarkdownJson = (
  | {
      h1: string
      p: string
    }
  | {
      h3: string
      ul: string[]
    }
  | {
      h2: string
      p: string
    }
)[]

export function createJsonConverter(): {
  toMarkdown: (value: MarkdownJson) => string
} {
  // fix the lint errors with unordered list items
  jsonToMd.converters.ul = inputs => {
    return inputs.reduce((result, input) => result + "\n- " + input, "")
  }
  return {
    toMarkdown: convertToMarkdown
  }
}

function convertToMarkdown(value: MarkdownJson): string {
  return jsonToMd(value)
}
