<template>
  <div>
    <div class="util-wrapper">
      <div class="row">
        <div class="col-sm-12">
          <div class="line-alias mono">{{ this.lineAlias }}</div>
        </div>
      </div>

      <div class="row">
        <div class="col-sm-6">
          <a href="#" v-if="this.twist && this.showTopNav" @click.prevent="this.backToTop()"><BIconZoomOut/> Top</a>
        </div>
      </div>
    </div>

    <div class="top-level-twist" v-for="(twistHash, i) in this.twistHashes" :key="twistHash">
      <HashPacket :hash="twistHash" :twist="this.twist" :title="`v${this.twistHashes.length - i}`"
                  :expanded="i === 0" :topLevel="true" />
    </div>
  </div>
</template>

<script>

import { BIconZoomOut } from 'bootstrap-icons-vue';
import aliases from '../../../public/aliases.json';
import { twist, line } from '../../../../../dist/toda.web.dist.js';

const { Twist } = twist;
const { Line } = line;

export default {
  name: 'LineDetails',
  components: {
    BIconZoomOut
  },
  data: function() {
    return {
      twist: null,
      twistHashes: [],
      id: this.$route.params.id
    }
  },
  props: {
    abject: null
  },
  watch: {
    abject: {
      handler: async function() {
        if (this.abject) {
          this.twist = this.abject;
          let ln = Line.fromAtoms(this.twist.getAtoms());
          this.twistHashes = ln.history(this.twist.getHash()).reverse();
        }
      },
      immediate: true
    }
  },
  computed: {
    lineAlias() {
      let ln = Line.fromAtoms(this.twist.getAtoms());
      let lineOrigin = ln.first(this.twist.getHash());
      return aliases[lineOrigin] || lineOrigin;
    },
    showTopNav() {
      return this.id !== this.$route.params.id;
    }
  },
  methods: {
    backToTop() {
      this.$router.push(`/${this.id}`);
    }
  }
}
</script>
