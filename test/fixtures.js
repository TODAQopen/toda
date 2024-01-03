import { RemoteRelayClient } from "../src/client/relay.js";
import nock from "nock";

export const mochaHooks = {
    beforeEach: async function () {
        // Wipe all polluting state before each test
        nock.cleanAll();
        RemoteRelayClient.clearCache();
    }
};