import { Twist } from "../../src/core/twist.js";
import { getTodaPath, getConfigPath, getConfig } from "./test-utils.js";
import { execSync } from "child_process";
import assert from "assert";

describe("toda-history", async() => {

    it("Should display the history of a twist", async() => {
        //let out = path.resolve(getConfig().store, "toda-history.toda");

        try {
            let q = execSync(`${getTodaPath()}/toda create --empty --shield foobar --config ${getConfigPath()}`);
            let twist = Twist.fromBytes(q);
            let r = execSync(`${getTodaPath()}/toda history ${twist.getHash().toString()} --config ${getConfigPath()}` );
            let expected = `twist     \t${twist.getHash()}\n` +
        "sats      \t00\n" +
        "prev      \t00\n" +
        `tether    \t${twist.getBody().getTetherHash()}\n` +
        `shield    \t${twist.getBody().getShieldHash()}\n` +
        "reqs      \t00\n" +
        "rigging   \t00\n" +
        "cargo     \t00\n\n";

            assert.equal(r.toString(), expected);
        } catch (err) {
            assert.fail(err);
        }
    });
});
