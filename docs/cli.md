# TODA Command Line Suite

## Getting Started
See also the [quickstart guide](quickstart.md)

## Table of contents

- [Setup](#setup)
- [Tutorial](#tutorial)
- [Command Reference](#command-reference)
- [Advanced](developer.md)

### Setup
`npm install -g todajs` using node >= 16 LTS

### Tutorial
The following tutorial will walk you through some of the basic functionality of the CLI. For more detailed documentation on each command and the available options, please see the Usage section following this Quickstart tutorial.

This tutorial reflects the common use of the CLI for *low level developer shell operations* only.  Application developers (and, certainly, users) should _never_ deal with raw structures in this manner.  Applications are built out of higher level constructs, using provided libraries and APIs.  The examples below demonstrate creating assets which do not have significant application components: all asset payloads/cargo remain up to the application developer to create and assess.

#### Create
Run `toda create --empty | toda history` to generate a simple twist and display its history. The twist will automatically be tethered to the configured line server (TodaQ Fast Line) by default.

eg.
```
$ toda create --empty | toda history
twist     	4139ba4c5b60a9b53c706da6a02a2899a04d200bcdb27450ded9e52a59b3635acc
sats      	00
prev      	00
tether    	415873070210b1890a24d755e97ca1da1dfa996cc729233ca7f9368b160f6c1b04
shield    	00
reqs      	00
rigging   	00
cargo     	00
```

This file was created in `~/.toda/store/4139ba4c5b60a9b53c706da6a02a2899a04d200bcdb27450ded9e52a59b3635acc.toda`.

A few other files have been generated:
- A local line (`~/.toda/store/line.toda`)
- A user config file generated at `~/.toda/config`
- Secure keys and a generated Salt at `~/.toda/secure`.

Next, generate a twist with some properties. Specific hash fields within the definition of a TODA twist can be populated per below:
```
$ toda create --empty --secp256r1 ~/.toda/secure/id_secp256r1.pub --shield AABBCC | toda history
twist     	41f7c7d5f78ac70d71bfdf823916509e6bbee1dd2a88e220b3258875d794d700ae
sats      	00
prev      	00
tether    	415873070210b1890a24d755e97ca1da1dfa996cc729233ca7f9368b160f6c1b04
shield    	41d8f009240290ceda086a390c914136a41fa2ad0d49243bd985698b0236b43c1a
reqs
	SECP256r1 	3059301306072a8648ce3d020106082a8648ce3d0301070342000436e58cf8a739df66c7e0e9e268cf8b3383ca72e1861af517f1ac928b212bdd349604114870bbcf74ee82c416c91d5230b56b3af2c01d7ced803a33cd91209fb4
rigging   	00
cargo     	00

```

#### Append
To extend the newly-created asset, new twists are appended in line. When appending to a Twist with signature requirements, the CLI tries to satisfy those requirements using the `--identity` (the configured private key `~/.toda/secure/id_secp256r1` by default).

```
$ toda append 41f7c7d5f78ac70d71bfdf823916509e6bbee1dd2a88e220b3258875d794d700ae --empty | toda history
twist     	41f7c7d5f78ac70d71bfdf823916509e6bbee1dd2a88e220b3258875d794d700ae
sats      	00
prev      	00
tether    	415873070210b1890a24d755e97ca1da1dfa996cc729233ca7f9368b160f6c1b04
shield    	41d8f009240290ceda086a390c914136a41fa2ad0d49243bd985698b0236b43c1a
reqs
	SECP256r1 	3059301306072a8648ce3d020106082a8648ce3d0301070342000436e58cf8a739df66c7e0e9e268cf8b3383ca72e1861af517f1ac928b212bdd349604114870bbcf74ee82c416c91d5230b56b3af2c01d7ced803a33cd91209fb4
rigging   	00
cargo     	00

twist     	4178feba7b2fdec3778b39348a8ba8bc1577eec57dc1480daff32c066871a92c6c
sats
	SECP256r1 	3045022029a35ecda7c6a3856b79c0dc81f8775879aa18bb15b66e0d8e5335e13d2992d10221009248a95dee3bd2714b2c259573f9a08535a1ebd87ad4b5702662724c38aa5170
prev      	41f7c7d5f78ac70d71bfdf823916509e6bbee1dd2a88e220b3258875d794d700ae
tether    	415873070210b1890a24d755e97ca1da1dfa996cc729233ca7f9368b160f6c1b04
shield    	00
reqs
	SECP256r1 	3059301306072a8648ce3d020106082a8648ce3d0301070342000436e58cf8a739df66c7e0e9e268cf8b3383ca72e1861af517f1ac928b212bdd349604114870bbcf74ee82c416c91d5230b56b3af2c01d7ced803a33cd91209fb4
rigging   	00
cargo     	00
```

Notice that the requirements have been satisfied. The original file `~/.toda/store/41f7c7d5f78ac70d71bfdf823916509e6bbee1dd2a88e220b3258875d794d700ae.toda` has been renamed to the new hash, `~/.toda/store/4178feba7b2fdec3778b39348a8ba8bc1577eec57dc1480daff32c066871a92c6c.toda`.

If you try to append to an asset with signature requirements the local environment cannot satisfy, the operation will fail. Below we try to set a public key requirement, but since the default identity `~/.toda/secure/id_secp256r1` does not match the required key, the commend fails with a warning. 
```
$ toda create --empty --secp256r1 ~/.toda/secure/anotherkey.pub | toda history
WARN: The specified identity does not satisfy the specified requirements.
```

If the correct private key is specified with `--identity`, the command succeeds.

```
$ toda create --empty --secp256r1 ~/.toda/secure/anotherkey.pub --identity ~/.toda/secure/anotherkey | toda history
twist     	41f5fff74547af9b7827f08fd9cc51907ddf4dd35838c9200c49bd87863dff22f4
sats      	00
prev      	00
tether    	415873070210b1890a24d755e97ca1da1dfa996cc729233ca7f9368b160f6c1b04
shield    	00
reqs
	SECP256r1 	3059301306072a8648ce3d020106082a8648ce3d03010703420004e4cff383ed220743fc68a1ff5de88cd2c97aeee923b8a28b2fd9d0644b6dd86c0c10c0b7383a702e0e6f7919884be3368aa626b0c1af2c5874a88f6a76b3311f
rigging   	00
cargo     	00
```

#### History
The history command outputs the history of each twist in the line of an asset:
```
$ toda history 41be1ea
twist     	4112610ee1a07be60f02ac505e4dca708bf5d091eed72c1eeff936734b08171409
sats      	00
prev      	00
tether    	4186127484e512903e79efb64d2c936ee062620842883417fa3205ad98f299bfe8
shield    	00
reqs      	00
rigging   	00
cargo     	00

twist     	41be1ea751590dc36ae9de3e9177e8e26a69f069c06efdd42d0fc41416ae3ece85
sats      	00
prev      	4112610ee1a07be60f02ac505e4dca708bf5d091eed72c1eeff936734b08171409
tether    	4186127484e512903e79efb64d2c936ee062620842883417fa3205ad98f299bfe8
shield    	00
reqs      	00
rigging   	00
cargo     	00

```

If we only want to see the history of a specific focus twist, we can specify that twist:
```
$ toda history ~/.toda/store/4102a98b9530007dc596fa3978dc9de113124b901ea05e8331cb2ed339c600d3b1.toda --json --twist 41be1ea751590dc36ae9de3e9177e8e26a69f069c06efdd42d0fc41416ae3ece85
[
  {
    "twist": "4112610ee1a07be60f02ac505e4dca708bf5d091eed72c1eeff936734b08171409",
    "sats": "00",
    "prev": "00",
    "tether": "4186127484e512903e79efb64d2c936ee062620842883417fa3205ad98f299bfe8",
    "shield": "00",
    "reqs": "00",
    "rigging": "00",
    "cargo": "00"
  },
  {
    "twist": "41be1ea751590dc36ae9de3e9177e8e26a69f069c06efdd42d0fc41416ae3ece85",
    "sats": "00",
    "prev": "4112610ee1a07be60f02ac505e4dca708bf5d091eed72c1eeff936734b08171409",
    "tether": "4186127484e512903e79efb64d2c936ee062620842883417fa3205ad98f299bfe8",
    "shield": "00",
    "reqs": "00",
    "rigging": "00",
    "cargo": "00"
  }
]
```
(Notice, here, the output is printing in JSON format, given the flag)

Or you could look at the history of the line, for instance:
```
$ toda history ~/.toda/store/4102a98b9530007dc596fa3978dc9de113124b901ea05e8331cb2ed339c600d3b1.toda --twist 4186127484e512903e79efb64d2c936ee062620842883417fa3205ad98f299bfe8
twist     	41203473016686f77fc6dfcba4d6f60baf4690dd39a2cea73257ddcb60690a2c54
sats      	00
prev      	00
tether    	00
shield    	00
reqs
	SECP256r1 	3059301306072a8648ce3d020106082a8648ce3d03010703420004178edde47eb30cef554fef462c06c98b6852875ba724a7de2095fb6f590191900e2b5de64d2d6a43359da658b38f5f1774187d29add503a79c47b7a1a405bddf
rigging   	00
cargo     	00

twist     	419a26717135da2bd8ae34c98198f8864cca123b8053da60956d86fc2e01ab3528
sats
	SECP256r1 	3045022100d25d50ca63679cd818be8a181eb98f1c4ba193a21f6c524d59c6d4b330e0a84f02205302f4de725377ccf5309c5b695d80d6c706d8489be0ae27724432705aa8f47e
prev      	41203473016686f77fc6dfcba4d6f60baf4690dd39a2cea73257ddcb60690a2c54
tether    	00
shield    	00
reqs
	SECP256r1 	3059301306072a8648ce3d020106082a8648ce3d03010703420004fd8f900dbd49fd67a504e16801da529d6da9c395ec40ff873c8361d17932aa61f86fbf22cef8d1f07bef802dcf69a3cbd653905e59eca117071133fa922c7f2e
rigging   	41731ed4ce7a06840c120e68fb979298cd3c26c604264c7943e3346aab640198aa
cargo     	00

...(and more)
```


#### List
We can also list the files that we've created so far. By default `toda list` will display all of the focus twists among files in the configured toda store (`~/.toda/store`).
```
$ toda list
4102a98b9530007dc596fa3978dc9de113124b901ea05e8331cb2ed339c600d3b1
412ec07a09fbae3ed12c640c653afc3a6511fcf4605326076771b0457f3f6bcd95
4178feba7b2fdec3778b39348a8ba8bc1577eec57dc1480daff32c066871a92c6c
41f5fff74547af9b7827f08fd9cc51907ddf4dd35838c9200c49bd87863dff22f4

```

#### Control

It's important to understand whether the local environment has control over a file. This can be verified using the `control` command:

```
$ toda control 41db1b
41cf0e38a7732f816c59e09ce11a403ad3e5b3c23fe502dc03ed4d230dacb96a5e
The Local Line integrity has been verified. This system has control of this file as of 41208b960dd57e65659c59919dc8b46e0a0dae8c92830200ad7e0ea0760b6cbaf7 [2022-08-31T18:53:57.408041Z]
```

Append to that twist
```
$ toda append 41db1b --empty
4192805f1cd567a799087943057abff6463ab1ffb13c33574c999115c6fd665ef6
```

Verify control of the appended twist
```
$ toda control 4192805f
41cf0e38a7732f816c59e09ce11a403ad3e5b3c23fe502dc03ed4d230dacb96a5e
The Local Line integrity has been verified. This system has control of this file as of 41208b960dd57e65659c59919dc8b46e0a0dae8c92830200ad7e0ea0760b6cbaf7 [2022-08-31T18:53:57.408041Z]
```
Now change the tether of that twist by appending with the tether hash of the user you wish to send it to
```
$ toda append 4192805f --empty --tether 41967e3688f9398891de944ca45fd0eb86bf9ca08ef2c1f540c011d60bdb5d9b96
410b23d6fd204c8a0ebd2d12e203bd2dc860318ebe43d219234dc9f6d39e8359fc
```
Verify this twist is no longer controlled by you and refresh it with the latest tethered atoms.
```
$ toda control 410b23d
Unable to establish local control of this file (verifying controller)
```

#### Upload (Post)
The CLI contains a quick shortcut for uploading files from the local inventory to a remote store.  When no server is specified, they are uploaded by default to the value in `config.inventoryServer`.

e.g.:
```
toda post 410b23
```

The receiving user can now download the file and verify the control it: 
```
$ toda control 410b23d
419ca122cc59472b3235617a74fe186c48bb9bdc0e7fb835ea356886f3b933589a
41967e3688f9398891de944ca45fd0eb86bf9ca08ef2c1f540c011d60bdb5d9b96
The Local Line integrity has been verified. This system has control of this file as of 41208b960dd57e65659c59919dc8b46e0a0dae8c92830200ad7e0ea0760b6cbaf7 [2022-08-31T18:53:57.408041Z].
```

## Command Reference
Any created files are stored by default under `~/.toda/store/<hash>.toda`.


### create
`toda create [--secp256r1 PUB_KEY_PATH] [--ed25519 PUB_KEY_PATH] [--shield SHIELD_SPEC] [--tether URL]  {--cargo CARGO_PATH | --empty | CARGO_SRC}`

Creates a new `*.toda` file with the specified parameters and outputs the file bytes. Defaults to `~/.toda/store/<hash>.toda`. The twist will by default have its tether set to the latest twist from the configured `lineServer` (or the `--tether` arg.)

eg.
```
$ toda create --empty --shield aabbcc
```

### append
`toda append PREV [--poptop URL]  [--secp256r1 PUB_KEY_PATH] [--ed25519 PUB_KEY_PATH] [--shield SHIELD_SPEC] [--tether URL] {--cargo CARGO_PATH | --empty | CARGO_SRC}`

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

### list
`$ toda list [-all] [--detailed] [DIRECTORY|FILE_PATH]`

Lists all twists found in `*.toda` files in the specified directory, or in the specified `*.toda` file. Defaults to `~/.toda/source`. If `--detailed` is specified then all twists contained in those files will be shown, not just focuses.

```
$ toda list [DIRECTORY]
41403074e3b2c72cc00962aa87b614cdcb532ea2cb4841fd1a5afd33f80e0cc84c
4147699aee17b44e582d22f73047345fefd9b00ee298611f2d1d2e11cfcf19d1e8
```


### control
`$ toda control [FILE_PATH] [--poptop PATH] [--refresh]`

Verifies the integrity of the specified Twist against the poptop (defaults to `config.lineServer`) and that you are the controller of the Abject. `--refresh` will update the file with the latest twists from the tethered lines, to ensure the proof is complete.

```
$ toda control ~/.toda/store/41d7f82ee22e34497c4a802fbb4b9ceff81fceefc93f75c1bfe231d581ef7c8a90.toda
414babde215ac0c13f86ad81234e6452afb4f38a4b10ba53a03207fa857fe58c62
The Local Line integrity has been verified. This system has control of this file as of 41719a39cbc9cbc888e4a92a0b6851864aacce8947340740cfbd7506722b384dea [2022-08-30T18:22:04.314846Z].
```

### post
`$ toda post [--server URL] FILE_SOURCE`

Sends a file to an inventory server. Defaults to the value of `inventoryServer` in the `config.yml`.

```
$ toda post < ~/.toda/store/411c3436751e30e42043b29c4aa9f969d681b03c3273322a798aa68af152450124.toda
```


## Advanced / Developer
Further notes on forthcoming and unsupported commands is available [here](developer.md).
