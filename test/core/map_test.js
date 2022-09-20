/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const {Sha256} = require("../../src/core/hash");
const {HashMap} = require("../../src/core/map");
const assert = require("assert");

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
