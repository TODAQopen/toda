# TODA Cryptographic Asset System

TODA is a system for creating digital assets, based on a unique crypographic distributed data structure and supporting systems.

This package contains the library for interacting with low-level structures, as well as higher-level abstractions for application design.  It additionally contains the `toda` command-line tool to assist with development, debugging, admin and support.  Further, the CLI now contains a quick-start server for serving and viewing assets.

* Authors: https://engineering.todaq.net
* Theoretics: https://arxiv.org/abs/2208.13617
* Institute: https://trie.site
* Specifications: https://trie.site/rigging_specifications.pdf

## Command Line Suite

`npm install -g todajs` using node >= 16 LTS

See the [command line tools documentation](docs/cli.md)

## Code Layout

### core:
Defines Hash and Packet, the only two core data structures.
Relies on a util class we have called ByteArray which extends UIntArray.
Includes a Rig Checker, which assesses the validity of asset integrity.

- Atoms: an ordered hashmap of <Hash>:<respective Packet> pairs
- Shield: utilities for creating and checking Shield values
- ReqSat: utilities for creating and parsing Requirements and Satisfactions packets
- interpret: the rig checker
- Twist: an abstraction over Hash and Packets which represents twists
- TwistBuilder: a factory for Twists

### abject:
Higher-level structures describing contents of TODA assets and how to apply the rig checker in various desireable ways.
- Actionable: any TODA object requiring a line of integrity
- DelegableActionable: a TODA object which depends on the integrity of a another in a particular way
- DI: Basic container for fields and values
- Primitive: Boxes up values for float, string, boolean in a well-specified byte representation
- Capability: a DelegableActionable intended for authorization

## TODA Client
Coming soon: while the command-line tools provide a window into the range of functionality provided by the core libraries, these are being abstracted into an application developer-friendly class.
