<div class="map-container">
    <Map>
        <TileLayer tileServer='ign.plan.grey'/>
    </Map>
</div>


<script>
	import Map from './Map.svelte';
    import TileLayer from './TileLayer.svelte';

</script>

<style>
  .map-container {
      justify-content: center;
      display: flex;
  }
  /* white behind the semi-transparent basemap tiles (veil) */
  .map-container :global(.leaflet-container) {
      background: #fff;
  }
</style>