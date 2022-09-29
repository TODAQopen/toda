/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

const fs = require("fs/promises");
const util = require("node:util");
const exec = util.promisify(require("node:child_process").exec);
const assert = require("assert");
const { app: invServer } = require("../../src/inventory/src/server");
const { Atoms } = require("../../src/core/atoms");
const { Twist, TwistBuilder } = require("../../src/core/twist");
const { ArbitraryPacket } = require("../../src/core/packet");
const { bafs, sbh } = require("../util");
const { Sha256 } = require("../../src/core/hash");
const path = require("path");
const { getTodaPath, getConfigPath, initTestEnv, cleanupTestEnv } = require("./test-utils");

describe('toda-get', async() => {
  beforeEach(initTestEnv);
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
    let server = invServer(__dirname).listen(invPort, () => console.log(`Test inventory is listening on ${invPort}`));


    let twist = simpleTwist('one', 'two', 'three');

    let fileHash = twist.getHash();
    let inFilePath = path.resolve(__dirname, ".toda", "store", `${fileHash}.toda`);
    let outFilePath = path.resolve(__dirname, `${fileHash}.toda` );

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
      await fs.rm(path.resolve(__dirname, "localhost", `${fileHash}.toda`), { force: true });
      await fs.rm(inFilePath, { force: true });
      await fs.rm(outFilePath, { force: true });
    }
  });
});

