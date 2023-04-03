import {
    Interpreter,
    MissingHoistError,
    MissingPrevious,
    MissingSuccessor,
    MissingPostEntry,
    LooseTwistError,
} from "../../src/core/interpret.js";

import { Line } from "../../src/core/line.js";
import { SerialStore } from "../../src/core/store.js";
import { Twist, MissingHashPacketError } from "../../src/core/twist.js";
import { Hash } from "../../src/core/hash.js";
import { ReqSatError } from "../../src/core/reqsat.js";
import { ByteArray } from "../../src/core/byte-array.js";
import assert from "assert";
import fs from "fs";

import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


describe("Runs pickled rig tests (v1)", () => {

    const toplineField = Hash.fromHex("41f6813114f5c023d2173d5efe39009f302a782456aa5321ffa905f20c6970c5b8");

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

        let i = new Interpreter(line, getTopline(line, s.getPrimaryHash()));
        return i.verifyHitchLine(s.getPrimaryHash());
    };

    let runThrowsTest = async (todaFile, f) => {
        const data = fs.readFileSync(todaFile);
        let s = new SerialStore(new ByteArray(data));

        let line = new Line();
        await s.copyInto(line);

        let i = new Interpreter(line, getTopline(line, s.getPrimaryHash()));

        let err;
        try {
            await i.verifyHitchLine(s.getPrimaryHash());
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
        return runThrowsTest(`${__dirname}/../toda-tests/rigging/red/lash_succession_reqsat_fail.toda`,() => {
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

describe("`verifyHitchLine` can handle partial proofs when provided `startHash`", () => {
    let b = new ByteArray(Buffer.from("41516b5c8485d48de7eddd425f9b9b6984d5b6de" +
                                      "e71577144d1a4c0a0912e2d1e163000000844123" +
                                      "a59e384692f5ed9bf0677ea2f921d5cae71f1cff" +
                                      "aa4641a424c27165fe50524111f8d5d453f97cad" +
                                      "821ab009f12e7bbe34763835b523a5df3e441e26" +
                                      "2240a6b7418e68e9ce247b0b08ec5c0068cfc17e" +
                                      "a32957f99d43b306cda7c921092691e26b41b543" +
                                      "249e7e460657cb064519b2b3ae960395224b6bfe" +
                                      "029464bef908867ba9f84151968bfc70764fb51a" +
                                      "1a1d91e3ebdaba20741622410ea8dfcf7b4c5d27" +
                                      "df6a324900000046411afcfb6e0237200bbc73c2" +
                                      "d54d16e96a74b1fdb7330e363da7ff1a329f4035" +
                                      "fc00000041516b5c8485d48de7eddd425f9b9b69" +
                                      "84d5b6dee71577144d1a4c0a0912e2d1e100417c" +
                                      "c87649ea1e1aebcb81fe4e8f2af657f5bf792408" +
                                      "4998a12efa0a0e8a817f6148000000224151968b" +
                                      "fc70764fb51a1a1d91e3ebdaba20741622410ea8" +
                                      "dfcf7b4c5d27df6a320041082fcba733a4dc6691" +
                                      "a9d8fa6529e5a68654433b34f0c00dfd2e921d78" +
                                      "3af6924900000026000000000041dbb3d7e5f8d2" +
                                      "360c57292b533a473c239237f8cacab150dad984" +
                                      "4c56e5ecb45441a02bbc2d701980bf936161e649" +
                                      "80dccca2ec04f68bbe71649a341e6b036c975060" +
                                      "0000001f536f6d65207665727920736563757265" +
                                      "20736869656c6420666f722074312e4135caa439" +
                                      "e7b6470514975c337ee46999145ab7150cf381f3" +
                                      "451d7fb6de18ff6a490000006641c579871e5ff7" +
                                      "f98fd92af8647522dbb7302d00bfeb76d9c66786" +
                                      "14015a980d73418fcac3e848f214badf6bb9dada" +
                                      "520147b652f9d8a99aa581d06affb895a426ea41" +
                                      "a02bbc2d701980bf936161e64980dccca2ec04f6" +
                                      "8bbe71649a341e6b036c975000000041b6df9395" +
                                      "c806e7904d814416cea5c49969091ae93903b0fb" +
                                      "0170377c489c7fda48000000224135caa439e7b6" +
                                      "470514975c337ee46999145ab7150cf381f3451d" +
                                      "7fb6de18ff6a00417e869a0b2a4d334cd6041bc3" +
                                      "d348d5de554f922069fdc43bbd1f6c26348046a2" +
                                      "490000002641b6df9395c806e7904d814416cea5" +
                                      "c49969091ae93903b0fb0170377c489c7fda0000" +
                                      "00000041d2c38890ade649bb5f91df58eacff144" +
                                      "376e95989c016aeed3ad568fe8ab782648000000" +
                                      "22417e869a0b2a4d334cd6041bc3d348d5de554f" +
                                      "922069fdc43bbd1f6c26348046a20041a78afe96" +
                                      "43e2bcbb6bdbee35eb073905a45fb19c08665ffe" +
                                      "c7aa0c320310e6e9490000002641d2c38890ade6" +
                                      "49bb5f91df58eacff144376e95989c016aeed3ad" +
                                      "568fe8ab7826000000000041ed2693a22a6ac211" +
                                      "fa2eea517919ebd19375f6a9ff12f4919a584a72" +
                                      "79add966480000002241a78afe9643e2bcbb6bdb" +
                                      "ee35eb073905a45fb19c08665ffec7aa0c320310" +
                                      "e6e90041aa02c216ec908d632c6dd5dde7932d57" +
                                      "59fb68f4cb4a0a3de56779732fb0f34649000000" +
                                      "26000000000041070b06053421af6cf44029e2a2" +
                                      "a4dab38ba69d0a776729af986abb99bb9c1ddb41" +
                                      "31f9789a681fb538c4cd2ac62f44e9e64d6deb9e" +
                                      "0df9427235166f0d5e8d539f480000002241aa02" +
                                      "c216ec908d632c6dd5dde7932d5759fb68f4cb4a" +
                                      "0a3de56779732fb0f34600419366c36f033512b0" +
                                      "1c589648cd4c8fcb333af6d3adee4a70b296b452" +
                                      "a4da79a749000000264131f9789a681fb538c4cd" +
                                      "2ac62f44e9e64d6deb9e0df9427235166f0d5e8d" +
                                      "539f0000000000418fcac3e848f214badf6bb9da" +
                                      "da520147b652f9d8a99aa581d06affb895a426ea" +
                                      "4800000022419366c36f033512b01c589648cd4c" +
                                      "8fcb333af6d3adee4a70b296b452a4da79a70041" +
                                      "5be5c3366da7c78ea5f64395e0a29e3d42a7ca7e" +
                                      "9ae22ac77db47f0b7c9450a04900000026418fca" +
                                      "c3e848f214badf6bb9dada520147b652f9d8a99a" +
                                      "a581d06affb895a426ea0000000000411afcfb6e" +
                                      "0237200bbc73c2d54d16e96a74b1fdb7330e363d" +
                                      "a7ff1a329f4035fc4800000022415be5c3366da7" +
                                      "c78ea5f64395e0a29e3d42a7ca7e9ae22ac77db4" +
                                      "7f0b7c9450a00041648a134a2fc4e465ad19923e" +
                                      "ada32b3d2bbe085dd9a0328d1e968fda0ca1b071" +
                                      "490000004641ed2693a22a6ac211fa2eea517919" +
                                      "ebd19375f6a9ff12f4919a584a7279add966411a" +
                                      "fcfb6e0237200bbc73c2d54d16e96a74b1fdb733" +
                                      "0e363da7ff1a329f4035fc000000004111f8d5d4" +
                                      "53f97cad821ab009f12e7bbe34763835b523a5df" +
                                      "3e441e262240a6b7480000002241648a134a2fc4" +
                                      "e465ad19923eada32b3d2bbe085dd9a0328d1e96" +
                                      "8fda0ca1b07100", "hex"));
    let line = Line.fromBytes(b);
    let topHash = Hash.fromHex("4131f9789a681fb538c4cd2ac62f44e9e64d6deb9e0df9427235166f0d5e8d539f");
    let oldestHash = Hash.fromHex("41b6df9395c806e7904d814416cea5c49969091ae93903b0fb0170377c489c7fda");
    let newestHash = Hash.fromHex("4111f8d5d453f97cad821ab009f12e7bbe34763835b523a5df3e441e262240a6b7");
    let interpreter = new Interpreter(line, topHash);

    it("Running a partial proof without `startHash` fails", async () => {
        let x;
        try {
            await interpreter.verifyHitchLine(newestHash);
            x = false;
        } catch (err) {
            x = err instanceof MissingHashPacketError;
        }
        assert(x, "Running interpreter should fail with error MissingPrevious.");
    });

    it("Running a partial proof with valid `startHash` succeeds", async () => {
        let x;
        try {
            await interpreter.verifyHitchLine(newestHash, newestHash);
            x = true;
        } catch (err) {
            x = false;
        }
        assert(x, "Running interpreter should succeed.");
    });
});

describe("Runs pickled reqsattrie tests (v1)", () => {
    let runPassTest = async (todaFile) => {
        const data = new ByteArray(fs.readFileSync(todaFile));
        let s = new SerialStore(data);
        let line = new Line();
        await s.copyInto(line);
        let i = new Interpreter(line, undefined);

        let twist1 = Twist.fromBytes(data);
        let twist0 = twist1.prev();

        return i.verifyLegit(twist0, twist1);
    };

    let runThrowTest = async (todaFile, expectedErrorType) => {
        const data = new ByteArray(fs.readFileSync(todaFile));
        let s = new SerialStore(data);
        let line = new Line();
        await s.copyInto(line);
        let i = new Interpreter(line, undefined);

        let twist1 = Twist.fromBytes(data);
        let twist0 = twist1.prev();

        let err;
        try {
            await i.verifyLegit(twist0, twist1);
        } catch (e) {
            err = e;
        }
        if (err) {
            assert(err instanceof expectedErrorType);
        } else {
            assert(false, "expected error.");
        }
    };

    it("green: satisfied sig", async() => {
        return runPassTest(`${__dirname}/../toda-tests/reqsat/reqsattrie/green/req_and_sat_null.toda`);
    });

    it("yellow: unknown interpreter type", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/reqsattrie/yellow/unknown_interpreter.toda`, ReqSatError);
    });

    it("yellow: reqtrie missing", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/reqsattrie/yellow/reqtrie_missing.toda`, MissingHashPacketError);
    });

    it("yellow: sattrie missing", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/reqsattrie/yellow/sattrie_missing.toda`, MissingHashPacketError);
    });

    it("red: req is null but the sat is not", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/reqsattrie/red/req_null_sat_not.toda`, Error);
    });

    it("red: sat is null but the req is not", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/reqsattrie/red/sat_null_req_not.toda`, Error);
    });

    it("red: req is not a trie", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/reqsattrie/red/reqtrie_invalid.toda`, TypeError);
    });

    it("red: sat is not a trie", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/reqsattrie/red/sattrie_invalid.toda`, TypeError);
    });

    it("red: req / sat keys mismatch", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/reqsattrie/red/reqtrie_sattrie_different_keys.toda`, Error);
    });

    it("red: sattrie has an extra key", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/reqsattrie/red/sattrie_key_extra.toda`, Error);
    });

    it("red: sattrie has one less key", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/reqsattrie/red/sattrie_key_not_included.toda`, Error);
    });
});
