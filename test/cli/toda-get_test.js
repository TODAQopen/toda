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

/** FIXME(acg): sfertman
describe('toda-get', async() => {
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

    let todaBin = `${__dirname}/../../src/cli/bin/toda`;
    let twist = simpleTwist('one', 'two', 'three');

    let fileHash = twist.getHash();
    let inFilePath = `${__dirname}/files/${fileHash}.toda`;
    let outFilePath = `${__dirname}/${fileHash}.toda`;
    // writing test file to disk so toda get can read it
    await fs.writeFile(inFilePath, Buffer.from(twist.atoms.toBytes()));

    try {

      // uploading file with @ syntax
      await exec(`${todaBin} post ${inFilePath}@http://localhost:${invPort}` ).then(data => console.log(data));

      // uploading file with --server syntax
      await exec(`${todaBin} post --server http://localhost:${invPort} < ${inFilePath}` ).then(data => console.log(data));

      // downloading file with @ syntax
      await exec(`${todaBin} get ${fileHash}@http://localhost:${invPort} --out ${outFilePath}`).then(data => console.log(data));
      // deleting local file so next download doesn't fail
      await fs.rm(outFilePath);

      // downloading file with --server syntax
      await exec(`${todaBin} get ${fileHash} --server http://localhost:${invPort} --out ${outFilePath}`).then(data => console.log(data));
    } catch (err) {
      console.error(err);
      assert(!err);
    } finally {
      await new Promise(res => server.close(() => res()));
      await fs.rm(`${__dirname}/localhost/${fileHash}.toda`, { force: true });
      await fs.rm(inFilePath, { force: true });
      await fs.rm(outFilePath, { force: true });
    }
  });
});
*/
