<template>
  <div v-if="this.packet" class="packet arb">
    <span class="view-tab" v-bind:class="{selected: this.view === 'hex'}" @click="this.changeView('hex')">Hex</span>
    <span class="view-tab" v-bind:class="{selected: this.view === 'utf8'}" @click="this.changeView('utf8')">UTF8</span>
    <span class="view-tab" v-bind:class="{selected: this.view === 'int'}" @click="this.changeView('int')">Int</span>
    <pre class="mono">{{ this.formattedContent }}</pre>
  </div>
</template>

<script>
import packetMixin from '../mixins/packet-mixin.js';
export default {
  name: 'Arb',
  mixins: [packetMixin],
  data: function() {
    return {
      view: 'hex'
    }
  },
  computed: {
    formattedContent() {
      if (this.view === 'hex') {
        return this.shapedValue;
      } else if (this.view === 'utf8') {
        return this.shapedValue.toUTF8String();
      } else if (this.view === 'int') {
        return parseInt(this.shapedValue, 16);
      }
    }
  },
  methods: {
    changeView(type) {
      this.view = type;
    }
  }
}
</script>
