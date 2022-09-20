<template>
  <div v-if="this.packet" class="packet hash-list">
    <HashPacket v-for="(h, i) in this.shapedValue" :key="h" :hash="h" :twist="this.twist" :title="i + 1"/>
  </div>
</template>

<script>
import packetMixin from '../mixins/packet-mixin.js';
export default {
  name: 'HashList',
  mixins: [packetMixin]
}
</script>
