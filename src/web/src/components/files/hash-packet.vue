<template>
  <div class="hash" v-if="this.hash && !this.hash.isNull()" :title="this.packetMoniker">
    <div class="row" :class="{ toggle: this.clickable }" @click="this.clickable && this.onClick()">
      <div v-if="this.clickable" class="expand-collapse">
        <div v-if="this.expands">
          <BIconArrowDownCircle v-if="this.showDetails"/>
          <BIconArrowRightCircle v-else/>
        </div>
        <BIconZoomIn v-else/>
      </div>
      <div class="col-sm-4 key">
        <span :class="{ mono: this.isHash }">{{ this.label }}</span>
        <span v-if="this.moniker" class="moniker">({{ this.moniker }})</span>
      </div>
      <div class="mono col-sm-8" >{{ this.hash }}</div>
    </div>
    <div class="row" :class="{ expanded: this.showDetails }" v-if="this.showDetails && this.packet && this.expands">
      <div class="col-sm">
        <component v-bind:is="this.type" :hash="this.hash" :packet="this.packet" :twist="this.twist" />
      </div>
    </div>
  </div>
</template>

<script>
import hpMixin from '../mixins/hash-packet-mixin.js';
import Twist from './twist.vue';
import Body from './body.vue';
import HashList from './hash-list.vue';
import Trie from './trie.vue';
import Arb from './arb.vue';
import Symbol from './symbol.vue';
import { BIconArrowRightCircle, BIconArrowDownCircle, BIconZoomIn } from 'bootstrap-icons-vue';

export default {
  name: 'HashPacket',
  mixins: [hpMixin],
  components: {
    Twist,
    Body,
    HashList,
    Trie,
    Arb,
    Symbol,
    BIconArrowRightCircle,
    BIconArrowDownCircle,
    BIconZoomIn
  }
}
</script>
