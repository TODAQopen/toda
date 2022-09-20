<template>
  <div v-if="this.packet" class="packet basic-body">
    <Prev :hash="this.prev" :twist="this.twist" :title="'Previous'" />
    <HashPacket :hash="this.tether" :twist="this.twist" :title="'Tether'"/>
    <HashPacket :hash="this.shield" :twist="this.twist" :title="'Shield'"/>
    <HashPacket :hash="this.reqs" :twist="this.twist" :title="'Requirements'" />
    <HashPacket :hash="this.rigging" :twist="this.twist" :title="'Rigging'"/>
    <HashPacket :hash="this.cargo" :twist="this.twist" :title="'Cargo'" />
  </div>
</template>

<script>
import packetMixin from '../mixins/packet-mixin.js';
import Prev from './prev.vue';
import { hash } from '../../../../../dist/toda.web.dist.js';
let { NullHash } = hash;

export default {
  name: 'Body',
  mixins: [packetMixin],
  components: {
    Prev
  },
  data: function() {
    return {
      body: null,
      prev: new NullHash(),
      tether: new NullHash(),
      shield: new NullHash(),
      reqs: new NullHash(),
      rigging: new NullHash(),
      cargo: new NullHash()
    }
  },
  watch: {
    packet: {
      handler: async function() {
        if (this.packet) {
          this.prev = this.packet.getPrevHash();
          this.tether = this.packet.getTetherHash();
          this.shield = this.packet.getShieldHash();
          this.reqs = this.packet.getReqsHash();
          this.rigging = this.packet.getRiggingHash();
          this.cargo = this.packet.getCargoHash();

        }
      },
      immediate: true
    }
  }
}
</script>
