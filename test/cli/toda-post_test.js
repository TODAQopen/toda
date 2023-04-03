import { app as invServer } from "../../src/inventory/src/server.js";
import { Atoms } from "../../src/core/atoms.js";
import { Twist } from "../../src/core/twist.js";
import { getAtomsFromPath } from "../../src/cli/bin/util.js";
import { getTodaPath, getConfigPath, cleanupTestEnv } from "./test-utils.js";
import assert from "assert";
import path from "path";
import fs from "fs/promises";
import { exec as unpromisedExec } from "child_process";
import util from "node:util";
const exec = util.promisify(unpromisedExec);

xdescribe('toda-post', async() => {

  // beforeEach(initTestEnv);
  afterEach(cleanupTestEnv);

  it('Should send a post request to the configured inventory server', async() => {
    // start an inventory server here
    let invPort = 3210;
    let server = invServer(new URL('./', import.meta.url)).listen(invPort, () => console.log(`Test inventory is listening on ${invPort}`));

    let filePath = new URL('./helpers/files/test.toda', import.meta.url);
    let fileHash = new Twist(Atoms.fromBytes(await fs.readFile(filePath))).getHash();

    let expectedFilePath = new URL(`./localhost/${filehash}.toda`, import.meta.url);

    try {
      // --server syntax
      await exec(`${getTodaPath()}/toda post --config ${getConfigPath()} --server http://localhost:${invPort} < ${filePath}` ).then(data => console.log(data));

      // file@server syntax
      await exec(`${getTodaPath()}/toda post --config ${getConfigPath()} ${filePath}@http://localhost:${invPort}`).then(data => console.log(data));

      // hash@server syntax
      await exec(`${getTodaPath()}/toda post --config ${getConfigPath()} ${fileHash}@http://localhost:${invPort}`).then(data => console.log(data));

      let expectedTwist = new Twist(await getAtomsFromPath(expectedFilePath));
      assert(expectedTwist.getHash().equals(fileHash));
    } catch (err) {
      console.error(err);
      assert(!err);
    } finally {
      await new Promise(res => server.close(() => res()));
      await fs.rm(expectedFilePath, { force: true });
    }
  });
});
