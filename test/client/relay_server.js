import express from "express";
import { PairTriePacket } from "../../src/core/packet.js";
import { HashMap } from "../../src/core/map.js";
import axios from "axios";
import { LocalRelayClient } from "../../src/client/relay.js";
import { Hash } from "../../src/core/hash.js";

class TestRelayServer {
    constructor(toda, config = {}) {
        const CONFIG_DEFAULTS = {
            maxFileSize: "100kb",
            fileServerRedirects: []
        };
        config = {
            ...CONFIG_DEFAULTS,
            ...config
        };

        this.toda = toda;
        this.shims = {};
        this.config = config;
        this.requestLogs = [];
        this._configureApp(toda, config, this.requestLogs, this.shims);
    }

    async _start(app, port) {
        let runningServer;
        return new Promise((res, rej) => {
            runningServer = app.listen(port, (err) => {
                if (err) {
                    rej(err);
                }
                res();
            });
        }).then(() => runningServer);
    }

    async start() {
        this.server = await this._start(this.app, this.config.port);
        return this;
    }

    async stop() {
        await this.server.close();
    }

    _configureApp(toda, config, requestLogs, shims) {
        const app = express();
        app.use(express.json());

        app.use((req, res, next) => {
            requestLogs.push(req.method + " " + req.url);
            next();
        });

        app.use(express.raw({ limit: config.maxFileSize }));

        async function redirect(file) {
            for (const url of config.fileServerRedirects) {
                const req = await axios({
                    method: "GET",
                    url: file,
                    baseURL: url,
                    responseType: "arraybuffer"
                }).catch(r => r);
                if (req?.status == 200) {
                    return req.data;
                }
            }
            return null;
        }

        function findLocal(file) {
            const hex = file.substring(0, file.indexOf('.'));
            const ext = file.substring(file.indexOf('.'));
            const hash = Hash.fromHex(hex);
            const relay = new LocalRelayClient(toda, hash);
            if (ext == ".shield") {
                const shield = relay._getShield(hash);
                if (!shield) {
                    return null;
                }
                return Buffer.from(shield.toBytes());
            }
            if (ext == ".next.toda") {
                const twist = relay._getNext(hash);
                if (!twist) {
                    return null;
                }
                return Buffer.from(twist.getAtoms().toBytes());
            }
            return null;
        }

        app.get("/files/:file", async function (req, res, next) {
            try {
                const file = req.params.file;
                const b = findLocal(file) ?? await redirect(file);
                if (b) {
                    return res.status(200).send(b);
                }
                return res.status(404).send();
            } catch (err) {
                return next(err);
            }
        });

        app.get("/ticket/:hex", async function (req, res, next) {
            const hash = Hash.fromHex(req.params.hex);
            res.json({
                itinerary: [
                    {
                        twist: toda.get(hash).prev().getHash(),
                        url: "TODO",
                    },
                ],
            });
        });

        app.post("/hoist", async function (req, res, next) {
            if (shims.hoist) {
                const r = await shims.hoist();
                return res.status(r).send();
            }

            const hex = req.body["relay-twist"];
            try {
                const hash = Hash.fromHex(hex);
                const quad = req.body["hoist-request"];
                const hashes = new HashMap();
                for (const [k, v] of Object.entries(quad)) {
                    hashes.set(Hash.fromHex(k), Hash.fromHex(v));
                }

                const updatedTwist = toda.get(hash);
                const pairtrie = PairTriePacket.createFromUnsorted(hashes);
                // DON'T WAIT!
                toda.append(updatedTwist,
                            updatedTwist.lastFast()?.getTetherHash(),
                            null,
                            null,
                            () => {},
                            pairtrie);
                return res.status(204).send();
            } catch (err) {
                return next(err);
            }
        });

        app.use((err, req, res, next) => {
            console.error(err);
            return res.status(500);
        });

        this.app = app;
    }
}

export { TestRelayServer };
