<script>
  export let mathRef = null;
  export let fractionRef = null;
  export let textRef = null;
  export let spanRef = null;
</script>

<math bind:this={mathRef}>
  <mfrac bind:this={fractionRef}>
    <mn>1</mn>
    <mn>2</mn>
  </mfrac>
  <mtext bind:this={textRef}>
    <span bind:this={spanRef}>half</span>
  </mtext>
</math>
