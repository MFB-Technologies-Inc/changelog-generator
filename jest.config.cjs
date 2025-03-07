/*
 *  Copyright 2024 MFB Technologies, Inc.
 */

const { createDefaultEsmPreset } = require("ts-jest")

/** @type {import('ts-jest/dist/types').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest/presets/js-with-babel",
  testEnvironment: "node",
  collectCoverageFrom: ["<rootDir>/src/**"],
  testMatch: ["<rootDir>/src/**/*.(spec|test).ts?(x)"],
  transform: {
    ...createDefaultEsmPreset().transform
  },
  moduleNameMapper: {
    "^(\\.\\.?\\/.+)\\.jsx?$": "$1"
  }
}
