<script>
  /** The card's title. */
  export let title = "";

  /**
   * @csspart header - Styles the header region.
   * @csspart body - Styles the body region.
   * @cssprop {Color} [--card-background=white] - Background color of the card.
   * @cssprop --card-border-color - Border color of the card.
   * @cssproperty {Length} [--card-padding=1rem] - Padding inside the card.
   */
</script>

<div>
  <div part="header">{title}</div>
  <div part="body"><slot /></div>
</div>
