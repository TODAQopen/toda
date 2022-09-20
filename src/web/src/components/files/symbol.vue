<template>
  <div class="symbol">
    <pre class="mono">{{ this.hash }}</pre>
  </div>
</template>

<script>
import { hash, twist } from '../../../../../dist/toda.web.dist.js';
let { Hash } = hash;
let { Twist } = twist;

export default {
  name: 'Symbol',
  props: {
    hash: Hash,
    twist: Twist
  },
  computed: {
    moniker() {
      return this.hash ? this.hash.constructor.getMoniker() : '';
    }
  }
}
</script>
