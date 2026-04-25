import { test, expect, describe } from "bun:test"
import { impulseQueryKey } from "../../src/hooks/useImpulse.ts"

describe("impulseQueryKey", () => {
  test("produces stable key for pointer with id", () => {
    const key = impulseQueryKey({ type: "ui_component", id: "abc" })
    expect(key).toEqual(["impulse", "ui_component", "abc"])
  })

  test("produces stable key for pointer without id", () => {
    const key = impulseQueryKey({ type: "directory_tree" })
    expect(key).toEqual(["impulse", "directory_tree", null])
  })

  test("same pointer produces same key", () => {
    const a = impulseQueryKey({ type: "ui_component", id: "x" })
    const b = impulseQueryKey({ type: "ui_component", id: "x" })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
