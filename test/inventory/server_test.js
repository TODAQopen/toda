/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const fs = require("fs/promises");
const assert = require("assert");
const axios = require("axios");
const { Atoms } = require("../../src/core/atoms");
const { Sha256 } = require("../../src/core/hash");
const { ArbitraryPacket } = require("../../src/core/packet");
const { TwistBuilder, Twist } = require("../../src/core/twist");
const { bafs, sbh } = require("../util");
const { app } = require("../../src/inventory/src/server");
const { ByteArray } = require("../../src/core/byte-array");

describe("POST /files", async () => {
    it("Should return an error when body is not a valid toda file", async () => {
        let server = app().listen(3001, () => console.log("Test inventory is listening on 3001"));
        try {
            await axios({
                method: "POST",
                url: "http://localhost:3001/files",
                headers: { "Content-Type": "application/octet-stream" },
                data: Buffer.from("some plain text")
            });
            console.log("This should not be printed");
        } catch (err) {
            assert.equal(err.response.status, 500);
        } finally {
            server.close();
        }
    });
    it("Should return an error when request exceeds size limit", async () => {
        let server = app("", {maxFileSize: "2b"}).listen(3001, () => console.log("Test inventory is listening on 3001"));
        try {
            await axios({
                method: "POST",
                url: "http://localhost:3001/files",
                headers: { "Content-Type": "application/octet-stream" },
                data: Buffer.from("more than two bites")
            });
            console.log("This should not be printed");
        } catch (err) {
            assert.equal(err.response.status, 413);
        } finally {
            server.close();
        }
    });
    it("Should return code 201 and hash of the newly stored file", async () => {
    // make a valid toda file
        function hpp(str) { // hash-packet-pair
            let p = new ArbitraryPacket(bafs(str));
            return [Sha256.fromPacket(p), p];
        }

        function simpleTwist(...strings) {
            let tb = new TwistBuilder();
            tb.setFieldAtoms(sbh("atoms"), new Atoms(strings.map(s => hpp(s))));
            return new Twist(tb.serialize());
        }

        let server = app(__dirname).listen(3001, () => console.log("Test inventory is listening on 3001"));
        let validTodaFile;
        try {
            validTodaFile = simpleTwist("one","two","three");
            let response = await axios({
                method: "POST",
                url: "http://localhost:3001/files",
                headers: { "Content-Type": "application/octet-stream" },
                data: Buffer.from(validTodaFile.atoms.toBytes()),
                responseType: "arraybuffer", // Important
            });

            assert(response.status, 201, "Must return code 201");
            assert.deepEqual(response.data, validTodaFile.hash.serializedValue, "Must return hash of new file");
            // get file by hash
            let response1 = await axios({
                method: "GET",
                url: `http://localhost:3001/files/${validTodaFile.hash.serializedValue}`,
                headers: { "Content-Type": "application/octet-stream" },
                responseType: "arraybuffer"
            });

            assert.deepEqual(Atoms.fromBytes(ByteArray.from(response1.data)), validTodaFile.atoms );
        } finally {
            server.close();
            await fs.rm(`${__dirname}/localhost/${validTodaFile.getHash()}.toda`);
        }
    });
});
