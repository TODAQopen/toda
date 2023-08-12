import "../../src/abject/di.js";
import "../../src/abject/primitive.js";
import "../../src/client/secp256r1.js";
import { Atoms } from "../../src/core/atoms.js";
import { Interpreter } from "../../src/core/interpret.js";
import { Line } from "../../src/core/line.js";
import { Twist } from "../../src/core/twist.js";
import { listTests, loadTest } from './util.js';
import assert from "assert";

async function checkInterpret(b)
{
    try {
        let atoms = Atoms.fromBytes(b);
        let line = Line.fromAtoms(atoms);
        let interpreter = new Interpreter(line, null);
        let successorH = atoms.focus;
        let predecessorH = line.prev(successorH);
        let successor = new Twist(atoms, successorH);
        let predecessor = new Twist(atoms, predecessorH);
        await interpreter.verifyLegit(predecessor, successor);
        return true;
    }
    catch(err)
    {
        return false;
    }
}

function runTest(test)
// Returns string if error
{
    describe("test-suite/reqsat-test " + test["moniker"], async() => {
        it("Test input properly loaded", async() =>
            {
                assert(test["input"] instanceof Buffer);
            });
        if(test["colour"] === "green")
            it ("Reqsat should succeed", async() =>
                {
                    assert(await checkInterpret(test["input"]));
                });
        else
            it ("Reqsat should fail", async() =>
                {
                    assert(!(await checkInterpret(test["input"])));
                });
    });
}

function testFilter(testName) {
    if (!testName.startsWith("reqsat_")) {
        return false;
    }
    // FIXME! These currently DO NOT WORK
    if (!testName.match("reqsatlist") &&
        !testName.match("reqtrie")) {
        return true;
    }
    console.warn("Skipping over test " + testName + "!");
    return false;
}


let testNames = listTests().filter(testFilter);

describe("test-suite/reqsat-test", () => {
    it("Make sure at least one test was loaded.", () => assert(testNames.length > 0));
});

testNames.forEach(function (s) {
    let test = loadTest(s);
    runTest(test);
});
