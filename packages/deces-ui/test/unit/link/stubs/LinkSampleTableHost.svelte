<script>
  // Parent of LinkSampleTable passing only `fields`, like LinkConfigure does.
  //
  // @testing-library/svelte keeps all render() props in one reactive object:
  // with Svelte 5, rerender({ fields }) then also re-reads the props that the
  // table sets itself (sep, encoding, skipLines...) and resets them, which a
  // real parent does not do. Rendering through this host keeps the props
  // independent, as in the app.
  import LinkSampleTable from '../../../../src/components/views/LinkSampleTable.svelte';
  export let fields;
</script>

<LinkSampleTable bind:fields />
