import express from "express";
import { PairTriePacket } from "../../src/core/packet.js";
import { HashMap } from "../../src/core/map.js";
import axios from "axios";
import { LocalNextRelayClient } from "../../src/client/relay.js";
import { Hash } from "../../src/core/hash.js";

class TestRelayServer
{
    constructor(toda, config = {})
    {
        const CONFIG_DEFAULTS = {
            maxFileSize: "100kb",
            fileServerRedirects: []
        };
        config = {
            ...CONFIG_DEFAULTS,
            ...config
        };

        this.toda = toda;
        this.config = config;
        this.requestLogs = []
        this._configureApp(toda, config, this.requestLogs);
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

    async start()
    {
        this.server = await this._start(this.app, this.config.port);
        return this;
    }

    async stop()
    {
        await this.server.close();
    }

    _configureApp(toda, config, requestLogs)
    {
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
        }

        function findLocal(file) {
            const hex = file.substring(0, file.indexOf('.'));
            const ext = file.substring(file.indexOf('.'));
            const hash = Hash.fromHex(hex);
            const relay = new LocalNextRelayClient(toda, hash);
            if (ext == ".shield") {
                const shield = relay._getShield(hash);
                if (!shield) {
                    return;
                }
                return Buffer.from(shield.toBytes());
            }
            if (ext == ".next.toda") {
                const twist = relay._getNext(hash);
                if (!twist) {
                    return;
                }
                return Buffer.from(twist.getAtoms().toBytes());
            }
        }

        app.get("/files/:file", async function (req, res, next) {
            try {
                const file = req.params.file
                const b = findLocal(file) ?? await redirect(file);
                if (b) {
                    return res.status(200).send(b);
                }
                return res.status(404).send();
            } catch (err) {
                next(err);
            }
        });

        app.post("/hoist", async function (req, res, next) {
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
                next(err);
            }
        });

        app.use((err, req, res, next) => {
            console.error(err)
            return res.status(500);
        });

        this.app = app;
    }
}

export { TestRelayServer }