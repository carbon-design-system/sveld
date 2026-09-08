<script lang="ts">
  export const version = "1.0.0";

  /**
   * @param {string} label - The new label text
   * @returns {string} The previous label text
   */
  export function setLabel(label: string): string {
    return label;
  }

  export function getCount(): number {
    return 0;
  }
</script>

<div>{version}</div>
