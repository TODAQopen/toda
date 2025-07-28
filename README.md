<p align="center">
  <a href="https://engineering.todaq.net/">
    <img src="https://engineering.todaq.net/logo.png" alt="Bootstrap logo" width="200" height="65">
  </a>
</p>

<h3 align="center">TODA Files: A Cryptographic Asset Structure</h3>

A TODA file is a representation of a digital asset. It is based on a novel cryptographic data structure.
<br>
<br>
This package contains the library for interacting with low-level structures, as well as higher-level abstractions for application design. 

* Authors: https://engineering.todaq.net
* Theoretics: https://arxiv.org/abs/2208.13617
* Institute: https://trie.site
* Specifications: https://trie.site/rigging_specifications.pdf

## Table of contents

- [Code Layout](#code-layout)
- [TODA Client](#toda-client)


## Code Layout

### core:
Defines Hash and Packet, the only two core data structures.
Includes a rig (structure) checker, which assesses asset integrity.

- Atoms: an ordered hashmap of <Hash>:<respective Packet> pairs
- Shield: utilities for creating and checking shielded values
- ReqSat: utilities for creating and parsing Requirements and Satisfactions packets
- Interpret: the rig checker
- Twist: an abstraction over Hash and Packets which represents twists
- TwistBuilder: a factory for Twists

### abject:
Higher-level structures describing contents of TODA assets, and how to apply the rig checker to determine their integrity.
- Actionable: any TODA object requiring a line of integrity
- DelegableActionable: a TODA object which depends on the integrity of a another in a particular way
- DI: Basic container for fields and values
- Primitive: Boxes up values for float, string, boolean in a well-specified byte representation
- Capability: a DelegableActionable intended for authorization

## client:
Runtime object for interacting with TODA data and servers.
