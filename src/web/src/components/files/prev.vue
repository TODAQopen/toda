<template>
  <div class="hash" v-if="this.hash && !this.hash.isNull()">
    <div class="row">
      <div class="col-sm-4 key">{{ this.label }}</div>
      <div class="col-sm-8 mono">{{ this.hash }}</div>
    </div>
  </div>
</template>

<script>
import hpMixin from '../mixins/hash-packet-mixin.js';
export default {
  name: 'Prev',
  mixins: [hpMixin]
}
</script>
