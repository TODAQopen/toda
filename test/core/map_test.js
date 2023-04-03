import { HashMap } from "../../src/core/map.js";
import assert from "assert"

describe("HashMap", () => {
    it("can be cloned", () => {
        let x = new HashMap();
        x.set("a",1);
        x.set("b",2);
        let y = x.clone();
        assert.equal(y.size, 2);
        assert.equal(y.get("b"),2);
    });
});
