<template>
  <div class="container">
    <img class="main-img" src="../public/logo.png" /><br/>
    <router-view :key="$route.fullPath" />
    <div class="error-wrapper" v-if="this.error">
      <div>An error has occurred:</div>
      <span class="error">{{ this.error }}</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'App',
  data: function() {
    return {
      error: null
    }
  },
  errorCaptured: function(err) {
    this.error = err;
    return false;
  }
}
</script>
