<template>
  <component v-if="!this.isTwist" :is="this.abjectTypeComponent" :abject="this.abject"/>
  <LineDetails :abject="this.line"></LineDetails>
</template>

<script>

import LineDetails from '../files/line-details.vue';
import CapabilityViewer from '../abjects/capability-viewer.vue';
import DIViewer from '../abjects/di-viewer.vue';
import SimpleHistoricViewer from '../abjects/simple-historic-viewer.vue';
import { capability, simpleHistoric, twist } from '../../../../../dist/toda.web.dist.js';

const { Capability } = capability;
const { SimpleHistoric } = simpleHistoric;
const { Twist } = twist;

export default {
  name: 'AbjectViewer',
  components: {
    LineDetails,
    CapabilityViewer,
    DIViewer,
    SimpleHistoricViewer,
  },
  props: {
    abject: null
  },
  computed: {
    line() {
      if (this.isTwist) {
        return this.abject;
      }

      return new Twist(this.abject.serialize());
    },
    isTwist() {
      return this.abject instanceof Twist;
    },
    abjectTypeComponent() {
      if (this.abject instanceof Capability) {
        return 'CapabilityViewer';
      } else if (this.abject instanceof SimpleHistoric) {
        return 'SimpleHistoricViewer';
      } else {
        return 'DIViewer';
      }
    }
  }
}
</script>
