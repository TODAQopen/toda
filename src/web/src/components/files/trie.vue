<template>
  <div v-if="this.packet" class="packet trie">
    <div v-for="[k, v] in this.shapedValue.entries()" :key="v">
      <HashPacket :hash="v" :twist="this.twist" :title="k"/>
    </div>
  </div>
</template>

<script>
import packetMixin from '../mixins/packet-mixin.js';
export default {
  name: 'Trie',
  mixins: [packetMixin]
}
</script>
