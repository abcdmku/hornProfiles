import { hash } from "./hash";

describe("hash", () => {
  it("should work", () => {
    expect(hash()).toEqual("hash");
  });
});
