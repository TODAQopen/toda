import { app as invServer } from "../../src/inventory/src/server.js";
import { Atoms } from "../../src/core/atoms.js";
import { Twist, TwistBuilder } from "../../src/core/twist.js";
import { ArbitraryPacket } from "../../src/core/packet.js";
import { bafs, sbh } from "../util.js";
import { Sha256 } from "../../src/core/hash.js";
import { getTodaPath, getConfigPath, cleanupTestEnv } from "./test-utils.js";

import fs from "fs/promises";
import assert from "assert";
import { exec as unpromisedExec } from "child_process";
import util from "node:util";
const exec = util.promisify(unpromisedExec);

xdescribe('toda-get', async() => {
  // beforeEach(initTestEnv);
  afterEach(cleanupTestEnv);

  it('Should get a file from the configured inventory', async() => {
    function hpp(str) { // hash-packet-pair
      let p = new ArbitraryPacket(bafs(str));
      return [Sha256.fromPacket(p), p];
    }

    function simpleTwist(...strings) {
      let tb = new TwistBuilder();
      tb.setFieldAtoms(sbh('atoms'), new Atoms(strings.map(s => hpp(s))));
      return new Twist(tb.serialize());
    }

    let invPort = 3211;
    let server = invServer(new URL('./', import.meta.url)).listen(invPort, () => console.log(`Test inventory is listening on ${invPort}`));


    let twist = simpleTwist('one', 'two', 'three');

    let fileHash = twist.getHash();
    let inFilePath = new URL(`./.toda/store/${fileHash}.toda`, import.meta.url)
    let outFilePath = new URL(`${fileHash}.toda`, import.meta.url)

    let todaBin = `${getTodaPath()}/toda`;

    try {

      // writing test file to disk so toda get can read it
      await fs.writeFile(inFilePath, Buffer.from(twist.atoms.toBytes())).then(data => console.log(data));

      // uploading file with @ syntax
      await exec(`${todaBin} post --config ${getConfigPath()} ${inFilePath}@http://localhost:${invPort}` ).then(data => console.log(data));

      // uploading file with --server syntax
      await exec(`${todaBin} post --config ${getConfigPath()} --server http://localhost:${invPort} < ${inFilePath}` ).then(data => console.log(data));

      // // downloading file with @ syntax
      await exec(`${todaBin} get --config ${getConfigPath()} ${fileHash}@http://localhost:${invPort} --out ${outFilePath}`).then(data => console.log(data));
      // deleting local file so next download doesn't fail
      await fs.rm(outFilePath);

      // downloading file with --server syntax
      await exec(`${todaBin} get ${fileHash} --config ${getConfigPath()} --server http://localhost:${invPort} --out ${outFilePath}`).then(data => console.log(data));
    } catch (err) {
      console.error(err);
      assert(!err);
    } finally {
      await new Promise(res => server.close(() => res()));
      await fs.rm(new URL(`localhost/${fileHash}.toda`, import.meta.url));
      await fs.rm(inFilePath, { force: true });
      await fs.rm(outFilePath, { force: true });
    }
  });
});

