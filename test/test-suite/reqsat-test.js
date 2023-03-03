/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

require("../../src/abject/di");
require("../../src/abject/primitive");
require("../../src/client/secp256r1");
const {Atoms} = require("../../src/core/atoms");
const {Interpreter} = require("../../src/core/interpret");
const {Line} = require("../../src/core/line");
const {Twist} = require("../../src/core/twist");
const util = require('./util');
const assert = require("assert");

async function checkInterpret(b)
{
    try {
        let atoms = Atoms.fromBytes(b);
        let line = Line.fromAtoms(atoms);
        let interpreter = new Interpreter(line, null);
        let successorH = atoms.lastAtomHash();
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
                    assert(!await checkInterpret(test["input"]));
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


let testNames = util.listTests().filter(testFilter);

describe("test-suite/reqsat-test", () => {
    it("Make sure at least one test was loaded.", () => assert(testNames.length > 0));
});

testNames.forEach(function (s) {
    let test = util.loadTest(s);
    runTest(test);
});
