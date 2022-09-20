<template>
  <div>
    <div class="row">
      <div class="col-sm-12">
        <div class="line-alias mono">{{ this.abject.getHash() }}</div>
      </div>
    </div>
    <div class="top-level-twist abject">
      <div class="row" v-for="field in this.abject.listAllFields()">
        <div class="col-sm-6 mono key">
          {{ field }}
        </div>
        <div class="col-sm-6">
          {{ this.abject.getFieldAbject(field) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>

import { di } from '../../../../../dist/toda.web.dist.js';
const { DI } = di;

export default {
  name: 'DIViewer',
  components: {},
  data: function() {
    return {
      fields: []
    }
  },
  props: {
    abject: DI
  }
}
</script>
