import { hash, packet, reqsat, twist } from '../../../../../dist/toda.web.dist.js';
const { ArbitraryPacket, PairTriePacket, HashPacket, BasicBodyPacket } = packet;
const { Hash } = hash;
const { RequirementMonikers } = reqsat;
const { Twist } = twist;

export default {
  data: function() {
    return {
      packet: null,
      showDetails: false
    }
  },
  props: {
    hash: Hash,
    twist: Twist,
    title: null,
    topLevel: {
      type: Boolean,
      default: false
    },
    expanded: {
      type: Boolean,
      default: true
    }
  },
  watch: {
    hash: {
      handler: async function() {
        this.packet = null;
        this.showDetails = false;

        if (!this.hash.isSymbol()) {
          this.packet = this.twist.get(this.hash);
        }
      }, immediate: true
    },
    expanded: {
      handler: function () {
        this.showDetails = this.expanded;
      }, immediate: true
    }
  },
  computed: {
    clickable() {
      return this.topLevel || this.isTwist;
    },
    expands() {
      return this.topLevel || !this.isTwist;
    },
    isTwist() {
      return this.packet && this.packet.isTwist();
    },
    isHash() {
      return this.title.isNull;
    },
    label() {
      if (!this.title) {
        return 'Hash';
      }

      return this.title;
    },
    moniker() {
      return RequirementMonikers[this.title];
    },
    packetMoniker() {
      return this.packet ? this.packet.constructor.getMoniker() : '';
    },
    type() {
      if (!this.packet) {
        return 'Symbol';
      }

      if (this.packet.isTwist()) {
        return 'Twist';
      } else if (this.packet instanceof BasicBodyPacket) {
        return 'Body';
      } else if (this.packet instanceof PairTriePacket) {
        return 'Trie';
      } else if (this.packet instanceof HashPacket) {
        return 'HashList';
      } else if (this.packet instanceof ArbitraryPacket) {
        return 'Arb';
      }
    }
  },
  methods: {
    onClick() {
      if (this.topLevel) {
        return this.toggleDetails();
      }

      let id = this.$route.params.id || this.twist.getHash();
      this.$router.push(`/${id}/${this.hash}`);
    },
    toggleDetails() {
      this.showDetails = !this.showDetails;
    }
  }
}
