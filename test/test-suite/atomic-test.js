import "../../src/abject/di.js";
import "../../src/abject/primitive.js";
import { Atoms } from "../../src/core/atoms.js";
import { listTests, loadTest } from './util.js';
import assert from "assert";

function runParse(b)
{
    let lat = Atoms.fromBytes(b).toPairs().map(pair => pair[1]);
    lat.forEach((p) =>
        {
            p.getShapedValue();
        });
}

function runTest(test)
// Returns string if error
{
    describe("test-suite/atomic-test " + test["moniker"], async() => {
        it("Test input properly loaded", async() =>
            {
                assert(test["input"] instanceof Buffer);
            });
        if(test["colour"] === "green")
            it ("Parsing LAT should succeed", async() =>
                {
                    runParse(test["input"]);
                });
        else
            it ("Parsing LAT should fail", async() =>
                {
                    assert.throws(() => runParse(test["input"]));
                });
    });
}

function testFilter(testName) {
    if (!testName.startsWith("atomic_")) {
        return false;
    }
    // FIXME! These currently DO NOT WORK
    if (testName != "atomic_hash_list_test_empty_list_description.toda" &&
        testName != "atomic_packet_test_packet_content_must_contain_at_least_one_byte_description.toda" &&
        testName != "atomic_pairtrie_test_empty_pairtrie_description.toda") {
        return true;
    }
    console.warn("Skipping over test " + testName + "!");
    return false;
}

let testNames = listTests().filter(testFilter);

describe("test-suite/atomic-test", () => {
    it("Make sure at least one test was loaded.", () => assert(testNames.length > 0));
});

testNames.forEach(function (s) {
    let test = loadTest(s);
    runTest(test);
});
