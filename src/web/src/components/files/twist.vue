<template>
  <div v-if="this.packet" class="packet basic-twist">
    <HashPacket :hash="this.bodyHash" :twist="this.twist" :title="'Body'" />
    <HashPacket :hash="this.satsHash" :twist="this.twist" :title="'Satisfied Requirements'" />
  </div>
</template>

<script>
import packetMixin from '../mixins/packet-mixin.js';
import { hash } from '../../../../../dist/toda.web.dist.js';
let { NullHash } = hash;

export default {
  name: 'Twist',
  mixins: [packetMixin],
  data: function() {
    return {
      bodyHash: new NullHash(),
      satsHash: new NullHash()
    }
  },
  watch: {
    packet: {
      handler: async function() {
        if (this.packet) {
          this.bodyHash = this.packet.getBodyHash();
          this.satsHash = this.packet.getSatsHash();
        }
      },
      immediate: true
    }
  }
}
</script>
