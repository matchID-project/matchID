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
</style>