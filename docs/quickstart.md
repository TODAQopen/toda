## Quick Start Tutorial
Please refer to our [CLI Docs](cli.md) for a more detailed walkthrough and examples.

- Install with [npm](https://www.npmjs.com/): `npm install -g toda-js`
- Requires node >= 16 LTS

The first time you run a toda command a few files will be automatically generated:
- A new keypair: `~/.toda/secure/id_secp256r1`, `~/.toda/secure/id_secp256r1`
- A local line secured with your keypair and tethered to the TodaQ Fast Line: `~/.toda/store/line.toda`
- A user config file: `~/.toda/config`

### Create a Twist
- Generate a simple twist by running `toda create --empty`

The hash of the twist will be displayed in the console. This twist will automatically be tethered to your local line (`TodaQ Fast Line`) and stored in the configured store (`~/.toda/store`)

eg.
```
$ toda create --empty
4129f42cab09603b43d89d23778d99f00859601ae46dbba4cc80f44d3e263176d9
```

### List Twists
- Verify that our twist was created by running `toda list`
```
$ toda list
4129f42c	[Twist]	AIP 41d43078 [default]	✓ Local control
41d43078	[Twist]	AIP 41d43078 [default]	✓ Local control
```

Notice that two twists appear - the twist we've created, `4129f42c`, and the hash of our local line, `41d43078`.


#### Append to a Twist
- Append to the Twist we just created with `toda append --prev 4129f42c --empty`
``` 
$ toda append --prev 4129f42c --empty
Abject refreshed!
>3e263176d9...............Material received [/Users/meverson/.toda/store/line.toda]
>fea12ced43...............Material received [https://line.todaq.net/line]
>48ddf57e56...............Reached AIP


416372b92f4814fbf541f7b1e330c118ca116c64faf75f50e6785a94164d8c5f30
```

Notice the logs indicating that control of the Twist has been verified before appending to it. If control of the Twist can't be verified the process will exit with an error code.

### View Twist History
- We can view our Twist's history by running `toda history 416372`

``` 
$ toda history 416372
twist     	4129f42cab09603b43d89d23778d99f00859601ae46dbba4cc80f44d3e263176d9
sats      	00
prev      	00
tether    	41d430785b0a54750320b701021a5c657451bb268bb2f16ad4de8db9fea12ced43
shield    	00
reqs      	00
rigging   	00
cargo     	00

twist     	416372b92f4814fbf541f7b1e330c118ca116c64faf75f50e6785a94164d8c5f30
sats      	00
prev      	4129f42cab09603b43d89d23778d99f00859601ae46dbba4cc80f44d3e263176d9
tether    	41d430785b0a54750320b701021a5c657451bb268bb2f16ad4de8db9fea12ced43
shield    	00
reqs      	00
rigging   	00
cargo     	00
```

There are a few things to notice here:
- There are two entries, one for each ancestor of this Twist, ordered from least to most recent.
- The prev hash `4129f4` matches the original Twist we created, and also matches the first entry in this list.
- The twist's tether hash `41d430` refers to our local line, as we saw above with `toda list`.

### Verify Control of a Twist
- Verify control of a Twist by running `toda control 416372`

``` 
$ toda control 416372
Abject refreshed!
>3e263176d9...............Material received [/Users/meverson/.toda/store/line.toda]
>fea12ced43...............Material received [https://line.todaq.net/line]
>48ddf57e56...............Reached AIP


41d430785b0a54750320b701021a5c657451bb268bb2f16ad4de8db9fea12ced43
The Local Line integrity has been verified. This system has control of this file as of 41208b960dd57e65659c59919dc8b46e0a0dae8c92830200ad7e0ea0760b6cbaf7 [2022-08-31T18:53:57.408041Z].
```

There are a few things to notice here:
- The latest proof information has been retrieved in order to verify control of the file.
- A list of the twist's tethers is displayed
- The latest hash on the topline for which we can verify control is displayed, along with its associated timestamp

### Transfer control of a file to another party
- Append to the twist, setting the tether hash to that of another user's local line:
``` 
$ toda append --prev 416372 --tether 416d4e7a220a21a0142bebebbf73ae9fdd5d869387d0aea8c7762b283400e8a3bb
Abject refreshed!
>3e263176d9...............Material received [/Users/meverson/.toda/store/line.toda]
>fea12ced43...............Material received [https://line.todaq.net/line]
>48ddf57e56...............Reached AIP


416f050cdfbc9c21045c2fcd875fc074366f8540e53aeabdce3c61ea85a1ef6765
```

- Verify that we no longer have control of this Twist:
``` 
$ toda control 416f05
Abject refreshed!
>3e263176d9...............Material received [/Users/meverson/.toda/store/line.toda]
>fea12ced43...............Material received [https://line.todaq.net/line]
>48ddf57e56...............Reached AIP


Unable to establish local control of this file (verifying controller)
```

- Send the file to the target user, either directly or by posting it to the configured inventory server:
``` 
$ toda post 416f05
Posting to the inventory server...
>85a1ef6765...............Material received [/Users/meverson/.toda/store/line.toda]
>e23271f0cf...............Material received [https://line.todaq.net/line]
>e9f6ab2ea6...............Reached AIP


✔ Successfully stored abject 85a1ef6765 on https://inventory.todaq.net
```

- Finally, the target user can download the file and verify that they now have control over it:
``` 
$ toda control 416372
Abject refreshed!
>3e263176d9...............Material received [/Users/meverson/.toda/store/line.toda]
>fea12ced43...............Material received [https://line.todaq.net/line]
>48ddf57e56...............Reached AIP


41d430785b0a54750320b701021a5c657451bb268bb2f16ad4de8db9fea12ced43
The Local Line integrity has been verified. This system has control of this file as of 41208b960dd57e65659c59919dc8b46e0a0dae8c92830200ad7e0ea0760b6cbaf7 [2022-08-31T18:53:57.408041Z].
```
