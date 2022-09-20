<template>
  <div>
    <div class="row">
      <div class="col-sm-12">
        <div class="line-alias mono">{{ this.abject.getHash() }}</div>
      </div>
    </div>

    <div class="top-level-twist abject">
      <div class="row">
        <div class="col-sm-6 mono key">
          URL
        </div>
        <div class="col-sm-6">
          {{ this.abject.url() }}
        </div>
      </div>
      <div class="row">
        <div class="col-sm-6 mono key">
          METHODS
        </div>
        <div class="col-sm-6">
          <div v-for="method in this.abject.methods()">
            {{ method }}
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col-sm-6 mono key">
          EXPIRY
        </div>
        <div class="col-sm-6">
          {{ this.abject.expiry() }}
        </div>
      </div>
      <div class="row">
        <div class="col-sm-6 mono key">
          POPTOP
        </div>
        <div class="col-sm-6 mono">
          {{ this.abject.popTop() }}
        </div>
      </div>
      <div class="row">
        <div class="col-sm-6 mono key">
          DELEGATION CHAIN
        </div>
        <div class="col-sm-6">
            <div v-for="actionable in this.abject.delegationChain()" class="toggle">
              <div @click="this.toggleDelegator(actionable)">
                <div class="expand-collapse">
                  <BIconArrowDownCircle v-if="this.isVisible(actionable)"/>
                  <BIconArrowRightCircle v-else/>
                </div>
                <div class="mono">{{ actionable.getHash() }}</div>
              </div>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-sm-6 mono key">
          AUTHORIZES
        </div>
        <div class="col-sm-6">
          <div class="row" v-for="(val, key) in this.authorizes">
            <div class="col-sm-6 mono key">{{ key }}</div>
            <div class="col-sm-6">{{ val }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-for="actionable in this.abject.delegationChain()" class="mono">
      <div v-if="this.isVisible(actionable)">
        <!--todo(mje): The first item in the delegation chain seems to be be the capability, not a simplehistoric -->
        <LineDetails :abject="this.getLine(actionable)"/>
      </div>
    </div>
  </div>
</template>

<script>

import { BIconArrowDownCircle, BIconArrowRightCircle } from 'bootstrap-icons-vue';
import LineDetails from '../files/line-details.vue';
import { capability, twist, hash } from '../../../../../dist/toda.web.dist.js';
const { Capability } = capability;
const { Twist } = twist;
const { NullHash } = hash;

export default {
  name: 'CapabilityViewer',
  components: {
    LineDetails,
    BIconArrowDownCircle,
    BIconArrowRightCircle
  },
  data: function() {
    return {
      visibleDelegator: new NullHash()
    }
  },
  props: {
    abject: Capability
  },
  methods: {
    getLine(actionable) {
      return new Twist(actionable.getAtoms())
    },
    toggleDelegator(actionable) {
      this.visibleDelegator = actionable.getHash().equals(this.visibleDelegator) ? new NullHash() : actionable.getHash();
    },
    isVisible(actionable) {
      return actionable.getHash().equals(this.visibleDelegator)
    }
  },
  computed: {
    authorizes() {
      let auths = this.abject.getAuthorizes();
      if (!auths) {
        return [];
      }
      
      return {
        URL: auths.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fUrl),
        VERB: auths.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fHttpVerb),
        NONCE: auths.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fNonce)
      }
    }
  }
}
</script>
