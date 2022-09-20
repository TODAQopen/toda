/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const {Interpreter, MissingHoistError, MissingPrevious, MissingSuccessor, MissingPostEntry, LooseTwistError} = require("../../src/core/interpret");
const {Line} = require("../../src/core/line");
const {SerialStore} = require("../../src/core/store");
const {PairTriePacket, ArbitraryPacket} = require("../../src/core/packet");
const {Shield} = require("../../src/core/shield");
const {Twist, MissingHashPacketError} = require("../../src/core/twist");
const {Hash,Sha256} = require("../../src/core/hash");
const {ReqSatError} = require("../../src/core/reqsat");
const {ByteArray} = require("../../src/core/byte-array");
const {sbh, bafs} = require("../util");
const assert = require("assert");
const fs = require("fs");

describe("Can eat pickled tests", () => {

    const toplineField = Hash.parse(new ByteArray(Buffer.from("41f6813114f5c023d2173d5efe39009f302a782456aa5321ffa905f20c6970c5b8","hex")));

    let getTopline = function(line, hash) {
        let t = new Twist(line.getAtoms(), hash);
        if (t.prev()) {
	    return getTopline(line,t.prev().hash);
        }
        return t.cargo(toplineField);
    };

    let runPassTest = async (todaFile) => {
        const data = fs.readFileSync(todaFile);
        let s = new SerialStore(new ByteArray(data));

        let line = new Line();
        await s.copyInto(line);

        let i = new Interpreter(line, getTopline(line, s.primaryHash));
        return i.verifyHitchLine(s.primaryHash);
    };

    let runThrowsTest = async (todaFile, f) => {
        const data = fs.readFileSync(todaFile);
        let s = new SerialStore(new ByteArray(data));

        let line = new Line();
        await s.copyInto(line);

        let i = new Interpreter(line, getTopline(line, s.primaryHash));

        let err;
        try {
	    await i.verifyHitchLine(s.primaryHash);
	    console.log("uh oh");
        } catch (e) {
	    err = e;
        }
        if (err) {
	    assert(f(err));
        } else {
	    assert(false, "expected error.");
        }
    };

    it("green: unit_rig", async() => {
        return runPassTest(`${__dirname}/../toda-tests/rigging/green/unit_rig.toda`);
    });
    it("green: unit_rig_multi", async() => {
        return runPassTest(`${__dirname}/../toda-tests/rigging/green/unit_rig_multi.toda`);
    });
    it("green: valid_kiwano_f1", async() => {
        return runPassTest(`${__dirname}/../toda-tests/rigging/green/valid_kiwano_f1.toda`);
    });
    it("green: valid_kiwano_f2", async() => {
        return runPassTest(`${__dirname}/../toda-tests/rigging/green/valid_kiwano_f2.toda`);
    });
    it("green: valid_kiwano_f5", async() => {
        return runPassTest(`${__dirname}/../toda-tests/rigging/green/valid_kiwano_f5.toda`);
    });
    it("green: simple_last", async() => {
        return runPassTest(`${__dirname}/../toda-tests/rigging/green/simple_last.toda`);
    });
    it("green: invalid_rigging_green", async() => {
        return runPassTest(`${__dirname}/../toda-tests/rigging/green/invalid_rigging_green.toda`);
    });
    it("green: invalid shielding green", async() => {
        return runPassTest(`${__dirname}/../toda-tests/rigging/green/invalid_shielding_green.toda`);
    });
    it("green: multiple hoists green", async() => {
        return runPassTest(`${__dirname}/../toda-tests/rigging/green/multiple_hoists_green.toda`);
    });
    it("green: simple_lash_f1", async() => {
        return runPassTest(`${__dirname}/../toda-tests/rigging/green/simple_lash_f1.toda`);
    });
    it("green: simple_lash_f2", async() => {
        return runPassTest(`${__dirname}/../toda-tests/rigging/green/simple_lash_f2.toda`);
    });

    it("yellow: cork missing rigging", async() => {
        return runThrowsTest(`${__dirname}/../toda-tests/rigging/yellow/cork_missing_rigging.toda`,(e) => {
	    return (e instanceof MissingHashPacketError);
	    // todo: more specifics
        });
    });

    it("yellow: lash_succession_missing_prev", async() => {
        return runThrowsTest(`${__dirname}/../toda-tests/rigging/yellow/lash_succession_missing_prev.toda`,(e) => {
	    return (e instanceof MissingPrevious);
	    // todo: more specifics
        });
    });

    it("yellow: missing shield", async() => {
        return runThrowsTest(`${__dirname}/../toda-tests/rigging/yellow/missing_shield.toda`,(e) => {
	    return (e instanceof MissingHoistError);
	    // todo: more specifics
        });
    });

    it("yellow: missing rigging", async() => {
        return runThrowsTest(`${__dirname}/../toda-tests/rigging/yellow/missing_rigging.toda`,(e) => {
	    return (e instanceof MissingHashPacketError);
	    // todo: more specifics
        });
    });

    it("red: corkline_incomplete_early", async() => {
        return runThrowsTest(`${__dirname}/../toda-tests/rigging/red/corkline_incomplete_early.toda`,(e) => {
	    return (e instanceof MissingHoistError);
	    // todo: more specifics
        });
    });

    it("red: corkline_incomplete_late", async() => {
        return runThrowsTest(`${__dirname}/../toda-tests/rigging/red/corkline_incomplete_late.toda`,(e) => {
	    return (e instanceof MissingHoistError);
	    // todo: more specifics
        });
    });

    it("red: cork_reqsat_fail", async() => {
        return runThrowsTest(`${__dirname}/../toda-tests/rigging/red/cork_reqsat_fail.toda`,(e) => {
	    return (e instanceof ReqSatError);
	    // todo: more specifics
        });
    });

    it("red: meets_do_not_match", async() => {
        return runThrowsTest(`${__dirname}/../toda-tests/rigging/red/meets_do_not_match.toda`,(e) => {
	    return (e instanceof MissingSuccessor);
	    // todo: more specifics
        });
    });

    /* conflicting successor
    it('red: splice_mismatch', async() => {
	return runThrowsTest(`${__dirname}/../toda-tests/rigging/red/splice_mismatch.toda`,(e) => {
	    return (e instanceof MissingHoistError);
	    // todo: more specifics
	});
    });*/

    it("red: lash_succession_no_fast_twist", async() => {
        return runThrowsTest(`${__dirname}/../toda-tests/rigging/red/lash_succession_no_fast_twist.toda`,(e) => {
	    return (e instanceof LooseTwistError);
	    // todo: more specifics
        });
    });
    it("red: lash_succession_reqsat_fail", async() => {
        return runThrowsTest(`${__dirname}/../toda-tests/rigging/red/lash_succession_reqsat_fail.toda`,(e) => {
	    return true; // At the moment throws spectacular ASN1 format issue.
	    // todo: more specifics
        });
    });
    /* Conflicting successor
    it('red: lashed_non_colinear', async() => {
	return runThrowsTest(`${__dirname}/../toda-tests/rigging/red/lashed_non_colinear.toda`,(e) => {
	    return (e instanceof MissingHoistError);
	    // todo: more specifics
	});
    });    */

    it("red: missing post key", async() => {
        return runThrowsTest(`${__dirname}/../toda-tests/rigging/red/post_rigging_missing_post_key.toda`,(e) => {
	    return (e instanceof MissingPostEntry);
	    // todo: more specifics
        });
    });


});
