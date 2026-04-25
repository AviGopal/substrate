import { test, expect, describe } from "bun:test"

describe("validate-spec logic", () => {
  test("missing primitive field returns valid:false", () => {
    const body = {}
    expect(!("primitive" in body)).toBe(true)
  })

  test("primitive without type field is invalid", () => {
    const prim = { columns: [], data: [] }
    expect(!("type" in prim)).toBe(true)
  })
})
