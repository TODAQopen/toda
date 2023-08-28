import { Atoms } from "../../src/core/atoms.js";
import { Sha256 } from "../../src/core/hash.js";
import { ArbitraryPacket } from "../../src/core/packet.js";
import { TwistBuilder, Twist } from "../../src/core/twist.js";
import { sbh } from "../util.js";
import { app } from "../../src/inventory/src/server.js";
import { ByteArray } from "../../src/core/byte-array.js";
import fs from "fs/promises";
import assert from "assert";
import axios from "axios";

import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
            let p = new ArbitraryPacket(ByteArray.fromUtf8(str));
            return [Sha256.fromPacket(p), p];
        }

        function simpleTwist(...strings) {
            let tb = new TwistBuilder();
            tb.setFieldAtoms(sbh("atoms"), Atoms.fromPairs(strings.map(s => hpp(s))));
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
            assert.deepEqual((new ByteArray(response.data)).toString(), validTodaFile.hash.toString(), "Must return hash of new file");
            // get file by hash
            let response1 = await axios({
                method: "GET",
                url: `http://localhost:3001/files/${validTodaFile.hash.toBytes()}`,
                headers: { "Content-Type": "application/octet-stream" },
                responseType: "arraybuffer"
            });

            assert.deepEqual(Atoms.fromBytes(ByteArray.from(response1.data)).toBytes(), validTodaFile.atoms.toBytes() );
        } finally {
            server.close();
            await fs.rm(`${__dirname}/localhost/${validTodaFile.getHash()}.toda`);
        }
    });
});