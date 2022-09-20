<template>
  <div>
    <div class="row">
      <div class="col-sm-12">
        <div class="line-alias mono">{{ this.moniker }}</div>
      </div>
    </div>
    <div class="top-level-twist abject">
      <div class="row">
        <div class="col-sm-6 mono key">
          TIMESTAMP
        </div>
        <div class="col-sm-6">
          {{ this.abject.timestamp() }}
        </div>
      </div>
      <div class="row">
        <div class="col-sm-6 mono key">
          TETHER URL
        </div>
        <div class="col-sm-6">
          {{ this.abject.tetherUrl() }}
        </div>
      </div>
      <div class="row">
        <div class="col-sm-6 mono key">
          THIS URL
        </div>
        <div class="col-sm-6">
          {{ this.abject.thisUrl() }}
        </div>
      </div>
      <div class="row">
        <div class="col-sm-6 mono key">
          INFO URL
        </div>
        <div class="col-sm-6">
          {{ this.abject.infoUrl() }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>

import { simpleHistoric, twist, hash } from '../../../../../dist/toda.web.dist.js';
const { SimpleHistoric } = simpleHistoric;
const { Twist } = twist;
const { NullHash } = hash;

export default {
  name: 'SimpleHistoricViewer',
  props: {
    abject: SimpleHistoric
  },
  computed: {
    moniker() {
      return this.abject.moniker() || this.abject.getHash()
    }
  }
}
</script>
