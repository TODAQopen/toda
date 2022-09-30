# Capability Tokens

[Coming soon: these commands are under development]

#### Capability
Now let's try something a little more interesting and create a Capability. This will generate a Capability token for the specified url, http verbs and expiry, using the local line as the default pop top and tethering to the local line by default.
```
$ toda capability --url https://test-url.com --verbs GET,POST --expiry `date -v +1d +%s000` | toda history
twist     	41822dda1b04aadf0ac9e2ab45f5e0d04a5b2ccc4626fc1382e084471c9aeb9a7f
sats      	00
prev      	00
tether    	41c03ed2479b97aae3f09a9e22ca9844fa566f36ac9e31fd7ed41d02dcfe63e6ed
shield    	412720a6313be624e1574bfbff6db5c422b7ab41d11f0857b2f74f0ed1ae97baa1
reqs      	00
rigging   	00
cargo
	00        	22eeb6569f77ff73f9ebc1583bddc8308cef7d23ebf41ac29f12d4ad7507f028af
	2208318633b506017519e9b90b0bdc8451772415ba29144ab7778cb09cc2d2fa6a
		00        	22fcef42f4592bb500a6e03fdb0c80ef679e5dce3cbb3c1ab986108b86651ccb12
		221b0ab358d4f2f42579684f44b3e7f07e857fdf89f37e1325ce334bddc628813a
			00        	22afcfeed9b1c0a28ed7d197f23e7d33272bdb562aa8d9ccf151b8f9767ca09032
			22882f98c8f0396585a5a040258ee7af1fa658b12b323747207a634bfee62b7095	GET

			00        	22afcfeed9b1c0a28ed7d197f23e7d33272bdb562aa8d9ccf151b8f9767ca09032
			22882f98c8f0396585a5a040258ee7af1fa658b12b323747207a634bfee62b7095	POST
		22438bff6088ea812122de07b4329c5853f1ca9e2bfe8d65c2433c4514f3b8f837
			00        	22fcef42f4592bb500a6e03fdb0c80ef679e5dce3cbb3c1ab986108b86651ccb12
			22438bff6088ea812122de07b4329c5853f1ca9e2bfe8d65c2433c4514f3b8f837	22438bff6088ea812122de07b4329c5853f1ca9e2bfe8d65c2433c4514f3b8f837
			22d29913f7eb9b76f0a1227d0b34465b7adf2236452e20734197e40da790f1f00d
				221b0ab358d4f2f42579684f44b3e7f07e857fdf89f37e1325ce334bddc628813a
					225c499de98d731839873cd66e4d84532e53162328c377d1b7fc057630d03f0436	2238cb2d3d05737963c33c391a99b06a3db6d24bbfdc18a00f595d7ab0c386c6e7
					2299980d10e44dff83b24b80472098e40ff5fee15d70a3a5d2cfac5c47311929f5
						00        	2209b7efb95a393d9ee01f6446f362e5cf56d5eee55b00e6118db367e28c6a945e
						22882f98c8f0396585a5a040258ee7af1fa658b12b323747207a634bfee62b7095
					22dba83636eaa2a14b9cc219669a4f82b7fe6d08cdd4318b5bfa37d51d47a9bf4f	22afcfeed9b1c0a28ed7d197f23e7d33272bdb562aa8d9ccf151b8f9767ca09032
				2295b439396de12248089bc7dfe33c995e5a22dfb08663d1fe10c6135069c6f1e7
					22410489d7e5b4d32f75888c24eb20765342e670fc2616969cbb1fd06e3d3324d5
						00        	2209b7efb95a393d9ee01f6446f362e5cf56d5eee55b00e6118db367e28c6a945e
						22882f98c8f0396585a5a040258ee7af1fa658b12b323747207a634bfee62b7095
					225c499de98d731839873cd66e4d84532e53162328c377d1b7fc057630d03f0436	222276108951a0926d11418a8446b01051177d720227ec2a10bd57c1b4e261f4f3
					22dba83636eaa2a14b9cc219669a4f82b7fe6d08cdd4318b5bfa37d51d47a9bf4f	22afcfeed9b1c0a28ed7d197f23e7d33272bdb562aa8d9ccf151b8f9767ca09032
				22d1e0ef56a4517d2c9508dc5840a3569f1587ccaef66b48dbbe62352679324ca9
					225c499de98d731839873cd66e4d84532e53162328c377d1b7fc057630d03f0436	222276108951a0926d11418a8446b01051177d720227ec2a10bd57c1b4e261f4f3
					22dba83636eaa2a14b9cc219669a4f82b7fe6d08cdd4318b5bfa37d51d47a9bf4f	22afcfeed9b1c0a28ed7d197f23e7d33272bdb562aa8d9ccf151b8f9767ca09032
		2295b439396de12248089bc7dfe33c995e5a22dfb08663d1fe10c6135069c6f1e7
			00        	22afcfeed9b1c0a28ed7d197f23e7d33272bdb562aa8d9ccf151b8f9767ca09032
			22882f98c8f0396585a5a040258ee7af1fa658b12b323747207a634bfee62b7095	https://test-url.com
		22d1e0ef56a4517d2c9508dc5840a3569f1587ccaef66b48dbbe62352679324ca9
			00        	22afcfeed9b1c0a28ed7d197f23e7d33272bdb562aa8d9ccf151b8f9767ca09032
			22882f98c8f0396585a5a040258ee7af1fa658b12b323747207a634bfee62b7095	2022-08-27T14:44:17.000Z

...(and more)
```

#### Capability-Authorize
Now that we've created a Capability, we want to authorize it for a particular request.
```
$ toda capability-authorize --url http://test-url.com/path --verb GET <~/.toda/store/41822dda1b04aadf0ac9e2ab45f5e0d04a5b2ccc4626fc1382e084471c9aeb9a7f.toda | toda history

...(and more)

twist     	417b3b2061ab152ca4bb10552cffe89f6d025801f12ffc2bec052092f04eb716c2
sats      	00
prev      	41822dda1b04aadf0ac9e2ab45f5e0d04a5b2ccc4626fc1382e084471c9aeb9a7f
tether    	41c03ed2479b97aae3f09a9e22ca9844fa566f36ac9e31fd7ed41d02dcfe63e6ed
shield    	00
reqs      	00
rigging   	00
cargo
	00        	22eeb6569f77ff73f9ebc1583bddc8308cef7d23ebf41ac29f12d4ad7507f028af
	222564ba77745b564eada13dc236aef5967969d8e459160c1a02e8846b530798b3
		00        	22fcef42f4592bb500a6e03fdb0c80ef679e5dce3cbb3c1ab986108b86651ccb12
		22422fe74222b154c1741bf93b6078eeee42166a36c81a0c47e35b873e553921b5
			00        	22afcfeed9b1c0a28ed7d197f23e7d33272bdb562aa8d9ccf151b8f9767ca09032
			22882f98c8f0396585a5a040258ee7af1fa658b12b323747207a634bfee62b7095	GET
		22438bff6088ea812122de07b4329c5853f1ca9e2bfe8d65c2433c4514f3b8f837
			00        	22fcef42f4592bb500a6e03fdb0c80ef679e5dce3cbb3c1ab986108b86651ccb12
			22438bff6088ea812122de07b4329c5853f1ca9e2bfe8d65c2433c4514f3b8f837	22438bff6088ea812122de07b4329c5853f1ca9e2bfe8d65c2433c4514f3b8f837
			22d29913f7eb9b76f0a1227d0b34465b7adf2236452e20734197e40da790f1f00d
				22422fe74222b154c1741bf93b6078eeee42166a36c81a0c47e35b873e553921b5
				2284981ad9a7550edf28acb484e4dfabc3ea30ffe92d1052a6a66ed617d8e2defa
					225c499de98d731839873cd66e4d84532e53162328c377d1b7fc057630d03f0436	222276108951a0926d11418a8446b01051177d720227ec2a10bd57c1b4e261f4f3
					22dba83636eaa2a14b9cc219669a4f82b7fe6d08cdd4318b5bfa37d51d47a9bf4f	22afcfeed9b1c0a28ed7d197f23e7d33272bdb562aa8d9ccf151b8f9767ca09032
				2295b439396de12248089bc7dfe33c995e5a22dfb08663d1fe10c6135069c6f1e7
					22410489d7e5b4d32f75888c24eb20765342e670fc2616969cbb1fd06e3d3324d5
						00        	2209b7efb95a393d9ee01f6446f362e5cf56d5eee55b00e6118db367e28c6a945e
						22882f98c8f0396585a5a040258ee7af1fa658b12b323747207a634bfee62b7095
					225c499de98d731839873cd66e4d84532e53162328c377d1b7fc057630d03f0436	222276108951a0926d11418a8446b01051177d720227ec2a10bd57c1b4e261f4f3
					22dba83636eaa2a14b9cc219669a4f82b7fe6d08cdd4318b5bfa37d51d47a9bf4f	22afcfeed9b1c0a28ed7d197f23e7d33272bdb562aa8d9ccf151b8f9767ca09032
		2284981ad9a7550edf28acb484e4dfabc3ea30ffe92d1052a6a66ed617d8e2defa
			00        	22afcfeed9b1c0a28ed7d197f23e7d33272bdb562aa8d9ccf151b8f9767ca09032
			22882f98c8f0396585a5a040258ee7af1fa658b12b323747207a634bfee62b7095	1661525103809
		2295b439396de12248089bc7dfe33c995e5a22dfb08663d1fe10c6135069c6f1e7
			00        	22afcfeed9b1c0a28ed7d197f23e7d33272bdb562aa8d9ccf151b8f9767ca09032
			22882f98c8f0396585a5a040258ee7af1fa658b12b323747207a634bfee62b7095	http://test-url.com/path
```





### capability
`$ toda capability [--url URL] [--verbs HTTP_VERBS] [--expiry EPOCH_TIMESTAMP_MS] [--shield HEX] [--pop-top URL|FILE_PATH] [--tether URL|FILE_PATH]`

Generates a Capability token for the specified url, http verbs and expiry. Uses the TodaQ Fast line as the default pop top and tethers to the local line by default.

```
$ toda capability --url https://test-url.com --verbs GET,POST --expiry 1660142881000
```

For the expiry arg there's a simple bash one liner to generate a timestamp in MS for one day from now that you can write inline with your command: `date -v +1d +%s000`

```
$ toda capability --url https://test-url.com --verbs GET,POST --expiry `date -v +1d +%s000`
```


### capability-authorize
`$ toda capability-authorize [--url URL] [--verb HTTP_VERB] [--nonce STRING] [--shield HEX] {--capability CAP_PATH | CAP_SRC}`

Appends an Authorization to the specified Capability and handles the hoisting. Assumes tethering and hoisting to the local line by default. Verifies control against the Capability's poptop before modifying. Updates the Capability hash and file name similar to `toda append`

```
$ toda capability-authorize --url http://test-url.com/path --verb GET <~/.toda/store/4196c191e12eb809f621b331ded008bb9f33b8098543c89008432f57cf0c8088a9.toda
```

### capability-delegate
`$ toda capability-delegate [--capability CAP_PATH] [--url URL] [--verbs HTTP_VERBS] [--expiry EPOCH_TIMESTAMP_MS] [--shield HEX] [--tether URL|FILE_PATH] [CAP_SOURCE]`

Creates a new Capability delegate of the specified Capability. Timestamp can be generated inline using a command like `date -v +1d +%s000`.

```
$ toda capability-delegate --url http://test-url.com/path --verbs GET,PUT --expiry `date -v +1d +%s000` <~/.toda/store/410318adab8a9980434fc98fec04e0e4924f0f32b5aee560c9dd8cd9e98bbe1d8f.toda
```
