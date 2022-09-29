## Developer documentation
Any created files are stored by default under `~/.toda/store/<hash>.toda`.

### Config
On execution will generate a `yaml` config file at `~/.toda/config` using the values in `defaults.js` if one doesn't already exist. Config changes should then be made to the `yaml` file. Also generates a local line at `~/.toda/store/line.toda` secured with the default keypair.

### Security
Generates a default keypair under `~/.toda/secure/secp256r1` and `~/.toda/secure/secp256r1.pub` if not found when running a command. Also generates a salt under `~/.toda/secure/salt` for shielding.


### Usage
`toda COMMAND [--version, -v] [-i] [-h] [--out FILENAME] [--verbose] [--test] [--json] [--help]`

### Options
#### `-v, --version`
Display the current CLI version

#### `-i, --identity`
Override the default identity file to use

#### `-h, --human-readable`
Display sizes in a human-readable format

#### `-C [--list | --raw]`
Display only the content of a packet as a hex string. `--list` will display the contents as a list of hashes, while `--raw` will display the raw bytes.

### `--config FILE_PATH`
Path to a different config yaml file to use. Defaults to `~/.toda/config`

#### `--out FILENAME`
Specifies the output file path. Defaults to `~/.toda/store/<hash>.toda`

#### `--test`
Dry Run. Doesn't actually create the file, just outputs raw bytes to the console

#### `--json`
Specifies the output format should be json

#### `--help`
Display the help text

### Config Params
#### store `${os.homedir()}/.toda/store`
The path for created files to be stored.

#### publicKey `${os.homedir()}/.toda/secure/id_secp256r1.pub`
The path to your public key. Created by default if it doesn't exist.

#### privateKey `${os.homedir()}/.toda/secure/id_secp256r1`
The path to your private key. Created by default if it doesn't exist.

#### salt `${os.homedir()}/.toda/secure/salt`
The path to your salt file. Created by default if it doesn't exist.

#### line `${os.homedir()}/.toda/store/line.toda`
The path to your local line. Created by default with your keys if it doesn't exist.

#### lineServer `https://line.todaq.net/`
The path to a default line server that your local line will be tethered to.

#### inventoryServer `https://inventory.todaq.net`
The path to an inventory server for posts.

#### maxHeaderSize `1048576`
Configures the maximum header size in bytes for requests made to the inventory server. Capability tokens are set in the `X-TODA-Capability` header, which are often larger than the node default limit of `16kb`.

#### webPort `3000`
The port to run the web application on.

#### invPort `3000`
The port to run a local inventory server on.

#### invUrl `../`
The inventory server URL for the web application to point to.

## Command Reference
### create
`toda create [--secp256r1 PUB_KEY_PATH] [--ed25519 PUB_KEY_PATH] [--shield SHIELD_SPEC] [--tether URL]  {--cargo CARGO_PATH | --empty | CARGO_SRC}`

Creates a new `*.toda` file with the specified parameters and outputs the file bytes. Defaults to `~/.toda/store/<hash>.toda`. The twist will by default have its tether set to the latest twist from the configured `lineServer` (or the `--tether` arg.)

eg.
```
$ toda create --empty --shield aabbcc
```

### append
`toda append PREV [--poptop URL]  [--secp256r1 PUB_KEY_PATH] [--ed25519 PUB_KEY_PATH] [--shield SHIELD_SPEC] [--tether URL] {--cargo CARGO | --empty | CARGO_SRC}`

Creates a successor to the specified PREV `*.toda` file and appends the bytes to that file, renaming it to the new hash. Verifies control against the `--poptop` (default `config.lineServer`) before appending. Defaults to `~/.toda/store/<hash>.toda`. 

eg.
```
$ toda append 41fc9f5eb249400705724d97f2041a0e887f0ee5d9 --empty
```

### history
Usage `toda history [--twist HASH] [--line] FILE_SOURCE`

Displays the details of this file and each of its PREV twists. If `--twist` is specified, will show the history of that twist only. If `--line` is specified will show the entire history of the line containing the specified twist, including successors.

eg.
```
$ toda history --json <~/.toda/store/4110aa0c8260c64445e8a111190ee8a339776e86aa182b7aeeea492865b63a5dbc.toda
twist          	415359b8399d1cc0ecb8b10e1e989d134ef9175a0b5c70509a89eb2bfa8c755fda
sats           	00
prev           	00
tether         	00
shield         	00
reqs           	SECP256r1      	3059301306072a8648ce3d020106082a8648ce3d030107034200041203155587f8b14acf7e91d584e21aa41d0bb3551dacdc160c27dbd38901aa419c1ce39b0254aba580ba20ed4a56ebdff0ee6a9d8abc301afbd27a9c807db363
rigging        	00
cargo          	00

twist          	4110aa0c8260c64445e8a111190ee8a339776e86aa182b7aeeea492865b63a5dbc
sats           	SECP256r1      	304402200e4b50eb910c4ece7946d1a0cf7b119718a57ef464a546ec8c16433a8971835602201f9badcc19c1edb93b0833da60fd201063de448d972ea39f65d0b5f2beb58d12
prev           	415359b8399d1cc0ecb8b10e1e989d134ef9175a0b5c70509a89eb2bfa8c755fda
tether         	00
shield         	00
reqs           	SECP256r1      	3059301306072a8648ce3d020106082a8648ce3d030107034200041203155587f8b14acf7e91d584e21aa41d0bb3551dacdc160c27dbd38901aa419c1ce39b0254aba580ba20ed4a56ebdff0ee6a9d8abc301afbd27a9c807db363
rigging        	00
cargo          	00
```

```
$ toda history --json <~/.toda/store/4110aa0c8260c64445e8a111190ee8a339776e86aa182b7aeeea492865b63a5dbc.toda
[
  {
    "twist": "415359b8399d1cc0ecb8b10e1e989d134ef9175a0b5c70509a89eb2bfa8c755fda",
    "sats": "00",
    "prev": "00",
    "tether": "00",
    "shield": "00",
    "reqs": {
      "SECP256r1": "3059301306072a8648ce3d020106082a8648ce3d030107034200041203155587f8b14acf7e91d584e21aa41d0bb3551dacdc160c27dbd38901aa419c1ce39b0254aba580ba20ed4a56ebdff0ee6a9d8abc301afbd27a9c807db363"
    },
    "rigging": "00",
    "cargo": "00"
  },
  {
    "twist": "4110aa0c8260c64445e8a111190ee8a339776e86aa182b7aeeea492865b63a5dbc",
    "sats": {
      "SECP256r1": "304402200e4b50eb910c4ece7946d1a0cf7b119718a57ef464a546ec8c16433a8971835602201f9badcc19c1edb93b0833da60fd201063de448d972ea39f65d0b5f2beb58d12"
    },
    "prev": "415359b8399d1cc0ecb8b10e1e989d134ef9175a0b5c70509a89eb2bfa8c755fda",
    "tether": "00",
    "shield": "00",
    "reqs": {
      "SECP256r1": "3059301306072a8648ce3d020106082a8648ce3d030107034200041203155587f8b14acf7e91d584e21aa41d0bb3551dacdc160c27dbd38901aa419c1ce39b0254aba580ba20ed4a56ebdff0ee6a9d8abc301afbd27a9c807db363"
    },
    "rigging": "00",
    "cargo": "00"
  }
]
```

### inspect
`toda inspect HASH FILE_SOURCE [--json] [--packet]`

Displays the details of the packet associated with the specified hash in the file. Expands the reqs, sats and cargo tries by default. If `--packet` is specified will only display the top-level details of the packet.

eg.

```
$ toda inspect 41fe3edd4582ad9116a824776106659df3d055ce645f3389258f75200eaa58a25b <~/green_red_mix.toda
body
	prev      	00
	tether    	00
	shield    	00
	reqs
		requirements
			weight    	100
			requirement
				SECP256r1 	3059301306072a8648ce3d020106082a8648ce3d03010703420004d259092b977ef8718841ce1fcfa30fba2f2012f2f3b0d8b8ff5a2bacb4095f8be415696c6c9da371667b72538bb31e2fb39905ce3f2c1e69be8a64ec10fc91f8


			weight    	150
			requirement
				SECP256r1 	3059301306072a8648ce3d020106082a8648ce3d0301070342000429c2fe881e2f126eb0e2e9e2f6daf775957e99c31f5a1ac81f1de687e5ace3bb413c56bd30437ea8b552edc48192241d6ea0922ee8a3867c13750ce4185e1ce1


			weight    	200
			requirement
				SECP256r1 	3059301306072a8648ce3d020106082a8648ce3d03010703420004381dd109d3bdbd7eb8a2242ceafc7774cccd377eb26cd49764c2dd6783921939241b6363682a679e6629ef886d4bf36a8cbe25bcc3d36ae342bf243c6b5f9d73


	rigging   	00
	cargo     	00

sats      	00
```

```
$ toda inspect 41fe3edd4582ad9116a824776106659df3d055ce645f3389258f75200eaa58a25b <~/green_red_mix.toda --json
{
  "body": {
    "prev": "00",
    "tether": "00",
    "shield": "00",
    "reqs": {
      "requirements": [
        {
          "weight": 100,
          "requirement": {
            "SECP256r1": "3059301306072a8648ce3d020106082a8648ce3d03010703420004d259092b977ef8718841ce1fcfa30fba2f2012f2f3b0d8b8ff5a2bacb4095f8be415696c6c9da371667b72538bb31e2fb39905ce3f2c1e69be8a64ec10fc91f8"
          }
        },
        {
          "weight": 150,
          "requirement": {
            "SECP256r1": "3059301306072a8648ce3d020106082a8648ce3d0301070342000429c2fe881e2f126eb0e2e9e2f6daf775957e99c31f5a1ac81f1de687e5ace3bb413c56bd30437ea8b552edc48192241d6ea0922ee8a3867c13750ce4185e1ce1"
          }
        },
        {
          "weight": 200,
          "requirement": {
            "SECP256r1": "3059301306072a8648ce3d020106082a8648ce3d03010703420004381dd109d3bdbd7eb8a2242ceafc7774cccd377eb26cd49764c2dd6783921939241b6363682a679e6629ef886d4bf36a8cbe25bcc3d36ae342bf243c6b5f9d73"
          }
        }
      ]
    },
    "rigging": "00",
    "cargo": "00"
  },
  "sats": "00"
}
```

```
$ toda inspect --json --packet 4166278f9f242a9752255237a46117248f8f716ecc554735e40c3638474d8dc057 <~/.toda/store/41e6a26e2e37b721941cf450c96c95da2b91dbf9800faf50c6b3e660ab35078d9c.toda
type		Pair Trie Packet
length		91872
content		41004da6b978acf8b17cdbe6baf7ef5c344c0ad503840665bb43a8918551ea5fee	416f349e24a69b7149a0f1f211a7800378f18f5085c61021f3ad3ed0d42a97d786
		4100b15ce7d42877f0d861a1c44def21a2bb4f17336ae47d317734fd1e4614d4e1	4101a1d46d534c43e8cfbd12266d5c7bc6000b37b14cb4f545961187d78df106c2
		41010da7af1c64ee241fbe21abff6bfbe2b41222c777daabdf4e591828ea17809e	412f9d3ca7f218221aec6eec33910e7c9a08cacf121d8e5832b0caeefef9bc365b
		4101614f420c0eedd7cc586aeda7c11f9c2409a7eb293b86f94602f0d28b7431d9	41024b2518f40f6d028af922012968dfd465b3af0c494bd0c38468a0b53aa9c12b
		41025d1e84cd7babce6322408515df1bc9c83f9faf960f42347e9cac965bd45bed	41762698a158430360c367aef9d7d9fd650d8e8eca6896e076043d2845b98fcd9b
		4109bb088fe1a2a276dba9f8012afd7679b130643cea7ac0982118a488e1320287	415a7d59f442ccb93812edb651a5900cd9e18a068285cd8ab1d2dc6e79cd4c8260
		410a698aa0695b79a015ba470e5e2254e043e1bbbc4148409d9bb559d05291ffce	416489c2e43b221739e833a9e1ae3bb73c7d2121c6549f23d3f6d967c1faab2162
		410caf22673aca34f0a7efaae69c94261cb07ed91adfda3a6bdfd2e4b13ced290c	4116f092437c2ae06391e2105a439646ddff4ed0e411e5ff6d7d77583dc368a038
		...
		(and 166 more)
```

```
$ toda inspect --json --packet 411c3436751e30e42043b29c4aa9f969d681b03c3273322a798aa68af152450124 <~/.toda/store/41e6a26e2e37b721941cf450c96c95da2b91dbf9800faf50c6b3e660ab35078d9c.toda
{
  type: 'Hash Packet',
  length: 99,
  content: [
    '4123eb127b3caf920d3dd72f834b35b73e5b8bda870b0d7147838d182b5a9dd789',
    '410a5d17d3b19f82f8340d3977609aa9e86b4ad8b9bd71bd9eced9271f1d5b2e4a',
    '41d0b00c77c1f851ea4553a62e87f4c740357e1e6fe14b60dcabfbd3acf1d34018'
  ]
}
```

```
$ toda inspect --packet --C 411c3436751e30e42043b29c4aa9f969d681b03c3273322a798aa68af152450124 <~/.toda/store/41e6a26e2e37b721941cf450c96c95da2b91dbf9800faf50c6b3e660ab35078d9c.toda
4123eb127b3caf920d3dd72f834b35b73e5b8bda870b0d7147838d182b5a9dd789410a5d17d3b19f82f8340d3977609aa9e86b4ad8b9bd71bd9eced9271f1d5b2e4a41d0b00c77c1f851ea4553a62e87f4c740357e1e6fe14b60dcabfbd3acf1d34018
```

```
$ toda inspect --packet --C --list 411c3436751e30e42043b29c4aa9f969d681b03c3273322a798aa68af152450124 <~/.toda/store/41e6a26e2e37b721941cf450c96c95da2b91dbf9800faf50c6b3e660ab35078d9c.toda
4123eb127b3caf920d3dd72f834b35b73e5b8bda870b0d7147838d182b5a9dd789
410a5d17d3b19f82f8340d3977609aa9e86b4ad8b9bd71bd9eced9271f1d5b2e4a
41d0b00c77c1f851ea4553a62e87f4c740357e1e6fe14b60dcabfbd3acf1d34018
```

### list
`$ toda list [--latest] [-all] [--detailed] [DIRECTORY|FILE_PATH]`

Lists all twists found in `*.toda` files in the specified directory, or in the specified `*.toda` file. Defaults to `~/.toda/source`. If `--latest` is specified will only show the most recent focus line twists (or all if `--all` specified.) If `--detailed` is specified then all twists contained in those files will be shown, not just focuses.

```
$ toda list [DIRECTORY]
41403074e3b2c72cc00962aa87b614cdcb532ea2cb4841fd1a5afd33f80e0cc84c
4147699aee17b44e582d22f73047345fefd9b00ee298611f2d1d2e11cfcf19d1e8
```

### hoist
`$ toda hoist [--line-server URL] [--verify] FILE_SOURCE`

Hoists a twist to the specified line server. Defaults to the value of `lineServer` in the `config.yml`. If `--verify` is specified, returns the value of the Hash associated with the hoist, or an error if the hoist doesn't exist.
```
$ toda hoist <~/.toda/store/411c3436751e30e42043b29c4aa9f969d681b03c3273322a798aa68af152450124.toda
```

### get-hoist
`$ toda get-hoist [--line-server URL] FILE_SOURCE`

Returns the value of the Hash associated with the hoist, or nothing if the hoist doesn't exist. Defaults to the value of `lineServer` in the `config.yml`.
```
$ toda get-hoist <~/.toda/store/411c3436751e30e42043b29c4aa9f969d681b03c3273322a798aa68af152450124.toda
410a3e68c6cf404b1e7be188f9b341651c4afc7ec6347fe0a8e85cf827cbe089bd
```

### serve
`$ toda serve [--web [--web-port PORT] [--inv-url URL]] [--inv [--inv-port PORT] [--inv-path DIRECTORY]]`

Starts an inventory server and a web app to browse it. If neither `--web` nor `--inv` are specified, will start both by default. If web and inventory are using the same port, a single server will be started for both.
`--web` starts the web server on the specified `--web-port` or :3000.
`--inv-url` indicates the URL of the inventory server for the web app to make requests.
`--inv` starts the inventory server on the specified `--inv-port` or :3000.
`--inv-path` indicates the directory on the server where files are stored.

```
$ toda serve
Web && Inventory server running on http://localhost:3000
```

```
$ toda serve --web --web-port 8080 --inv-url http://localhost:3000 --inv
Inventory server running on http://localhost:3000
Web server running on http://localhost:8080
```


### request
`$ toda request [--capability CAP_PATH] [--url URL] [--verb HTTP_VERB] [--nonce STRING] [--data HEX]`

Authorizes the specified `capability` token and makes an HTTP request using that token as a b64 encoded http-header `X-TODA-Capability` and returns the response.

```
$ toda request --url http://test-url/files --verb get --data aabbccdd --capability ~/.toda/store/41db15f3745fa8697a275f75e6b262746e0a4a764694bc4405a9329c5c38e72d2e.toda 
```






#### Advanced

##### Hoist/Rigging
When you are ready to hoist your Twists you can use the `toda hoist` command. Since we create twists that are tethered by default, we automatically handle hoisting them to their tethered line when we append. So looking at our example above we can verify the hitch either by calling `toda get-hoist` or `toda hoist --verify` like so:

```
$ toda hoist --verify <~/.toda/store/4178feba7b2fdec3778b39348a8ba8bc1577eec57dc1480daff32c066871a92c6c.toda
4186127484e512903e79efb64d2c936ee062620842883417fa3205ad98f299bfe8

$ toda get-hoist ~/.toda/store/4178feba7b2fdec3778b39348a8ba8bc1577eec57dc1480daff32c066871a92c6c.toda
415873070210b1890a24d755e97ca1da1dfa996cc729233ca7f9368b160f6c1b04
```

`toda hoist --verify` will also give you more information about the twist you wish to verify:
```
$ toda create --empty | toda hoist --verify
The specified twist does not have a last fast twist.
```


##### Inspect
We can use `toda inspect` to take a detailed look at the hashes in a Twist. Let's look at a capability file.

```
$ toda inspect 412ec07a09fbae3ed12c640c653afc3a6511fcf4605326076771b0457f3f6bcd95 <~/.toda/store/412ec07a09fbae3ed12c640c653afc3a6511fcf4605326076771b0457f3f6bcd95.toda
type      	Basic Twist Packet
size      	34
content
	body
		prev      	00
		tether    	41f5fff74547af9b7827f08fd9cc51907ddf4dd35838c9200c49bd87863dff22f4
		shield    	414911f441b010c4d687da3ce91b3b47b91aa2b7101fc2f87f7a1ac68d39e6b487
		reqs      	00
		rigging   	00
		cargo
			00        	22eeb6569f77ff73f9ebc1583bddc8308cef7d23ebf41ac29f12d4ad7507f028af
			2208318633b506017519e9b90b0bdc8451772415ba29144ab7778cb09cc2d2fa6a
				00        	22fcef42f4592bb500a6e03fdb0c80ef679e5dce3cbb3c1ab986108b86651ccb12
				221b0ab358d4f2f42579684f44b3e7f07e857fdf89f37e1325ce334bddc628813a

...(and more)
```

Let's try looking at a few more examples:

Shield:
```
$ toda inspect 414911f441b010c4d687da3ce91b3b47b91aa2b7101fc2f87f7a1ac68d39e6b487 <~/.toda/store/412ec07a09fbae3ed12c640c653afc3a6511fcf4605326076771b0457f3f6bcd95.toda
type      	Arbitrary Packet
size      	32
content   	����'G�S!�����L�H�-��t,W
```

Tether:
```
$ toda inspect 41f5fff74547af9b7827f08fd9cc51907ddf4dd35838c9200c49bd87863dff22f4 <~/.toda/store/412ec07a09fbae3ed12c640c653afc3a6511fcf4605326076771b0457f3f6bcd95.toda
type      	Basic Twist Packet
size      	34
content
	body
		prev      	00
		tether    	415873070210b1890a24d755e97ca1da1dfa996cc729233ca7f9368b160f6c1b04
		shield    	00
		reqs
			SECP256r1 	3059301306072a8648ce3d020106082a8648ce3d03010703420004e4cff383ed220743fc68a1ff5de88cd2c97aeee923b8a28b2fd9d0644b6dd86c0c10c0b7383a702e0e6f7919884be3368aa626b0c1af2c5874a88f6a76b3311f
		rigging   	00
		cargo     	00
	sats      	00
```
