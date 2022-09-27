/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const util = require("node:util");
const exec = util.promisify(require("node:child_process").exec);
const assert = require("assert");
const { app: invServer } = require("../../src/inventory/src/server");
const { Atoms } = require("../../src/core/atoms");
const { Twist } = require("../../src/core/twist");
const { getAtomsFromPath, setConfig } = require("../../src/cli/bin/util");
const { initTestEnv, getTodaPath, getConfigPath, getConfig, cleanupTestEnv } = require("./test-utils");
const path = require("path");
const fs = require("fs-extra");

/** FIXME(acg): sfertman
describe('toda-post', async() => {
  beforeEach(initTestEnv);
  afterEach(cleanupTestEnv);

  it('Should send a post request to the configured inventory server', async() => {
    // start an inventory server here
    let invPort = 3210;
    let server = invServer(__dirname).listen(invPort, () => console.log(`Test inventory is listening on ${invPort}`));
    let filePath = `${__dirname}/helpers/files/test.toda`;
    let fileHash = new Twist(Atoms.fromBytes(await fs.readFile(filePath))).getHash();

    let expectedFilePath = `${__dirname}/localhost/${fileHash}.toda`;
    try {
      await exec(`${getTodaPath()}/toda post --server http://localhost:${invPort} <${filePath}` ).then(data => console.log(data));

        let expectedTwist = new Twist(await getAtomsFromPath(expectedFilePath));
      assert(expectedTwist.getHash().equals(fileHash));
    } catch (err) {
      console.error(err);
      assert(!err);
    } finally {
      server.close();
      fs.rm(expectedFilePath);
    }
  });
});

*/
